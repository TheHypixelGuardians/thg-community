import type { MojangProfile } from './mojang.js';
import { prisma } from './prisma.js';
import { ensureUserExists } from './userManager.js';

/** A stored link, flattened to the shape callers actually want. */
export interface AccountLink {
  discordId: string;
  uuid: string;
  name: string;
}

export type SetLinkResult =
  | { ok: true; tookOverFrom: string | null }
  | { ok: false; reason: 'taken'; discordId: string };

/**
 * Minecraft account links.
 *
 * The rows are related to `User.id` rather than to the Discord id — see the
 * schema conventions — so every lookup here goes through the `User` table. The
 * cache is invalidated on write rather than expiring, because this process owns
 * every write to the table.
 *
 * TriBridge reads the same table to attribute guild chat. One Minecraft account
 * maps to at most one Discord user, and one Discord user to at most one
 * account; both directions are enforced here and by the schema.
 */
const cache = new Map<string, AccountLink | null>();

/**
 * @param discordId - Discord user id.
 * @returns The link, or null when the user has none.
 */
export async function getLink(discordId: string): Promise<AccountLink | null> {
  if (cache.has(discordId)) return cache.get(discordId) ?? null;

  const row = await prisma.minecraftLink.findFirst({
    where: { user: { discordId } },
    select: { uuid: true, name: true },
  });

  const link = row ? { discordId, uuid: row.uuid, name: row.name } : null;
  cache.set(discordId, link);
  return link;
}

/**
 * Reverse lookup by Minecraft name, case-insensitively — Hypixel spells a name
 * however the player typed it, and Mojang's canonical casing is what is stored.
 */
export async function getLinkByName(mcName: string): Promise<AccountLink | null> {
  const target = String(mcName ?? '').trim();
  if (!target) return null;

  const row = await prisma.minecraftLink.findFirst({
    where: { name: { equals: target, mode: 'insensitive' } },
    select: { uuid: true, name: true, user: { select: { discordId: true } } },
  });

  if (!row) return null;
  return { discordId: row.user.discordId, uuid: row.uuid, name: row.name };
}

/**
 * Binds a Minecraft account to a Discord user, replacing any link either side
 * already had to a *different* account.
 *
 * Refuses when the account is already claimed by somebody else: one Minecraft
 * account maps to at most one Discord user, so silently stealing it would let
 * anybody wear a guild member's identity across the bridge.
 *
 * @param discordId - Discord user id.
 * @param username - Discord username, so the `User` row can be created if the
 *   member has somehow never been seen before.
 * @param profile - Canonical name and UUID from Mojang.
 * @param options - `takeOver` when ownership was proven through the verification
 *   server: the account then moves from whoever claimed it before, because an
 *   unverified claim must not lock the real owner out.
 */
export async function setLink(
  discordId: string,
  username: string,
  profile: MojangProfile,
  { takeOver = false }: { takeOver?: boolean } = {}
): Promise<SetLinkResult> {
  const existing = await getLinkByName(profile.name);
  const claimedBy =
    (await prisma.minecraftLink.findUnique({
      where: { uuid: profile.uuid },
      select: { user: { select: { discordId: true } } },
    })) ?? null;
  const otherId =
    [claimedBy?.user.discordId, existing?.discordId].find((id) => id && id !== discordId) ?? null;

  if (otherId && !takeOver) {
    return { ok: false, reason: 'taken', discordId: otherId };
  }

  const user = await ensureUserExists(discordId, username);

  await prisma.$transaction([
    // Clears the previous claim on a take-over; a no-op otherwise.
    prisma.minecraftLink.deleteMany({
      where: { uuid: profile.uuid, NOT: { userId: user.id } },
    }),
    prisma.minecraftLink.upsert({
      where: { userId: user.id },
      update: { uuid: profile.uuid, name: profile.name },
      create: { userId: user.id, uuid: profile.uuid, name: profile.name },
    }),
  ]);

  cache.delete(discordId);
  if (otherId) cache.delete(otherId);
  return { ok: true, tookOverFrom: otherId };
}

/**
 * @returns The link that was removed, or null when the user had none.
 */
export async function removeLink(discordId: string): Promise<AccountLink | null> {
  const existing = await getLink(discordId);
  if (!existing) return null;

  await prisma.minecraftLink.deleteMany({ where: { user: { discordId } } });
  cache.delete(discordId);
  return existing;
}

/**
 * Every link, for the startup role sync and `/links`.
 */
export async function getAllLinks(): Promise<AccountLink[]> {
  const rows = await prisma.minecraftLink.findMany({
    select: { uuid: true, name: true, user: { select: { discordId: true } } },
    orderBy: { name: 'asc' },
  });

  return rows.map((row) => ({
    discordId: row.user.discordId,
    uuid: row.uuid,
    name: row.name,
  }));
}

/** Drops a cached link. Only needed when something outside this process wrote it. */
export function clearLinkCache(discordId?: string): void {
  if (discordId) cache.delete(discordId);
  else cache.clear();
}
