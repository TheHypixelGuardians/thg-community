import type { Setup } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

/**
 * Per-Discord-server configuration, cached in memory.
 *
 * The disguise gate reads this once per message, so it must not be a database
 * round trip on the hot path. This process is the only writer, so the cache is
 * authoritative and is invalidated by the setters below rather than expiring on
 * a timer.
 */
const cache = new Map<string, Setup>();

/**
 * Reads a server's configuration row, creating it on first use.
 *
 * @param guildId - Discord server id.
 */
export async function getSetup(guildId: string): Promise<Setup> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const setup = await prisma.setup.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  cache.set(guildId, setup);
  return setup;
}

/**
 * Writes part of a server's configuration and refreshes the cache.
 *
 * @param guildId - Discord server id.
 * @param data - The columns to change.
 */
export async function updateSetup(
  guildId: string,
  data: Partial<Omit<Setup, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>
): Promise<Setup> {
  const setup = await prisma.setup.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });

  cache.set(guildId, setup);
  return setup;
}

/**
 * Drops a server's cached configuration. Only needed when something outside
 * this process has written the row.
 */
export function clearSetupCache(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}
