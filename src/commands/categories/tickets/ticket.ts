import { Category } from '@discordx/utilities';
import type {
  ButtonInteraction,
  CommandInteraction,
  Guild,
  ModalSubmitInteraction,
  User,
} from 'discord.js';
import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  OverwriteType,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ButtonComponent, Discord, ModalComponent, Slash, SlashGroup, SlashOption } from 'discordx';
import type { Ticket } from '../../../generated/prisma/client.js';
import { getLink } from '../../../utils/linkedAccounts.js';
import { lookupProfile } from '../../../utils/mojang.js';
import { prisma } from '../../../utils/prisma.js';
import { getSetup } from '../../../utils/setup.js';
import {
  buildCloseLog,
  buildTicketHeader,
  buildTranscript,
  createTicketChannel,
  getTicketType,
  isTicketStaff,
  logTicket,
  openTicketFor,
  REOPEN_WINDOW_MS,
  TICKET_IDS,
  type TicketAnswers,
  ticketByChannel,
  ticketById,
  ticketConfig,
} from '../../../utils/tickets.js';

/** Time between the closing message and the channel being deleted, so people see why. */
const DELETE_DELAY_MS = 5000;

const CLOSE_REASON_MAX = 500;

/**
 * The open ticket a command or button was used in, or null after telling the
 * member why there isn't one.
 */
async function ticketHere(
  interaction: CommandInteraction | ButtonInteraction
): Promise<Ticket | null> {
  const ticket = interaction.channelId ? await ticketByChannel(interaction.channelId) : null;
  if (ticket?.status !== 'open') {
    await interaction.reply({
      content: '❌ This only works inside an open ticket channel.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }
  return ticket;
}

/**
 * Closes a ticket: claims the close in the database first, so two people
 * pressing Close at once cannot both run it, then writes the transcript to the
 * log, tells the opener and deletes the channel.
 *
 * The transcript is read before the channel goes, and a failed transcript
 * still closes the ticket: a ticket that cannot be closed is worse than one
 * logged without its text.
 */
async function closeTicket(
  interaction: CommandInteraction | ModalSubmitInteraction,
  ticket: Ticket,
  reason: string | null
): Promise<void> {
  await interaction.deferReply();

  const claimed = await prisma.ticket.updateMany({
    where: { id: ticket.id, status: 'open' },
    data: {
      status: 'closed',
      closedById: interaction.user.id,
      closeReason: reason,
      closedAt: new Date(),
    },
  });
  if (claimed.count === 0) {
    await interaction.editReply('⚠️ This ticket is already being closed.');
    return;
  }

  const channel = interaction.channel;
  let transcript: string | null = null;
  if (channel?.type === ChannelType.GuildText) {
    try {
      transcript = await buildTranscript(channel, ticket);
    } catch (error) {
      console.error(`Could not build the transcript for ticket #${ticket.id}:`, error);
    }
  }

  // channelId is cleared only now: the unique key on it is what ticketHere()
  // and the channelDelete handler look tickets up by while closing.
  const closed = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { channelId: null },
  });
  await logTicket(closed.guildId, buildCloseLog(closed, transcript));

  const type = getTicketType(closed.type);
  try {
    const opener = await interaction.client.users.fetch(closed.openerId);
    await opener.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🔒 Your ticket #${closed.id} was closed`)
          .setDescription(
            [
              `**Server:** ${interaction.guild?.name ?? 'unknown'}`,
              `**Type:** ${type?.label ?? closed.type}`,
              `**Closed by:** <@${interaction.user.id}>`,
              `**Reason:** ${reason || '*none given*'}`,
            ].join('\n')
          )
          .setColor(0x95a5a6),
      ],
    });
  } catch {
    // DMs closed, or the opener left: the log entry still has it all.
  }

  await interaction.editReply({
    content:
      `🔒 Ticket closed by <@${interaction.user.id}>${reason ? `: ${reason}` : '.'} ` +
      'This channel is deleted in a few seconds.',
    allowedMentions: { parse: [] },
  });

  setTimeout(() => {
    channel?.delete?.(`Ticket #${closed.id} closed`).catch((error: unknown) => {
      console.error(`Could not delete the channel of ticket #${closed.id}:`, error);
    });
  }, DELETE_DELAY_MS);
}

/**
 * Validates an application's Minecraft name with Mojang and stores the
 * canonical spelling. An unreachable Mojang does not block the application;
 * the answer is kept as typed and marked unchecked.
 *
 * @returns An error for the member, or null when the answers are fine.
 */
async function checkApplication(answers: TicketAnswers): Promise<string | null> {
  const name = answers.mcName;
  if (!name) return null;

  try {
    const profile = await lookupProfile(name);
    if (!profile) return `❌ There is no Minecraft account called **${name}**.`;
    answers.mcName = profile.name;
  } catch {
    answers.mcName = `${name} (not checked: Mojang did not answer)`;
  }
  return null;
}

@Discord()
@Category('Tickets')
@SlashGroup({ name: 'ticket', description: 'Manage the ticket in this channel' })
@SlashGroup('ticket')
export class Tickets {
  @Slash({ name: 'add', description: 'Let a member see and write in this ticket (staff)' })
  async add(
    @SlashOption({
      name: 'user',
      description: 'The member to add',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const ticket = await ticketHere(interaction);
    if (!ticket) return;
    if (!(await isTicketStaff(interaction.member))) {
      await interaction.reply({
        content: '❌ Only ticket staff can add members to a ticket.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (user.bot) {
      await interaction.reply({
        content: '❌ Bots cannot be added.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    if (interaction.channel?.type !== ChannelType.GuildText) return;
    await interaction.channel.permissionOverwrites.edit(
      user.id,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
      },
      { type: OverwriteType.Member, reason: `Added to ticket #${ticket.id}` }
    );
    await interaction.editReply({
      content: `➕ <@${user.id}> was added to this ticket by <@${interaction.user.id}>.`,
      allowedMentions: { users: [user.id] },
    });
  }

  @Slash({ name: 'remove', description: 'Take a member back out of this ticket (staff)' })
  async remove(
    @SlashOption({
      name: 'user',
      description: 'The member to remove',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const ticket = await ticketHere(interaction);
    if (!ticket) return;
    if (!(await isTicketStaff(interaction.member))) {
      await interaction.reply({
        content: '❌ Only ticket staff can remove members from a ticket.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (user.id === ticket.openerId) {
      await interaction.reply({
        content: '❌ The member who opened the ticket stays in it. Close the ticket instead.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    if (interaction.channel?.type !== ChannelType.GuildText) return;
    await interaction.channel.permissionOverwrites.delete(
      user.id,
      `Removed from ticket #${ticket.id}`
    );
    await interaction.editReply({
      content: `➖ <@${user.id}> was removed from this ticket by <@${interaction.user.id}>.`,
      allowedMentions: { parse: [] },
    });
  }

  @Slash({ name: 'close', description: 'Close this ticket' })
  async close(
    @SlashOption({
      name: 'reason',
      description: 'Why the ticket is closed (shown to the member)',
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: CLOSE_REASON_MAX,
    })
    reason: string | null,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const ticket = await ticketHere(interaction);
    if (!ticket) return;
    if (interaction.user.id !== ticket.openerId && !(await isTicketStaff(interaction.member))) {
      await interaction.reply({
        content: '❌ Only the member who opened this ticket, or staff, can close it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await closeTicket(interaction, ticket, reason?.trim() || null);
  }

  /** A panel button: shows the type's form, unless the member already has one open. */
  @ButtonComponent({ id: new RegExp(`^${TICKET_IDS.open}:`) })
  async open(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    const type = getTicketType(interaction.customId.split(':')[1] ?? '');
    if (!type) {
      await interaction.reply({
        content: '❌ This ticket type no longer exists. Ask staff to post the panel again.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = ticketConfig(await getSetup(interaction.guildId));
    if (!config.categoryId) {
      await interaction.reply({
        content: '❌ Tickets are not set up yet. Ask an administrator to run `/setup`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const existing = await openTicketFor(interaction.guildId, interaction.user.id, type.key);
    if (existing?.channelId && interaction.guild.channels.cache.has(existing.channelId)) {
      await interaction.reply({
        content: `⚠️ You already have an open ${type.label.toLowerCase()} ticket: <#${existing.channelId}>.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (existing && !existing.channelId) {
      // Between the row being made and its channel: another form of theirs is
      // being submitted right now.
      await interaction.reply({
        content: `⚠️ Your ${type.label.toLowerCase()} ticket is being opened. Give it a moment.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (existing) {
      // Its channel is gone without the ticket being closed (deleted while the
      // bot was offline): close it, or the member could never open another.
      await prisma.ticket.update({
        where: { id: existing.id },
        data: {
          status: 'closed',
          channelId: null,
          closeReason: 'Channel deleted',
          closedAt: new Date(),
        },
      });
    }

    const link = type.key === 'application' ? await getLink(interaction.user.id) : null;
    const modal = new ModalBuilder()
      .setCustomId(`${TICKET_IDS.modal}:${type.key}`)
      .setTitle(`${type.label} ticket`)
      .addComponents(
        type.questions.map((question) => {
          const input = new TextInputBuilder()
            .setCustomId(question.id)
            .setLabel(question.label)
            .setPlaceholder(question.placeholder)
            .setStyle(question.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(question.required)
            .setMaxLength(question.maxLength);
          // Saves a linked member retyping their name.
          if (question.id === 'mcName' && link) input.setValue(link.name);
          return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
        })
      );

    // showModal() has to be the first response; it cannot follow a defer.
    await interaction.showModal(modal);
  }

  @ModalComponent({ id: new RegExp(`^${TICKET_IDS.modal}:`) })
  async submit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const type = getTicketType(interaction.customId.split(':')[1] ?? '');
    if (!type) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Checked again: two forms can be open at once.
    const existing = await openTicketFor(interaction.guildId, interaction.user.id, type.key);
    if (existing) {
      await interaction.editReply(
        existing.channelId
          ? `⚠️ You already have an open ${type.label.toLowerCase()} ticket: <#${existing.channelId}>.`
          : `⚠️ Your ${type.label.toLowerCase()} ticket is already being opened.`
      );
      return;
    }

    const answers: TicketAnswers = {};
    for (const question of type.questions) {
      const value = interaction.fields.getTextInputValue(question.id).trim();
      if (value) answers[question.id] = value;
    }
    if (type.key === 'application') {
      const problem = await checkApplication(answers);
      if (problem) {
        await interaction.editReply(problem);
        return;
      }
    }

    const config = ticketConfig(await getSetup(interaction.guildId));
    // Stored first: the id is the ticket number the channel is named after.
    const ticket = await prisma.ticket.create({
      data: {
        guildId: interaction.guildId,
        type: type.key,
        openerId: interaction.user.id,
        answers,
      },
    });

    const result = await createTicketChannel(interaction.guild, ticket, config).catch(
      (error: unknown) => {
        console.error(`Could not create the channel for ticket #${ticket.id}:`, error);
        return { ok: false as const, message: 'Discord refused to create the channel.' };
      }
    );
    if (!result.ok) {
      await prisma.ticket.delete({ where: { id: ticket.id } });
      await interaction.editReply(
        `❌ I could not open your ticket: ${result.message} Please tell an administrator.`
      );
      return;
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { channelId: result.channel.id },
    });
    await logTicket(interaction.guildId, {
      content: `🎫 Ticket **#${ticket.id}** (${type.label}) opened by <@${interaction.user.id}>: <#${result.channel.id}>`,
      allowedMentions: { parse: [] },
    });
    await interaction.editReply(`✅ Your ticket is open: <#${result.channel.id}>`);
  }

  /** Claim, or unclaim when the clicker already holds it. A claim by somebody else is taken over. */
  @ButtonComponent({ id: TICKET_IDS.claim })
  async claim(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const ticket = await ticketHere(interaction);
    if (!ticket) return;
    if (!(await isTicketStaff(interaction.member))) {
      await interaction.reply({
        content: '❌ Only ticket staff can claim tickets.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const unclaim = ticket.claimedById === interaction.user.id;
    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { claimedById: unclaim ? null : interaction.user.id },
    });

    await interaction.update(buildTicketHeader(updated));
    await interaction.followUp({
      content: unclaim
        ? `↩️ <@${interaction.user.id}> unclaimed this ticket.`
        : `🙋 <@${interaction.user.id}> claimed this ticket.`,
      allowedMentions: { parse: [] },
    });
  }

  @ButtonComponent({ id: TICKET_IDS.close })
  async closeButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const ticket = await ticketHere(interaction);
    if (!ticket) return;
    if (interaction.user.id !== ticket.openerId && !(await isTicketStaff(interaction.member))) {
      await interaction.reply({
        content: '❌ Only the member who opened this ticket, or staff, can close it.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // The form doubles as the confirmation: dismissing it closes nothing.
    const modal = new ModalBuilder()
      .setCustomId(TICKET_IDS.closeModal)
      .setTitle(`Close ticket #${ticket.id}`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason (optional, shown to the member)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(CLOSE_REASON_MAX)
        )
      );
    await interaction.showModal(modal);
  }

  @ModalComponent({ id: TICKET_IDS.closeModal })
  async closeSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    const ticket = interaction.channelId ? await ticketByChannel(interaction.channelId) : null;
    if (ticket?.status !== 'open') {
      await interaction.reply({
        content: '⚠️ This ticket is already closed.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const reason = interaction.fields.getTextInputValue('reason').trim() || null;
    await closeTicket(interaction, ticket, reason);
  }

  /** On a log entry: makes a fresh channel for a recently closed ticket. */
  @ButtonComponent({ id: new RegExp(`^${TICKET_IDS.reopen}:`) })
  async reopen(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;
    if (!(await isTicketStaff(interaction.member))) {
      await interaction.reply({
        content: '❌ Only ticket staff can reopen tickets.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const id = Number(interaction.customId.split(':')[1]);
    const ticket = Number.isInteger(id) ? await ticketById(id) : null;
    const refusal = await reopenRefusal(ticket, interaction.guild);
    if (refusal || !ticket) {
      await interaction.reply({
        content: refusal ?? '❌ That ticket no longer exists.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();

    // Claimed before the channel is made, so two clicks make one channel.
    const claimed = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: 'closed' },
      data: { status: 'open' },
    });
    if (claimed.count === 0) {
      await interaction.followUp({
        content: '⚠️ Somebody else is already reopening this ticket.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = ticketConfig(await getSetup(interaction.guildId));
    const note = `🔓 Reopened by <@${interaction.user.id}>. The earlier conversation is in the transcript on the log entry.`;
    const result = await createTicketChannel(interaction.guild, ticket, config, note).catch(
      (error: unknown) => {
        console.error(`Could not recreate the channel for ticket #${ticket.id}:`, error);
        return { ok: false as const, message: 'Discord refused to create the channel.' };
      }
    );
    if (!result.ok) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'closed' } });
      await interaction.followUp({
        content: `❌ Could not reopen the ticket: ${result.message}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { channelId: result.channel.id, closedById: null, closeReason: null, closedAt: null },
    });
    await interaction.editReply({ components: [] });
    await interaction.followUp({
      content: `🔓 Ticket **#${ticket.id}** reopened by <@${interaction.user.id}>: <#${result.channel.id}>`,
      allowedMentions: { parse: [] },
    });
  }
}

/**
 * Why a ticket cannot be reopened, or null when it can: it must be this
 * server's, closed within the reopen window, and its opener must not have
 * opened another ticket of the same type since.
 */
async function reopenRefusal(ticket: Ticket | null, guild: Guild): Promise<string | null> {
  if (!ticket || ticket.guildId !== guild.id) return '❌ That ticket no longer exists.';
  if (ticket.status !== 'closed') return '⚠️ This ticket is already open.';
  if (!ticket.closedAt || Date.now() - ticket.closedAt.getTime() > REOPEN_WINDOW_MS) {
    return '❌ Tickets can only be reopened within 24 hours of being closed.';
  }
  const other = await openTicketFor(guild.id, ticket.openerId, ticket.type);
  if (other) {
    return `❌ <@${ticket.openerId}> already has another open ticket of this type: <#${other.channelId}>.`;
  }
  return null;
}
