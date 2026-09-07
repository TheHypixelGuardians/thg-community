import type { APIEmbed, MessageActionRowComponentBuilder } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} from 'discord.js';
import { getAuditChannelId } from './auditChannel.js';
import { formatDuration } from './duration.js';
import type { GlobalProfileState } from './globalProfile.js';
import { getState, isActive } from './globalProfile.js';

// Custom id format: panel:{view}:{action}:{invokerId}. Four fixed parts keeps
// parsing trivial and leaves plenty of room under Discord's 100-char limit. The
// `panel` prefix is what keeps these ids from colliding with another feature's
// components — ids are global across the process.
export const PANEL_PREFIX = 'panel';

const MAX_FIELD_LENGTH = 1024;

// Discord allows at most 25 preselected values on a select menu.
const MAX_DEFAULTS = 25;

// A half-filled form cannot ride along in the next custom id, so it lives here
// between clicks. Losing it to a restart costs the admin one re-pick.
const DRAFT_TTL = 15 * 60 * 1000;

export interface DurationChoice {
  label: string;
  value: string;
  /** Null runs until stopped; undefined opens the custom-duration modal. */
  ms: number | null | undefined;
}

export const DURATION_CHOICES: DurationChoice[] = [
  { label: '5 minutes', value: '5m', ms: 5 * 60_000 },
  { label: '15 minutes', value: '15m', ms: 15 * 60_000 },
  { label: '30 minutes', value: '30m', ms: 30 * 60_000 },
  { label: '1 hour', value: '1h', ms: 60 * 60_000 },
  { label: '3 hours', value: '3h', ms: 3 * 60 * 60_000 },
  { label: '6 hours', value: '6h', ms: 6 * 60 * 60_000 },
  { label: '12 hours', value: '12h', ms: 12 * 60 * 60_000 },
  { label: '24 hours', value: '24h', ms: 24 * 60 * 60_000 },
  { label: 'Until stopped', value: 'indefinite', ms: null },
  { label: 'Custom…', value: 'custom', ms: undefined },
];

const SCOPE_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.GuildVoice,
];

export interface PanelDraft {
  targetId: string | null;
  duration: { value: string; ms: number | null } | undefined;
  touched: number;
}

const drafts = new Map<string, PanelDraft>();

export interface PanelView {
  embeds: APIEmbed[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export function customId(view: string, action: string, invokerId: string): string {
  return `${PANEL_PREFIX}:${view}:${action}:${invokerId}`;
}

export function parseCustomId(
  raw: string | null | undefined
): { view: string; action: string; invokerId: string } | null {
  const parts = String(raw ?? '').split(':');
  if (parts.length !== 4 || parts[0] !== PANEL_PREFIX) return null;

  return { view: parts[1], action: parts[2], invokerId: parts[3] };
}

function pruneDrafts(): void {
  const now = Date.now();
  for (const [userId, draft] of drafts) {
    if (now - draft.touched >= DRAFT_TTL) drafts.delete(userId);
  }
}

/**
 * The half-filled form for one admin. `duration` is undefined until one is
 * picked; `duration.ms` of null means "run until stopped".
 */
export function getDraft(userId: string): PanelDraft {
  pruneDrafts();

  let draft = drafts.get(userId);
  if (!draft) {
    draft = { targetId: null, duration: undefined, touched: Date.now() };
    drafts.set(userId, draft);
  }

  draft.touched = Date.now();
  return draft;
}

export function clearDraft(userId: string): void {
  drafts.delete(userId);
}

/**
 * Renders a list of ids as mentions, trimmed to fit an embed field.
 */
function formatIdList(ids: string[], render: (id: string) => string, empty: string): string {
  if (ids.length === 0) return empty;

  const pieces: string[] = [];
  let length = 0;

  for (const [index, id] of ids.entries()) {
    const piece = render(id);
    if (length + piece.length + 2 > MAX_FIELD_LENGTH - 20) {
      pieces.push(`… +${ids.length - index} more`);
      break;
    }
    pieces.push(piece);
    length += piece.length + 2;
  }

  return pieces.join(', ');
}

function describeMode(mode: string): string {
  if (mode === 'test') return '🧪 Test';
  if (mode === 'live') return '🌍 Live';
  return 'Off';
}

function describeEnd(expiresAt: Date | null): string {
  return expiresAt === null
    ? 'When stopped'
    : `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`;
}

function describeToggle(enabled: boolean): string {
  return enabled ? '✅ Disguised' : '🚫 Real name';
}

/**
 * The two bridge legs, as one embed field value. Both are acted on by TriBridge
 * rather than by this bot, which is why they read as bridge settings.
 */
function describeDirections(state: GlobalProfileState): string {
  return (
    `Discord → Minecraft: ${describeToggle(state.disguiseToMinecraft)}\n` +
    `Minecraft → Discord: ${describeToggle(state.disguiseToDiscord)}`
  );
}

/**
 * The panel's front page: what is running, and how the feature is scoped.
 */
async function buildMainEmbed(guildId: string): Promise<EmbedBuilder> {
  const state = await getState(guildId);
  const running = await isActive(guildId);
  const auditChannelId = await getAuditChannelId(guildId);
  const fields = [];

  if (running && state.target) {
    fields.push(
      { name: 'Mode', value: describeMode(state.mode), inline: true },
      { name: 'Everyone appears as', value: `<@${state.target.userId}>`, inline: true },
      { name: 'Ends', value: describeEnd(state.expiresAt), inline: true },
      { name: 'Started by', value: `<@${state.startedById}>`, inline: true }
    );
  }

  fields.push(
    {
      name: 'Testers',
      value: formatIdList(state.testerIds, (id) => `<@${id}>`, '*nobody*'),
    },
    {
      name: 'Test channels',
      value: formatIdList(state.testChannelIds, (id) => `<#${id}>`, '*none*'),
    },
    {
      name: 'Excluded channels (live mode)',
      value: formatIdList(state.excludedChannelIds, (id) => `<#${id}>`, '*none*'),
    },
    { name: 'Bridge', value: describeDirections(state) },
    {
      name: 'Audit channel',
      value: auditChannelId
        ? `<#${auditChannelId}>`
        : '⚠️ none — set one with `/auditchannel set`',
    }
  );

  return new EmbedBuilder()
    .setTitle('🛠️ Admin Panel')
    .setDescription(
      running
        ? '🎭 **Global Profile Change is running.**'
        : 'No admin function is running right now.'
    )
    .addFields(fields)
    .setColor(running ? 0xe67e22 : 0xbd93f9)
    .setTimestamp();
}

async function buildMainRows(
  guildId: string,
  invokerId: string
): Promise<ActionRowBuilder<MessageActionRowComponentBuilder>[]> {
  const running = await isActive(guildId);

  return [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId('main', 'profile', invokerId))
        .setLabel('Global Profile')
        .setEmoji('🎭')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(customId('main', 'stop', invokerId))
        .setLabel('Stop effect')
        .setEmoji('⏹️')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!running),
      new ButtonBuilder()
        .setCustomId(customId('main', 'refresh', invokerId))
        .setLabel('Refresh')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function describeDuration(duration: PanelDraft['duration']): string {
  if (!duration) return '*not chosen*';
  if (duration.ms === null) return 'Until stopped';
  return formatDuration(duration.ms);
}

function buildProfileEmbed(state: GlobalProfileState, draft: PanelDraft): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎭 Global Profile Change')
    .setDescription(
      "While this runs, everybody's messages are reposted wearing the target's name " +
        'and avatar, in Discord and across the Minecraft bridge.\n' +
        '> The original message is deleted and reposted, so it cannot be edited or ' +
        'deleted by its author afterwards. Every repost is recorded in the audit channel.\n' +
        'Either bridge direction can be switched off below — the disguise then stops at ' +
        'the bridge and that side keeps real names.'
    )
    .addFields(
      {
        name: 'Target',
        value: draft.targetId ? `<@${draft.targetId}>` : '*not chosen*',
        inline: true,
      },
      { name: 'Duration', value: describeDuration(draft.duration), inline: true },
      {
        name: '🧪 Test mode affects',
        value: `${state.testerIds.length} tester(s) in ${state.testChannelIds.length} channel(s)`,
      },
      {
        name: '🌍 Live mode affects',
        value: `Everybody, everywhere except ${state.excludedChannelIds.length} excluded channel(s)`,
      },
      { name: '🌉 Across the bridge', value: describeDirections(state) }
    )
    .setColor(0xbd93f9);
}

function buildProfileRows(
  state: GlobalProfileState,
  invokerId: string,
  draft: PanelDraft
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const targetSelect = new UserSelectMenuBuilder()
    .setCustomId(customId('profile', 'target', invokerId))
    .setPlaceholder('Who should everybody look like?')
    .setMinValues(1)
    .setMaxValues(1);

  if (draft.targetId) targetSelect.setDefaultUsers(draft.targetId);

  const durationSelect = new StringSelectMenuBuilder()
    .setCustomId(customId('profile', 'duration', invokerId))
    .setPlaceholder('How long should it last?')
    .addOptions(
      DURATION_CHOICES.map((choice) => ({
        label: choice.label,
        value: choice.value,
        default: draft.duration?.value === choice.value,
      }))
    );

  // Labelled with the state they are in rather than the state they would switch
  // to — the embed above says the same thing, and a button that contradicts it
  // is worse than a slightly wordy one.
  const toggleRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(customId('profile', 'toggleMinecraft', invokerId))
      .setLabel(`Discord → Minecraft: ${state.disguiseToMinecraft ? 'on' : 'off'}`)
      .setEmoji(state.disguiseToMinecraft ? '🎭' : '🚫')
      .setStyle(state.disguiseToMinecraft ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(customId('profile', 'toggleDiscord', invokerId))
      .setLabel(`Minecraft → Discord: ${state.disguiseToDiscord ? 'on' : 'off'}`)
      .setEmoji(state.disguiseToDiscord ? '🎭' : '🚫')
      .setStyle(state.disguiseToDiscord ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(targetSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(durationSelect),
    toggleRow,
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId('profile', 'startTest', invokerId))
        .setLabel('Start in test mode')
        .setEmoji('🧪')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(customId('profile', 'startLive', invokerId))
        .setLabel('Start live')
        .setEmoji('🌍')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(customId('profile', 'scope', invokerId))
        .setLabel('Testers & channels')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(customId('profile', 'back', invokerId))
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

/**
 * The tester and channel allowlists — the test system's whole configuration.
 */
function buildScopeEmbed(state: GlobalProfileState): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('⚙️ Testers & channels')
    .setDescription(
      '**Test mode** only rewrites a listed tester posting in a listed channel — and, ' +
        "over the bridge, only guild chat from a tester's own linked Minecraft account.\n" +
        '**Live mode** ignores both lists and rewrites everybody, except in the excluded ' +
        'channels.'
    )
    .addFields(
      {
        name: 'Testers',
        value: formatIdList(state.testerIds, (id) => `<@${id}>`, '*nobody*'),
      },
      {
        name: 'Test channels',
        value: formatIdList(state.testChannelIds, (id) => `<#${id}>`, '*none*'),
      },
      {
        name: 'Excluded channels (live mode)',
        value: formatIdList(state.excludedChannelIds, (id) => `<#${id}>`, '*none*'),
      }
    )
    .setColor(0xbd93f9);
}

function buildScopeRows(
  state: GlobalProfileState,
  invokerId: string
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const testerSelect = new UserSelectMenuBuilder()
    .setCustomId(customId('scope', 'testers', invokerId))
    .setPlaceholder('Testers')
    .setMinValues(0)
    .setMaxValues(MAX_DEFAULTS);

  const testChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(customId('scope', 'testChannels', invokerId))
    .setPlaceholder('Test channels')
    .setChannelTypes(SCOPE_CHANNEL_TYPES)
    .setMinValues(0)
    .setMaxValues(MAX_DEFAULTS);

  const excludedSelect = new ChannelSelectMenuBuilder()
    .setCustomId(customId('scope', 'excludedChannels', invokerId))
    .setPlaceholder('Channels to exclude in live mode')
    .setChannelTypes(SCOPE_CHANNEL_TYPES)
    .setMinValues(0)
    .setMaxValues(MAX_DEFAULTS);

  // Preselecting more than Discord allows is rejected outright, so anything past
  // the cap is simply not shown as selected — the stored list is intact.
  if (state.testerIds.length > 0) {
    testerSelect.setDefaultUsers(state.testerIds.slice(0, MAX_DEFAULTS));
  }
  if (state.testChannelIds.length > 0) {
    testChannelSelect.setDefaultChannels(state.testChannelIds.slice(0, MAX_DEFAULTS));
  }
  if (state.excludedChannelIds.length > 0) {
    excludedSelect.setDefaultChannels(state.excludedChannelIds.slice(0, MAX_DEFAULTS));
  }

  return [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(testerSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(testChannelSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(excludedSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(customId('scope', 'back', invokerId))
        .setLabel('Back')
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export async function mainView(guildId: string, invokerId: string): Promise<PanelView> {
  const embed = await buildMainEmbed(guildId);
  return { embeds: [embed.toJSON()], components: await buildMainRows(guildId, invokerId) };
}

export async function profileView(guildId: string, invokerId: string): Promise<PanelView> {
  const state = await getState(guildId);
  const draft = getDraft(invokerId);

  return {
    embeds: [buildProfileEmbed(state, draft).toJSON()],
    components: buildProfileRows(state, invokerId, draft),
  };
}

export async function scopeView(guildId: string, invokerId: string): Promise<PanelView> {
  const state = await getState(guildId);

  return {
    embeds: [buildScopeEmbed(state).toJSON()],
    components: buildScopeRows(state, invokerId),
  };
}
