import { prisma } from './prisma.js';

// TriBridge is the writer and this bot only reads, so the cache cannot be
// invalidated on write — it expires instead. A minute is short enough that a
// newly wired officer channel is respected almost immediately, and long enough
// that the disguise gate is not a database round trip per message.
const TTL_MS = 60_000;

interface Entry {
  channelIds: Set<string>;
  readAt: number;
}

const cache = new Map<string, Entry>();

/**
 * The channels TriBridge owns in a Discord server: its bridge channel and every
 * Hypixel guild's officer channel.
 *
 * The bridge publishes these at startup rather than this bot being configured
 * with them separately, so the two cannot drift apart when a guild's officer
 * channel changes. An empty set means TriBridge has not published anything —
 * either it is not running, or this server has no bridge.
 */
export async function getBridgeChannelIds(guildId: string): Promise<Set<string>> {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.readAt < TTL_MS) return cached.channelIds;

  try {
    const rows = await prisma.bridgeChannel.findMany({
      where: { guildId },
      select: { channelId: true },
    });

    const channelIds = new Set(rows.map((row) => row.channelId));
    cache.set(guildId, { channelIds, readAt: Date.now() });
    return channelIds;
  } catch (error) {
    console.error('Could not read the published bridge channels:', error);

    // Serve the stale set rather than nothing: an empty set would let the
    // disguise repost into the bridge channel, where TriBridge does its own
    // repost, and into officer channels, where a webhook repost is dropped by
    // the officer relay and the message is lost outright.
    return cached?.channelIds ?? new Set<string>();
  }
}

/**
 * Whether a channel belongs to the bridge, and must therefore be left alone by
 * anything in this bot that deletes and reposts messages.
 */
export async function isBridgeChannel(guildId: string, channelId: string): Promise<boolean> {
  return (await getBridgeChannelIds(guildId)).has(channelId);
}
