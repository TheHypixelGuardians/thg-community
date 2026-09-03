import type { Client, CommandInteraction, Interaction, Message, TextChannel } from 'discord.js';
import { EmbedBuilder, MessageFlags } from 'discord.js';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Error context information
 */
export interface ErrorContext {
  command?: string;
  interaction?: Interaction;
  message?: Message;
  userId?: string;
  guildId?: string | null;
  channelId?: string | null;
  additionalData?: Record<string, unknown>;
}

/**
 * Custom error class for Discord bot errors
 */
export class BotError extends Error {
  public severity: ErrorSeverity;
  public context: ErrorContext;
  public timestamp: Date;
  public trace?: string;
  constructor(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: ErrorContext = {},
    cause?: Error,
    trace?: string
  ) {
    super(message);
    this.name = 'BotError';
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.cause = cause;
    this.trace = trace;
  }
}

/**
 * Error handler utility class
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorCount: Map<string, number> = new Map();
  private readonly MAX_ERRORS_PER_MINUTE = 10;
  private client: Client | null = null;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  public setClient(client: Client) {
    this.client = client;
  }

  /**
   * Handle errors with proper logging and user feedback
   */
  public async handleError(
    error: Error | BotError,
    interaction?: CommandInteraction,
    context?: ErrorContext
  ): Promise<void> {
    const botError =
      error instanceof BotError
        ? error
        : new BotError(error.message, ErrorSeverity.MEDIUM, context || {}, error, error.stack);

    // Log the error
    this.logError(botError);

    // Send to Discord channel if configured
    if (this.client) {
      await sendErrorToChannel(this.client, botError);
    }

    // Check if we're hitting error rate limits
    if (this.isErrorRateLimited(botError)) {
      console.warn('Error rate limit exceeded, skipping user notification');
      return;
    }

    // Provide user feedback if interaction is available
    if (interaction && !interaction.replied && !interaction.deferred) {
      await this.sendErrorResponse(interaction, botError);
    }
  }

  /**
   * Handle unhandled promise rejections
   */
  public handleUnhandledRejection(reason: unknown, promise: Promise<unknown>): void {
    const error = new BotError('Unhandled Promise Rejection', ErrorSeverity.CRITICAL, {
      additionalData: { reason: String(reason), promise: String(promise) },
    });

    this.logError(error);
  }

  /**
   * Handle uncaught exceptions
   */
  public handleUncaughtException(error: Error): void {
    const botError = new BotError(
      'Uncaught Exception',
      ErrorSeverity.CRITICAL,
      { additionalData: { originalError: error.message } },
      error
    );

    this.logError(botError);

    // Give time for logging before exit
    setTimeout(() => {
      console.error('Critical error occurred, shutting down gracefully...');
      process.exit(1);
    }, 1000);
  }

  /**
   * Log error with appropriate formatting
   */
  public logError(error: BotError): void {
    const timestamp = error.timestamp.toISOString();
    const severity = error.severity;
    const context = error.context;

    console.error(`[${timestamp}] [${severity}] ${error.name}: ${error.message}`);

    if (context.command) {
      console.error(`  Command: ${context.command}`);
    }
    if (context.userId) {
      console.error(`  User: ${context.userId}`);
    }
    if (context.guildId) {
      console.error(`  Guild: ${context.guildId}`);
    }
    if (context.channelId) {
      console.error(`  Channel: ${context.channelId}`);
    }
    if (
      error.cause &&
      typeof error.cause === 'object' &&
      error.cause !== null &&
      'message' in error.cause
    ) {
      console.error(`  Caused by: ${(error.cause as Error).message}`);
    }
    if (context.additionalData) {
      console.error(`  Additional Data:`, context.additionalData);
    }

    console.error(`  Stack: ${error.stack}`);
  }

  /**
   * Send error response to user
   */
  private async sendErrorResponse(interaction: CommandInteraction, error: BotError): Promise<void> {
    try {
      const truncate = (text: string, max = 1000): string => {
        if (!text) return '';
        return text.length > max ? `${text.slice(0, max - 3)}...` : text;
      };

      const embed = new EmbedBuilder()
        .setTitle('❌ Error Occurred')
        .setColor('#ff0000')
        .setDescription('An unexpected error occurred while processing your request.')
        .addFields(
          { name: 'Error Type', value: error.name, inline: true },
          { name: 'Severity', value: error.severity, inline: true }
        )
        .setTimestamp();

      // Add more details for development
      if (process.env.NODE_ENV === 'development') {
        embed.addFields(
          { name: 'Message', value: truncate(error.message), inline: false },
          {
            name: 'Command',
            value: error.context.command || 'Unknown',
            inline: true,
          },
          {
            name: 'Stack',
            value: truncate(error.stack || 'No stack trace'),
            inline: false,
          }
        );
      }

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (replyError) {
      console.error('Failed to send error response:', replyError);
    }
  }

  /**
   * Check if error rate limit is exceeded
   */
  private isErrorRateLimited(error: BotError): boolean {
    const key = `${error.context.command || 'unknown'}-${error.context.userId || 'unknown'}`;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.errorCount.forEach((_count, errorKey) => {
      if (errorKey.includes('-') && parseInt(errorKey.split('-')[0]) < oneMinuteAgo) {
        this.errorCount.delete(errorKey);
      }
    });

    const currentCount = this.errorCount.get(key) || 0;
    this.errorCount.set(key, currentCount + 1);

    return currentCount >= this.MAX_ERRORS_PER_MINUTE;
  }

  /**
   * Wrap async functions with error handling
   */
  public async wrapAsync<T>(fn: () => Promise<T>, context?: ErrorContext): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      await this.handleError(error as Error, undefined, context);
      return null;
    }
  }

  /**
   * Create a safe interaction handler
   */
  public createSafeInteractionHandler(
    handler: (interaction: CommandInteraction) => Promise<void>,
    commandName: string
  ) {
    return async (interaction: CommandInteraction): Promise<void> => {
      try {
        await handler(interaction);
      } catch (error) {
        const context: ErrorContext = {
          command: commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId || undefined,
          channelId: interaction.channelId,
        };

        await this.handleError(error as Error, interaction, context);
      }
    };
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = ErrorHandler.getInstance();

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  process.on('unhandledRejection', (reason, promise) => {
    errorHandler.handleUnhandledRejection(reason, promise);
  });

  process.on('uncaughtException', (error) => {
    errorHandler.handleUncaughtException(error);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    process.exit(0);
  });
}

/**
 * Utility function to create error with context
 */
export function createError(
  message: string,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  context: ErrorContext = {}
): BotError {
  return new BotError(message, severity, context);
}

/**
 * Utility function to safely execute database operations
 */
export async function safeDatabaseOperation<T>(
  operation: () => Promise<T>,
  context: ErrorContext = {}
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const botError = new BotError(
      'Database operation failed',
      ErrorSeverity.HIGH,
      context,
      error as Error
    );

    // Use the public handleError method instead of private logError
    await errorHandler.handleError(botError);
    return null;
  }
}

/**
 * Send error log to a Discord channel if configured
 */
export async function sendErrorToChannel(client: Client, error: BotError): Promise<void> {
  const channelId = process.env.ERROR_LOG_CHANNEL_ID;
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Bot Error Occurred')
        .setColor('#ff0000')
        .addFields(
          { name: 'Type', value: error.name, inline: true },
          { name: 'Severity', value: error.severity, inline: true },
          { name: 'Message', value: error.message, inline: false },
          {
            name: 'Context',
            value: JSON.stringify(error.context, null, 2).slice(0, 1000) || 'None',
            inline: false,
          }
        )
        .setTimestamp();
      await (channel as TextChannel).send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Failed to send error to log channel:', err);
  }
}
