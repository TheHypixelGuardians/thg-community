import { Category } from '@discordx/utilities';
import type { CommandInteraction } from 'discord.js';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash } from 'discordx';
import { logGlobal } from '../../../utils/logChannel.js';
import { ghostPing, pingDiamondTarget } from '../../../utils/pingDiamond.js';

@Discord()
@Category('Management')
export class PingDiamond {
  @Slash({
    name: 'pingdiamond',
    description: 'Ghost-ping Diamond',
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
  })
  async pingdiamond(interaction: CommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.channel) {
      await interaction.reply({
        content: '❌ This command only works in a server channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Checked here as well as through defaultMemberPermissions: a server
    // administrator can override that in Discord's command settings.
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply({
        content: '❌ You need **Manage Roles** to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const id = pingDiamondTarget();
    if (!id) {
      await interaction.reply({
        content:
          '⚠️ `/pingdiamond` is not set up.\n' +
          "> Set `PINGDIAMOND_USER_ID` in the bot's `.env` and restart it.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({ content: '👻 Done.', flags: MessageFlags.Ephemeral });

    let deleted: boolean;
    try {
      deleted = await ghostPing(interaction.channel, id);
    } catch (error) {
      console.error('/pingdiamond could not send:', error);
      await interaction.editReply(
        '❌ Could not ping here.\n' +
          '> The bot needs **View Channel** and **Send Messages** in this channel.'
      );
      return;
    }
    if (!deleted) {
      await interaction.editReply(
        '⚠️ Pinged, but the ping could not be deleted. Remove it by hand.'
      );
    }

    await logGlobal(interaction.guildId, {
      content: `👻 <@${interaction.user.id}> ran \`/pingdiamond\` in <#${interaction.channelId}>`,
      allowedMentions: { parse: [] },
    });
  }
}
