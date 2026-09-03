import type { CommandInteraction } from 'discord.js';
import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { bot } from '../bot';
import { errorHandler } from '../utils/errorHandler';
import { ensureUserExists } from '../utils/userManager';

@Discord()
export class InteractionCreate {
  @On()
  async interactionCreate([interaction]: ArgsOf<'interactionCreate'>): Promise<void> {
    try {
      // Ensure user exists in database before executing interaction
      if (interaction.user && !interaction.user.bot) {
        await ensureUserExists(interaction.user.id, interaction.user.username);
      }

      await bot.executeInteraction(interaction);
    } catch (error) {
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
