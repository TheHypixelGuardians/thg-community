import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { logModeration } from '../../../utils/moderation.js';

/** Discord's bulk delete skips messages older than this, so they are left out up front. */
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

@Discord()
@Category('Moderation')
export class Purge {
  @Slash({
    description: 'Delete recent messages in this channel',
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
  })
  async purge(
    @SlashOption({
      name: 'count',
      description: 'How many messages to delete (1 to 100)',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
      maxValue: 100,
    })
    count: number,
    @SlashOption({
      name: 'user',
      description: 'Only delete messages from this user',
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: User | null,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.channel?.isTextBased()) {
      await interaction.reply({
        content: '❌ This only works in a server text channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel;
    const mine = interaction.guild.members.me
      ? channel.permissionsFor(interaction.guild.members.me)
      : null;
    if (
      !mine?.has(PermissionFlagsBits.ManageMessages) ||
      !mine.has(PermissionFlagsBits.ReadMessageHistory)
    ) {
      await interaction.reply({
        content: '❌ I need **Manage Messages** and **Read Message History** in this channel.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Only ids, authors and timestamps are read, so this needs no Message Content.
    const cutoff = Date.now() - BULK_DELETE_MAX_AGE_MS;
    const recent = await channel.messages.fetch({ limit: 100 });
    const targets = [...recent.values()]
      .filter((m) => m.createdTimestamp > cutoff && !m.pinned)
      .filter((m) => !user || m.author.id === user.id)
      .slice(0, count);

    if (targets.length === 0) {
      await interaction.editReply(
        '⚠️ No messages to delete among the last 100 from the past 14 days.'
      );
      return;
    }

    const deleted = await channel.bulkDelete(targets, true);
    await logModeration(interaction.guildId, {
      content:
        `🧹 <@${interaction.user.id}> deleted **${deleted.size}** message(s) in <#${channel.id}>` +
        `${user ? ` from <@${user.id}>` : ''}.`,
      allowedMentions: { parse: [] },
    });
    await interaction.editReply(
      `🧹 Deleted **${deleted.size}** message(s)${user ? ` from <@${user.id}>` : ''}. Pinned messages ` +
        'and messages older than 14 days are skipped.'
    );
  }
}
