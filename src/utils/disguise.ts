import type { GuildTextBasedChannel, Message } from 'discord.js';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { logAudit } from './auditChannel.js';
import { formatDuration } from './duration.js';
import type { GlobalProfileState, GlobalProfileTarget } from './globalProfile.js';
import { logGlobal } from './logChannel.js';
import { clearRelayWebhook, getRelayWebhook, resolveWebhookTarget } from './relayWebhook.js';

// Discord caps a webhook username at 80 characters and rejects any containing
// "discord" or "clyde".
const MAX_WEBHOOK_NAME = 80;
const MAX_CONTENT = 2000;

// U+200B. Written as an escape because an invisible character in the source is
// a trap for the next person to edit this file.
const ZERO_WIDTH_SPACE = '\u200b';

// Latched per server so a missing permission reports once instead of on every
// message.
const warnedAboutRepost = new Set<string>();

// Reposts within a channel are chained: a burst that ran concurrently would
// arrive out of order, which is glaringly obvious in a busy channel.
const channelQueues = new Map<string, Promise<unknown>>();

export interface RepostResult {
  ok: boolean;
  /** Jump link to the repost, for the audit entry. */
  url: string | null;
  message: Message | null;
}

async function warnAboutRepostOnce(guildId: string): Promise<void> {
  if (warnedAboutRepost.has(guildId)) return;
  warnedAboutRepost.add(guildId);

  await logGlobal(
    guildId,
    '⚠️ Could not repost a message under another identity. Check that I have the ' +
      '**Manage Webhooks** and **Manage Messages** permissions in that channel. ' +
      'Leaving messages alone until this is fixed.'
  );
}

/**
 * Makes a name Discord will actually accept as a webhook username.
 *
 * The forbidden substrings are broken with a zero-width space rather than
 * stripped, so a member called "Discordian" still reads as themselves instead of
 * turning into "ian".
 */
export function sanitizeWebhookName(name: string | null | undefined): string {
  const cleaned = String(name ?? '')
    .replace(/(d)(iscord)/gi, `$1${ZERO_WIDTH_SPACE}$2`)
    .replace(/(c)(lyde)/gi, `$1${ZERO_WIDTH_SPACE}$2`)
    .trim()
    .slice(0, MAX_WEBHOOK_NAME)
    .trim();

  return cleaned || 'Member';
}

/**
 * Whether a message has to be left alone because a webhook repost could not
 * reproduce it faithfully.
 *
 * Reposting these anyway silently drops the part that mattered, so not touching
 * them is the honest outcome.
 */
export function shouldSkip(message: Message): boolean {
  // Nothing a webhook can carry: the send would 400 and the message would be
  // left behind anyway, so don't spend the attempt.
  if (!message.content && message.attachments.size === 0) return true;

  return Boolean(
    message.system ||
      message.stickers?.size ||
      message.poll ||
      message.messageSnapshots?.size ||
      message.flags?.has(MessageFlags.IsVoiceMessage)
  );
}

/**
 * Whether the bot can do the delete-and-repost dance in a channel at all.
 *
 * Checked up front so a channel we have no business touching costs a cached
 * permission lookup rather than a failed API round trip on every message.
 */
export function canRepostIn(channel: GuildTextBasedChannel | null | undefined): boolean {
  if (!channel) return false;

  const target = resolveWebhookTarget(channel);
  if (!target) return false;

  const me = channel.guild?.members?.me;
  if (!me) return false;

  return Boolean(
    target.channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageWebhooks) &&
      channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)
  );
}

/**
 * Builds the reposted message body.
 *
 * Deleting the original destroys Discord's native reply header, so a jump link
 * is the only surviving trace of what was being replied to.
 */
export function buildContent(message: Message): string | undefined {
  const body = message.content || '';
  const referenced = message.reference?.messageId;

  if (!referenced) return body || undefined;

  const url = `https://discord.com/channels/${message.guildId}/${message.channelId}/${referenced}`;
  const combined = `-# ↩ [replying to a message](${url})\n${body}`.trim();

  return combined.length > MAX_CONTENT ? `${combined.slice(0, MAX_CONTENT - 1)}…` : combined;
}

/**
 * Serialises work per channel so reposts keep their original order.
 */
function enqueue<T>(channelId: string, task: () => Promise<T>): Promise<T> {
  const previous = channelQueues.get(channelId) ?? Promise.resolve();

  // `.then(task, task)` so one failed repost does not stall the channel.
  const run = previous.then(task, task);
  const chained = run.catch(() => undefined);

  channelQueues.set(channelId, chained);
  void chained.then(() => {
    // Drop the entry once nothing queued behind us, so idle channels do not
    // accumulate settled promises forever.
    if (channelQueues.get(channelId) === chained) channelQueues.delete(channelId);
  });

  return run;
}

async function sendRepost(message: Message, target: GlobalProfileTarget): Promise<RepostResult> {
  const webhookTarget = resolveWebhookTarget(message.channel as GuildTextBasedChannel);
  if (!webhookTarget) return { ok: false, url: null, message: null };

  let sent: Message | null = null;

  try {
    const webhook = await getRelayWebhook(webhookTarget.channel);

    // Repost before deleting: if the webhook send throws, the member's original
    // message survives rather than vanishing.
    // A webhook that carries a token sends into a real channel, so the reply is
    // a Message rather than the raw API payload.
    sent = (await webhook.send({
      content: buildContent(message),
      username: sanitizeWebhookName(target.name),
      avatarURL: target.avatarURL ?? undefined,
      files: [...message.attachments.values()].map((attachment) => attachment.url),
      threadId: webhookTarget.threadId,
      // A webhook post is not subject to the author's own permissions, so an
      // unrestricted repost would let anyone ping @everyone.
      allowedMentions: { parse: ['users'] },
    })) as Message;
  } catch (error) {
    // The webhook may have been deleted out from under us; drop the cache so
    // the next message recreates it.
    clearRelayWebhook(webhookTarget.channel.id);
    console.error('Failed to repost a message:', error);
    if (message.guildId) await warnAboutRepostOnce(message.guildId);
    return { ok: false, url: null, message: null };
  }

  try {
    await message.delete();
  } catch {
    // Already deleted, or missing Manage Messages; the repost still landed.
  }

  return {
    ok: true,
    url: sent?.id
      ? `https://discord.com/channels/${message.guildId}/${message.channelId}/${sent.id}`
      : null,
    message: sent,
  };
}

/**
 * Reposts a message through the relay webhook wearing the target's identity,
 * then deletes the original.
 *
 * @returns On failure the original message is left exactly where it was.
 */
export function repostAs(message: Message, target: GlobalProfileTarget): Promise<RepostResult> {
  return enqueue(message.channel.id, () => sendRepost(message, target));
}

/**
 * Records who really sent a disguised message. The original is gone, so this is
 * the only way back to the actual author.
 */
export async function auditDisguise(
  message: Message,
  target: GlobalProfileTarget,
  url: string | null
): Promise<void> {
  if (!message.guildId) return;

  const jump = url ? ` — [jump](${url})` : '';
  await logAudit(
    message.guildId,
    `🎭 <@${message.author.id}> (\`${message.author.username}\`) posted as ` +
      `**${target.name}** in <#${message.channel.id}>${jump}`
  );
}

/**
 * Names the bridge legs the disguise has been switched off for, so an effect
 * that only covers part of the bridge says so rather than looking broken.
 */
export function switchedOffLegs(state: GlobalProfileState): string[] {
  const legs: string[] = [];
  if (state.disguiseToMinecraft === false) legs.push('Discord → Minecraft');
  if (state.disguiseToDiscord === false) legs.push('Minecraft → Discord');
  return legs;
}

/**
 * @param state - What {@link start} returned.
 * @param startedById - Discord id of the admin who started it.
 */
export async function announceStarted(
  guildId: string,
  state: GlobalProfileState,
  startedById: string
): Promise<void> {
  const ends =
    state.expiresAt === null
      ? 'when somebody stops it'
      : `<t:${Math.floor(state.expiresAt.getTime() / 1000)}:R>`;

  const off = switchedOffLegs(state);

  const embed = new EmbedBuilder()
    .setTitle('🎭 Global profile change started')
    .setDescription(
      state.mode === 'test'
        ? 'Running in **test mode** — only listed testers, in listed channels, are affected.'
        : 'Running **live** — everybody in the server is affected.'
    )
    .addFields(
      {
        name: 'Everyone appears as',
        value: state.target ? `<@${state.target.userId}>` : 'unknown',
        inline: true,
      },
      { name: 'Started by', value: `<@${startedById}>`, inline: true },
      { name: 'Ends', value: ends, inline: true }
    )
    .setColor(0xe67e22)
    .setTimestamp();

  if (off.length > 0) {
    embed.addFields({
      name: 'Not disguised across',
      value: off.map((leg) => `\`${leg}\``).join(', '),
    });
  }

  await logAudit(guildId, { embeds: [embed] });
}

/**
 * @param previous - What {@link stop} returned.
 * @param reason - Short phrase describing why it ended.
 */
export async function announceEnded(
  guildId: string,
  previous: GlobalProfileState,
  reason: string
): Promise<void> {
  const ran = previous.startedAt
    ? formatDuration(Date.now() - previous.startedAt.getTime())
    : 'unknown';

  const embed = new EmbedBuilder()
    .setTitle('🎭 Global profile change ended')
    .setDescription(`Everybody is back to their own name and avatar — ${reason}.`)
    .addFields(
      {
        name: 'Was appearing as',
        value: previous.target ? `<@${previous.target.userId}>` : 'unknown',
        inline: true,
      },
      { name: 'Ran for', value: ran, inline: true }
    )
    .setColor(0x2ecc71)
    .setTimestamp();

  await logAudit(guildId, { embeds: [embed] });
}
