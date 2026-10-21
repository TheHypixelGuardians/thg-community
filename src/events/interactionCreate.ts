import { type CommandInteraction, type Interaction, MessageFlags } from 'discord.js';
import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { bot } from '../bot.js';
import { isBlacklisted } from '../utils/blacklist.js';
import { getDiscordErrorCode, isStaleInteractionError } from '../utils/discordErrors.js';
import { errorHandler } from '../utils/errorHandler.js';
import { ensureUserExists } from '../utils/userManager.js';

/** Slash commands that hit external APIs — must ack before any DB work. */
const EARLY_DEFER_COMMANDS = new Set(['skyblock', 'networth']);

const BLACKLISTED_MESSAGE = "❌ You are blacklisted from using this bot's commands.";

/**
 * Answers a blacklisted member's interaction without running it. Autocomplete
 * gets an empty list (it cannot carry a message), everything else an
 * ephemeral refusal, edited in when the command was already deferred above.
 */
async function refuseBlacklisted(interaction: Interaction): Promise<void> {
  if (interaction.isAutocomplete()) {
    await interaction.respond([]);
    return;
  }
  if (!interaction.isRepliable()) return;

  if (interaction.deferred) {
    await interaction.editReply(BLACKLISTED_MESSAGE);
  } else if (!interaction.replied) {
    await interaction.reply({ content: BLACKLISTED_MESSAGE, flags: MessageFlags.Ephemeral });
  }
}

@Discord()
export class InteractionCreate {
  @On()
  async interactionCreate([interaction]: ArgsOf<'interactionCreate'>): Promise<void> {
    const receivedAt = Date.now();
    const interactionAgeMs = receivedAt - interaction.createdTimestamp;

    try {
      // Acknowledge BEFORE touching Prisma. The first query after a restart can
      // block the event loop while the engine wakes up; if that runs before
      // deferReply, Discord expires the token (10062 Unknown interaction).
      if (
        interaction.isChatInputCommand() &&
        EARLY_DEFER_COMMANDS.has(interaction.commandName) &&
        !interaction.deferred &&
        !interaction.replied
      ) {
        await interaction.deferReply();
      }

      // Before ensureUserExists: a blacklisted member gets no User row out of an
      // interaction they are refused. Every interaction type is covered here, so
      // buttons and menus on an old message are refused as well as commands.
      if (
        interaction.guildId &&
        !interaction.user.bot &&
        (await isBlacklisted(interaction.guildId, interaction.user.id))
      ) {
        await refuseBlacklisted(interaction);
        return;
      }

      if (interaction.user && !interaction.user.bot) {
        await ensureUserExists(interaction.user.id);
      }

      await bot.executeInteraction(interaction);
    } catch (error) {
      if (isStaleInteractionError(error)) {
        const command = interaction.isChatInputCommand()
          ? interaction.commandName
          : interaction.type;
        console.warn(
          `Ignored stale interaction (${getDiscordErrorCode(error)}) ` +
            `command=${command} ageMs=${interactionAgeMs} ` +
            `handlerMs=${Date.now() - receivedAt}`
        );
        return;
      }
      await errorHandler.handleError(error as Error, interaction as CommandInteraction, {
        command: 'interaction',
        userId: interaction.user?.id,
        guildId: interaction.guildId || undefined,
        channelId: interaction.channelId,
      });
    }
  }
}
