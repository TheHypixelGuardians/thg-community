import { prisma } from './prisma.js';

/**
 * The shared blacklist, read-only on this side.
 *
 * TriBridge's `/blacklist` writes the `Blacklist` table; this bot only reads it.
 * The writer is another process, so unlike the other caches here this one
 * cannot be invalidated on write and expires on a timer instead. 15 seconds
 * matches the bridge's own caches: a member blacklisted on the bridge is
 * refused here within that window.
 */
const TTL_MS = 15_000;

const cache = new Map<string, { ids: Set<string>; readAt: number }>();

/**
 * Whether a member is blacklisted from this bot's commands.
 *
 * **Fails open.** A database that cannot be read is logged and treated as "not
 * blacklisted". Failing closed would lock the whole server out of both bots
 * during an outage. The privileged gate, `isAdmin()`, still fails closed, so
 * nothing privileged opens up.
 *
 * @param guildId - Discord server id.
 * @param discordId - The member's Discord id.
 */
export async function isBlacklisted(guildId: string, discordId: string): Promise<boolean> {
  const cached = cache.get(guildId);
  if (cached && Date.now() - cached.readAt < TTL_MS) return cached.ids.has(discordId);

  try {
    const rows = await prisma.blacklist.findMany({
      where: { guildId },
      select: { discordId: true },
    });
    const ids = new Set(rows.map((row) => row.discordId));
    cache.set(guildId, { ids, readAt: Date.now() });
    return ids.has(discordId);
  } catch (error) {
    console.error('Could not read the blacklist; letting the interaction through:', error);
    return false;
  }
}
