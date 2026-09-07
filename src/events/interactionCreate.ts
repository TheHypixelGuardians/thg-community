import type { CommandInteraction } from 'discord.js';
import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { bot } from '../bot';
import { handleAdminPanelInteraction } from '../utils/adminPanelHandler.js';
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

      // The admin panel owns every `panel:` custom id and answers the
      // interaction itself, so nothing further should try to handle it.
      if (await handleAdminPanelInteraction(interaction)) return;

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
