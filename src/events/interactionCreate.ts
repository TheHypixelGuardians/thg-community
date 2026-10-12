import type { CommandInteraction } from 'discord.js';
import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { bot } from '../bot.js';
import { getDiscordErrorCode, isStaleInteractionError } from '../utils/discordErrors.js';
import { errorHandler } from '../utils/errorHandler.js';
import { ensureUserExists } from '../utils/userManager.js';

/** Slash commands that hit external APIs — must ack before any DB work. */
const EARLY_DEFER_COMMANDS = new Set(['skyblock', 'networth']);

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

      if (interaction.user && !interaction.user.bot) {
        await ensureUserExists(interaction.user.id, interaction.user.username);
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
      console.log(error);
      await errorHandler.handleError(error as Error, interaction as CommandInteraction, {
        command: 'interaction',
        userId: interaction.user?.id,
        guildId: interaction.guildId || undefined,
        channelId: interaction.channelId,
      });
    }
  }
}
