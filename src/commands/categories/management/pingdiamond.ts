import { Category } from '@discordx/utilities';
import type { CommandInteraction, Message } from 'discord.js';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash } from 'discordx';
import { logGlobal } from '../../../utils/logChannel.js';

/**
 * The one member `/pingdiamond` pings, from `PINGDIAMOND_USER_ID`. Read on
 * every run rather than at import, so a changed `.env` needs only a restart.
 *
 * @returns The id, or null when unset or not shaped like a Discord id.
 */
function targetId(): string | null {
  const id = process.env.PINGDIAMOND_USER_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

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

    const id = targetId();
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

    let ping: Message;
    try {
      ping = await interaction.channel.send({
        content: `<@${id}>`,
        // Only ever the configured member: nothing else in this message may
        // ping, whatever the environment variable is set to.
        allowedMentions: { users: [id] },
      });
    } catch (error) {
      console.error('/pingdiamond could not send:', error);
      await interaction.editReply(
        '❌ Could not ping here.\n' +
          '> The bot needs **View Channel** and **Send Messages** in this channel.'
      );
      return;
    }

    // Deleted straight away: the notification has already gone out, and the
    // message is not left behind in the channel. A bot can always delete its
    // own message, so this only fails when it is already gone.
    try {
      await ping.delete();
    } catch (error) {
      console.error('/pingdiamond could not delete its ping:', error);
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
