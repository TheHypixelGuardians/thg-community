import { Category } from '@discordx/utilities';
import type { CommandInteraction, ModalSubmitInteraction } from 'discord.js';
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Discord, ModalComponent, Slash } from 'discordx';
import {
  attachMessage,
  buildRequestEmbed,
  createRequest,
  getRequestChannelId,
} from '../../../utils/featureRequests.js';

const MODAL_ID = 'requestModal';

@Discord()
@Category('Requests')
export class Request {
  @Slash({ description: 'Submit a feature request' })
  async request(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command only works in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // showModal() must be the first response to the interaction — it cannot
    // follow deferReply()/reply(). The channel lookup is a cached read, so this
    // guard costs a database round trip only the first time after a restart.
    if (!(await getRequestChannelId(interaction.guildId))) {
      await interaction.reply({
        content:
          '❌ No feature request channel is configured yet. Ask an administrator to run ' +
          '`/requestchannel set`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // 100 chars leaves room for the "💡 Request #N — " prefix inside the
    // 256-char embed title; 1000 keeps the description far below the 4096-char
    // embed description limit, so nothing needs truncating later.
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Feature name')
      .setPlaceholder('A short name for the feature')
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(100)
      .setRequired(true);

    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description')
      .setPlaceholder('What should it do, and why?')
      .setStyle(TextInputStyle.Paragraph)
      .setMinLength(10)
      .setMaxLength(1000)
      .setRequired(true);

    const modal = new ModalBuilder()
      .setCustomId(MODAL_ID)
      .setTitle('Submit a feature request')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)
      );

    await interaction.showModal(modal);
  }

  @ModalComponent({ id: MODAL_ID })
  async handleSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.guildId) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = await getRequestChannelId(interaction.guildId);
    if (!channelId) {
      await interaction.editReply('❌ No feature request channel is configured.');
      return;
    }

    const title = interaction.fields.getTextInputValue('title').trim();
    const description = interaction.fields.getTextInputValue('description').trim();

    // Persisted before the send so two concurrent submits cannot share a number.
    const record = await createRequest({
      guildId: interaction.guildId,
      discordId: interaction.user.id,
      username: interaction.user.username,
      title,
      description,
    });

    try {
      const channel = await interaction.client.channels.fetch(channelId);
      if (!channel?.isSendable()) {
        throw new Error(`Channel ${channelId} is not sendable`);
      }

      // The description is arbitrary member-supplied text posted by the bot, so
      // without this an @everyone in a request body would ping.
      const message = await channel.send({
        embeds: [buildRequestEmbed(record, interaction.user.id)],
        allowedMentions: { parse: [] },
      });

      await attachMessage(record.id, channel.id, message.id);
      await interaction.editReply(`✅ Submitted as request **#${record.id}**.`);
    } catch (error) {
      console.error(error);
      await interaction.editReply(
        `⚠️ Saved as request **#${record.id}**, but I could not post it — check my ` +
          'permissions in the request channel.'
      );
    }
  }
}
