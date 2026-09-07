import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember, TextChannel } from 'discord.js';
import {
  ApplicationCommandOptionType,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { getAuditChannelId, setAuditChannelId } from '../../../utils/auditChannel.js';

const REQUIRED_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, name: 'View Channel' },
  { flag: PermissionFlagsBits.SendMessages, name: 'Send Messages' },
  { flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links' },
];

async function gate(interaction: CommandInteraction): Promise<boolean> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command only works in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (!(await isAdmin(interaction.member as GuildMember))) {
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}

@Discord()
@Category('Management')
@SlashGroup({
  name: 'auditchannel',
  description: 'Configure the channel disguised messages are recorded in',
})
@SlashGroup('auditchannel')
export class AuditChannel {
  @Slash({ name: 'show', description: 'Show where disguised messages are recorded' })
  async show(interaction: CommandInteraction): Promise<void> {
    if (!(await gate(interaction))) return;

    const channelId = await getAuditChannelId(interaction.guildId as string);
    await interaction.reply(
      channelId
        ? `> Disguised messages and admin actions are recorded in <#${channelId}>.`
        : '⚠️ No audit channel is configured.'
    );
  }

  @Slash({ name: 'set', description: 'Set the channel disguised messages are recorded in' })
  async set(
    @SlashOption({
      name: 'channel',
      description: 'The channel to record disguised messages in',
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
      required: true,
    })
    channel: TextChannel,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!(await gate(interaction))) return;

    const me = interaction.guild?.members.me;
    const permissions = me ? channel.permissionsFor(me) : null;

    const missing = REQUIRED_PERMISSIONS.filter(
      (permission) => !permissions?.has(permission.flag)
    ).map((permission) => permission.name);

    if (missing.length > 0) {
      await interaction.reply(
        `❌ I cannot post in <#${channel.id}> — missing **${missing.join('**, **')}**.`
      );
      return;
    }

    await setAuditChannelId(interaction.guildId as string, channel.id);
    await interaction.reply(
      `✅ Disguised messages and admin actions will now be recorded in <#${channel.id}>.\n` +
        '> The bridge records its own disguised guild chat there too.'
    );
  }

  @Slash({ name: 'clear', description: 'Stop recording disguised messages' })
  async clear(interaction: CommandInteraction): Promise<void> {
    if (!(await gate(interaction))) return;

    const guildId = interaction.guildId as string;
    const previous = await getAuditChannelId(guildId);

    if (!previous) {
      await interaction.reply('⚠️ No audit channel is configured.');
      return;
    }

    await setAuditChannelId(guildId, null);
    await interaction.reply(
      '✅ Cleared the audit channel.\n' +
        '> A global profile change will still run, but nothing will record who really ' +
        'sent each disguised message.'
    );
  }
}
