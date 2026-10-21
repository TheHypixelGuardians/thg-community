import type {
  CategoryChannel,
  Guild,
  GuildBasedChannel,
  GuildMember,
  Message,
  TextChannel,
} from 'discord.js';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  OverwriteType,
  PermissionFlagsBits,
} from 'discord.js';
import type { Setup, Ticket } from '../generated/prisma/client.js';
import { isAdmin } from './adminRoles.js';
import { logGlobal, sendToChannel } from './logChannel.js';
import { prisma } from './prisma.js';
import { getSetup } from './setup.js';

/** Custom ids, prefixed per feature because component ids are global to the process. */
export const TICKET_IDS = {
  open: 'ticketOpen',
  modal: 'ticketModal',
  claim: 'ticketClaim',
  close: 'ticketClose',
  closeModal: 'ticketCloseModal',
  reopen: 'ticketReopen',
} as const;

/** A closed ticket can be reopened from its log entry for this long. */
export const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Upper bound on the messages read into a transcript, so a runaway ticket can't stall a close. */
const TRANSCRIPT_MAX_MESSAGES = 5000;

export type TicketQuestion = {
  id: string;
  label: string;
  placeholder: string;
  paragraph: boolean;
  required: boolean;
  maxLength: number;
};

export type TicketType = {
  key: string;
  label: string;
  emoji: string;
  description: string;
  questions: TicketQuestion[];
};

/**
 * The ticket types the panel offers. Fixed in code rather than configured per
 * server: the bot serves one community, and a question list edited through a
 * panel is a form builder nobody asked for.
 */
export const TICKET_TYPES: TicketType[] = [
  {
    key: 'support',
    label: 'Support',
    emoji: '🛟',
    description: 'A question or problem for staff',
    questions: [
      {
        id: 'issue',
        label: 'What do you need help with?',
        placeholder: 'Describe the question or problem',
        paragraph: true,
        required: true,
        maxLength: 1000,
      },
    ],
  },
  {
    key: 'application',
    label: 'Guild application',
    emoji: '📝',
    description: 'Apply to join a THG guild',
    questions: [
      {
        id: 'mcName',
        label: 'Minecraft name',
        placeholder: 'Your Minecraft username',
        paragraph: false,
        required: true,
        maxLength: 16,
      },
      {
        id: 'sbLevel',
        label: 'SkyBlock level',
        placeholder: 'For example 240',
        paragraph: false,
        required: true,
        maxLength: 10,
      },
      {
        id: 'why',
        label: 'Why do you want to join?',
        placeholder: 'Tell us a bit about yourself',
        paragraph: true,
        required: true,
        maxLength: 1000,
      },
    ],
  },
  {
    key: 'report',
    label: 'Report a member',
    emoji: '🚩',
    description: 'Report someone to staff, privately',
    questions: [
      {
        id: 'who',
        label: 'Who are you reporting?',
        placeholder: 'Discord or Minecraft name',
        paragraph: false,
        required: true,
        maxLength: 100,
      },
      {
        id: 'what',
        label: 'What happened?',
        placeholder: 'Where and when, with links to messages if you have them',
        paragraph: true,
        required: true,
        maxLength: 1000,
      },
    ],
  },
];

export function getTicketType(key: string): TicketType | undefined {
  return TICKET_TYPES.find((type) => type.key === key);
}

/** Stored question answers, keyed by question id. */
export type TicketAnswers = Record<string, string>;

/** `ticket-0042`: zero-padded so the channel list sorts by number. */
export function ticketChannelName(ticket: Pick<Ticket, 'id'>): string {
  return `ticket-${String(ticket.id).padStart(4, '0')}`;
}

/** The ticket settings, with the empty-string defaults of the old columns read as unset. */
export type TicketConfig = {
  panelChannelId: string | null;
  categoryId: string | null;
  staffRoleId: string | null;
  logChannelId: string | null;
  panelMessageId: string | null;
};

export function ticketConfig(setup: Setup): TicketConfig {
  return {
    panelChannelId: setup.ticketChannelId || null,
    categoryId: setup.ticketCategoryId || null,
    staffRoleId: setup.ticketStaffRoleId || null,
    logChannelId: setup.ticketLogChannelId || null,
    panelMessageId: setup.ticketPanelMessageId || null,
  };
}

/**
 * Posts to the ticket log channel, falling back to the general log channel
 * when none is set or it cannot be posted in.
 */
export async function logTicket(
  guildId: string,
  payload: Parameters<typeof sendToChannel>[1]
): Promise<void> {
  const setup = await getSetup(guildId).catch(() => null);
  const logChannelId = setup ? ticketConfig(setup).logChannelId : null;
  if (logChannelId && (await sendToChannel(logChannelId, payload))) return;
  await logGlobal(guildId, payload);
}

/**
 * Whether a member may claim, close for others, add or remove members and
 * reopen: the ticket staff role, or a bot admin. Fails closed like `isAdmin`.
 */
export async function isTicketStaff(member: GuildMember | null | undefined): Promise<boolean> {
  if (!member) return false;

  const setup = await getSetup(member.guild.id).catch(() => null);
  const staffRoleId = setup ? ticketConfig(setup).staffRoleId : null;
  if (staffRoleId && member.roles.cache.has(staffRoleId)) return true;

  return isAdmin(member);
}

/**
 * What the bot needs in the ticket category to post in and read the ticket
 * channels it makes there.
 */
const CATEGORY_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, name: 'View Channel' },
  { flag: PermissionFlagsBits.SendMessages, name: 'Send Messages' },
  { flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links' },
  { flag: PermissionFlagsBits.AttachFiles, name: 'Attach Files' },
  { flag: PermissionFlagsBits.ReadMessageHistory, name: 'Read Message History' },
];

/**
 * What the bot needs server-wide. A ticket channel gets its own overwrites
 * instead of syncing with the category, so a permission the bot only held
 * through a category overwrite would be gone inside the ticket; and Discord
 * only lets a non-administrator grant overwrites for permissions it holds in
 * the server. Manage Roles is what Discord calls the right to edit channel
 * overwrites: it is used for `/ticket add` and `/ticket remove`, never to
 * give anybody a role.
 */
const SERVER_PERMISSIONS = [
  { flag: PermissionFlagsBits.ManageChannels, name: 'Manage Channels' },
  { flag: PermissionFlagsBits.ManageRoles, name: 'Manage Roles' },
];

/** What the bot needs in the ticket log channel: post the entry with its transcript file. */
const LOG_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, name: 'View Channel' },
  { flag: PermissionFlagsBits.SendMessages, name: 'Send Messages' },
  { flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links' },
  { flag: PermissionFlagsBits.AttachFiles, name: 'Attach Files' },
];

function missing(
  channel: GuildBasedChannel,
  me: GuildMember | null | undefined,
  needed: { flag: bigint; name: string }[]
): string[] {
  const permissions = me ? channel.permissionsFor(me) : null;
  return needed.filter((p) => !permissions?.has(p.flag)).map((p) => p.name);
}

export function missingCategoryPermissions(
  category: GuildBasedChannel,
  me: GuildMember | null | undefined
): string[] {
  const server = SERVER_PERMISSIONS.filter((p) => !me?.permissions.has(p.flag)).map(
    (p) => `${p.name} (server-wide)`
  );
  return [...server, ...missing(category, me, CATEGORY_PERMISSIONS)];
}

export function missingLogPermissions(
  channel: GuildBasedChannel,
  me: GuildMember | null | undefined
): string[] {
  return missing(channel, me, LOG_PERMISSIONS);
}

/**
 * Who sees a ticket channel. Overwrites carry an explicit type because the
 * opener may not be cached (or may have left), and an untyped id is resolved
 * through the cache.
 *
 * These are channel permission overwrites, not roles: the bot hands out no
 * roles (see CLAUDE.md), and a ticket never changes what a member can see
 * anywhere else.
 */
function ticketOverwrites(guild: Guild, openerId: string, staffRoleId: string | null) {
  const member = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
  ];

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    { id: openerId, type: OverwriteType.Member, allow: member },
    // Without its own overwrite the bot would be hidden by the @everyone deny
    // like everyone else, unless it happens to be an administrator.
    { id: guild.client.user.id, type: OverwriteType.Member, allow: member },
  ];
  if (staffRoleId) {
    overwrites.push({ id: staffRoleId, type: OverwriteType.Role, allow: member });
  }

  return overwrites;
}

export function openTicketFor(guildId: string, openerId: string, type: string) {
  return prisma.ticket.findFirst({ where: { guildId, openerId, type, status: 'open' } });
}

export function ticketByChannel(channelId: string) {
  return prisma.ticket.findUnique({ where: { channelId } });
}

export function ticketById(id: number) {
  return prisma.ticket.findUnique({ where: { id } });
}

/**
 * The opening message of a ticket channel: who opened it, the form answers,
 * who claimed it, and the Claim and Close buttons.
 */
export function buildTicketHeader(ticket: Ticket, note?: string) {
  const type = getTicketType(ticket.type);
  const answers = (ticket.answers ?? {}) as TicketAnswers;

  const embed = new EmbedBuilder()
    .setTitle(`${type?.emoji ?? '🎫'} Ticket #${ticket.id}: ${type?.label ?? ticket.type}`)
    .setDescription(
      `Opened by <@${ticket.openerId}>. Staff will be with you soon.${note ? `\n\n${note}` : ''}`
    )
    .setColor(0x5865f2)
    .setTimestamp(ticket.createdAt);

  for (const question of type?.questions ?? []) {
    const answer = answers[question.id];
    if (answer) {
      embed.addFields({ name: question.label, value: answer.slice(0, 1024) });
    }
  }
  embed.addFields({
    name: 'Claimed by',
    value: ticket.claimedById ? `<@${ticket.claimedById}>` : '*nobody yet*',
  });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TICKET_IDS.claim)
      .setLabel(ticket.claimedById ? 'Unclaim' : 'Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(TICKET_IDS.close)
      .setLabel('Close')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [buttons] };
}

/**
 * Creates the private channel for a ticket and posts its header.
 *
 * @returns The channel, or the reason it could not be made.
 */
export async function createTicketChannel(
  guild: Guild,
  ticket: Ticket,
  config: TicketConfig,
  note?: string
): Promise<{ ok: true; channel: TextChannel } | { ok: false; message: string }> {
  const category = config.categoryId ? guild.channels.cache.get(config.categoryId) : undefined;
  if (!category || category.type !== ChannelType.GuildCategory) {
    return { ok: false, message: 'The ticket category is not set or no longer exists.' };
  }

  const gaps = missingCategoryPermissions(category as CategoryChannel, guild.members.me);
  if (gaps.length > 0) {
    return {
      ok: false,
      message: `I am missing **${gaps.join('**, **')}** for the ticket category.`,
    };
  }

  const type = getTicketType(ticket.type);
  const channel = await guild.channels.create({
    name: ticketChannelName(ticket),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Ticket #${ticket.id} · ${type?.label ?? ticket.type} · opened by ${ticket.openerId}`,
    permissionOverwrites: ticketOverwrites(guild, ticket.openerId, config.staffRoleId),
  });

  // The opener and staff role are pinged once, so the ticket isn't missed;
  // the answers in the embed never ping anybody.
  const mentions = [`<@${ticket.openerId}>`];
  if (config.staffRoleId) mentions.push(`<@&${config.staffRoleId}>`);
  await channel.send({
    content: mentions.join(' '),
    ...buildTicketHeader(ticket, note),
    allowedMentions: {
      users: [ticket.openerId],
      roles: config.staffRoleId ? [config.staffRoleId] : [],
    },
  });

  return { ok: true, channel };
}

/**
 * Reads a ticket channel into a plain-text transcript, oldest message first.
 *
 * Message text needs the **Message Content** intent switched on for the bot in
 * the Developer Portal. It does not have to be requested at login: REST reads
 * are governed by the app's setting, not the gateway intents. Without it, other
 * people's messages come back with empty text, so the transcript says so
 * instead of silently listing blank lines.
 */
export async function buildTranscript(channel: TextChannel, ticket: Ticket): Promise<string> {
  const messages: Message[] = [];
  let before: string | undefined;

  while (messages.length < TRANSCRIPT_MAX_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  messages.reverse();

  const type = getTicketType(ticket.type);
  const lines = [
    `Ticket #${ticket.id} (${type?.label ?? ticket.type}) in #${channel.name}`,
    `Opened by ${ticket.openerId} at ${ticket.createdAt.toISOString()}`,
    '',
  ];

  let hidden = 0;
  for (const message of messages) {
    const parts: string[] = [];
    if (message.content) parts.push(message.content);
    for (const embed of message.embeds) {
      if (embed.title) parts.push(`[embed] ${embed.title}`);
    }
    for (const attachment of message.attachments.values()) {
      parts.push(`[attachment] ${attachment.url}`);
    }
    if (parts.length === 0) {
      hidden++;
      parts.push('(no text available)');
    }

    const author = `${message.author.username} (${message.author.id})`;
    lines.push(`[${message.createdAt.toISOString()}] ${author}: ${parts.join('\n    ')}`);
  }

  if (messages.length >= TRANSCRIPT_MAX_MESSAGES) {
    lines.push('', `Only the last ${TRANSCRIPT_MAX_MESSAGES} messages are included.`);
  }
  if (hidden > 0) {
    lines.push(
      '',
      `${hidden} message(s) had no readable text. If that is every member message, the bot's ` +
        'Message Content intent is switched off in the Discord Developer Portal.'
    );
  }

  return lines.join('\n');
}

const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days`;
};

/**
 * The log channel entry for a closed ticket, with the transcript attached and
 * a Reopen button.
 */
export function buildCloseLog(ticket: Ticket, transcript: string | null) {
  const type = getTicketType(ticket.type);
  const closedAt = ticket.closedAt ?? new Date();

  const embed = new EmbedBuilder()
    .setTitle(`🔒 Ticket #${ticket.id} closed: ${type?.label ?? ticket.type}`)
    .addFields(
      { name: 'Opened by', value: `<@${ticket.openerId}>`, inline: true },
      {
        name: 'Claimed by',
        value: ticket.claimedById ? `<@${ticket.claimedById}>` : '*nobody*',
        inline: true,
      },
      {
        name: 'Closed by',
        value: ticket.closedById ? `<@${ticket.closedById}>` : '*unknown*',
        inline: true,
      },
      { name: 'Reason', value: (ticket.closeReason || '*none given*').slice(0, 1024) },
      {
        name: 'Open for',
        value: formatDuration(closedAt.getTime() - ticket.createdAt.getTime()),
        inline: true,
      }
    )
    .setColor(0x95a5a6)
    .setTimestamp(closedAt);

  const files = transcript
    ? [
        new AttachmentBuilder(Buffer.from(transcript, 'utf8'), {
          name: `${ticketChannelName(ticket)}.txt`,
        }),
      ]
    : [];

  const reopen = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${TICKET_IDS.reopen}:${ticket.id}`)
      .setLabel('Reopen')
      .setEmoji('🔓')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], files, components: [reopen], allowedMentions: { parse: [] } };
}

/**
 * The public panel members open tickets from: one button per type.
 */
export function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Open a ticket')
    .setDescription(
      [
        'Pick what your ticket is about. A private channel opens that only you and staff can see.',
        '',
        ...TICKET_TYPES.map((type) => `${type.emoji} **${type.label}**: ${type.description}`),
      ].join('\n')
    )
    .setColor(0x5865f2);

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    TICKET_TYPES.map((type) =>
      new ButtonBuilder()
        .setCustomId(`${TICKET_IDS.open}:${type.key}`)
        .setLabel(type.label)
        .setEmoji(type.emoji)
        .setStyle(ButtonStyle.Primary)
    )
  );

  return { embeds: [embed], components: [buttons] };
}
