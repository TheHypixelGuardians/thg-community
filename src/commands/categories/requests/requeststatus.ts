import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { Discord, Slash, SlashChoice, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import type { RequestStatus } from '../../../utils/featureRequests.js';
import {
  buildRequestEmbed,
  getRequestAuthorId,
  setStatus,
  STATUS_LABELS,
} from '../../../utils/featureRequests.js';

@Discord()
@Category('Requests')
export class RequestStatus {
  @Slash({ name: 'requeststatus', description: 'Set the status of a feature request' })
  async requeststatus(
    @SlashOption({
      name: 'id',
      description: 'The number of the request',
      type: ApplicationCommandOptionType.Integer,
      minValue: 1,
      required: true,
    })
    id: number,
    @SlashChoice({ name: 'Accepted', value: 'accepted' })
    @SlashChoice({ name: 'Denied', value: 'denied' })
    @SlashChoice({ name: 'Planned', value: 'planned' })
    @SlashChoice({ name: 'Duplicate', value: 'duplicate' })
    @SlashOption({
      name: 'status',
      description: 'The status to set',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    status: RequestStatus,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!(await isAdmin(interaction.member as GuildMember))) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    // Persist before touching Discord, so the status is never lost when the
    // message edit fails.
    const record = await setStatus(id, status, interaction.user.id);

    if (!record) {
      await interaction.editReply(`❌ There is no request with ID **#${id}**.`);
      return;
    }

    const label = STATUS_LABELS[status];

    if (!record.messageId || !record.channelId) {
      await interaction.editReply(
        `⚠️ Set request **#${id}** to ${label}, but it was never posted to a channel.`
      );
      return;
    }

    try {
      // Fetched by the record's own channel, not the currently configured one,
      // so requests posted before a `/requestchannel set` still edit in place.
      const channel = await interaction.client.channels.fetch(record.channelId);
      if (!channel?.isTextBased()) throw new Error('Request channel is not text based');

      const message = await channel.messages.fetch(record.messageId);
      const authorId = (await getRequestAuthorId(record)) ?? interaction.user.id;
      await message.edit({ embeds: [buildRequestEmbed(record, authorId)] });

      await interaction.editReply(`✅ Request **#${id}** is now ${label}.`);
    } catch (error) {
      console.error(error);
      await interaction.editReply(
        `⚠️ Request **#${id}** is now ${label}, but I could not update the original ` +
          `message — it may have been deleted, or I may have lost access to ` +
          `<#${record.channelId}>.`
      );
    }
  }
}
