import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { Discord, Slash } from 'discordx';
import { mainView } from '../../../utils/adminPanel.js';
import { isAdmin } from '../../../utils/adminRoles.js';

@Discord()
@Category('Management')
export class AdminPanel {
  @Slash({ description: 'Open the admin panel to run and configure admin functions' })
  async adminpanel(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command only works in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!(await isAdmin(interaction.member as GuildMember))) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Ephemeral: the panel exposes who is being impersonated and every channel
    // the effect is scoped to, which is nobody else's business.
    const view = await mainView(interaction.guildId, interaction.user.id);
    await interaction.reply({ ...view, flags: MessageFlags.Ephemeral });
  }
}
