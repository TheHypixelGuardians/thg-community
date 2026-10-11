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
import { getRequestChannelId, setRequestChannelId } from '../../../utils/featureRequests.js';

// The bot has to be able to see the channel, post in it and embed links, or
// every submission would be accepted and then silently fail to appear.
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
@Category('Requests')
@SlashGroup({
  name: 'requestchannel',
  description: 'Configure the channel feature requests are posted to',
})
@SlashGroup('requestchannel')
export class RequestChannel {
  @Slash({ name: 'show', description: 'Show the channel feature requests are posted to' })
  async show(interaction: CommandInteraction): Promise<void> {
    if (!(await gate(interaction))) return;

    const channelId = await getRequestChannelId(interaction.guildId as string);
    await interaction.reply(
      channelId
        ? `> Feature requests are posted to <#${channelId}>.`
        : '⚠️ No feature request channel is configured yet.'
    );
  }

  @Slash({ name: 'set', description: 'Set the channel feature requests are posted to' })
  async set(
    @SlashOption({
      name: 'channel',
      description: 'The channel to post feature requests in',
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

    await setRequestChannelId(interaction.guildId as string, channel.id);
    await interaction.reply(`✅ Feature requests will now be posted to <#${channel.id}>.`);
  }
}
