import type { GuildMember } from 'discord.js';
import { prisma } from './prisma.js';

/**
 * Bot-admin roles, per Discord server.
 *
 * This list is shared with TriBridge, which reads the same table: the two bots
 * must agree about who is staff, or an admin role would open the admin panel
 * here and be refused on the bridge. This process owns every write, so the
 * cache is invalidated on write rather than expiring.
 */
const cache = new Map<string, string[]>();

/**
 * @param guildId - Discord server id.
 * @returns The role ids that count as bot-admin, newest last.
 */
export async function getRoles(guildId: string): Promise<string[]> {
  const cached = cache.get(guildId);
  if (cached) return cached;

  const rows = await prisma.adminRole.findMany({
    where: { guildId },
    orderBy: { createdAt: 'asc' },
    select: { roleId: true },
  });

  const roleIds = rows.map((row) => row.roleId);
  cache.set(guildId, roleIds);
  return roleIds;
}

/**
 * @returns False when the role was already on the list.
 */
export async function addRole(guildId: string, roleId: string): Promise<boolean> {
  const existing = await prisma.adminRole.findUnique({
    where: { guildId_roleId: { guildId, roleId } },
  });
  if (existing) return false;

  await prisma.adminRole.create({ data: { guildId, roleId } });
  cache.delete(guildId);
  return true;
}

/**
 * @returns False when the role was not on the list.
 */
export async function removeRole(guildId: string, roleId: string): Promise<boolean> {
  const deleted = await prisma.adminRole.deleteMany({ where: { guildId, roleId } });
  if (deleted.count === 0) return false;

  cache.delete(guildId);
  return true;
}

/**
 * Whether a member holds a bot-admin role.
 *
 * Fails closed: a member with no roles, no server, or a database that cannot be
 * reached is not an admin. Failing open here would hand the admin panel — and
 * with it the ability to impersonate everybody in the server — to anyone who
 * clicked while Postgres was down.
 */
export async function isAdmin(member: GuildMember | null | undefined): Promise<boolean> {
  if (!member?.guild) return false;

  try {
    const roleIds = await getRoles(member.guild.id);
    if (roleIds.length === 0) return false;

    return member.roles.cache.some((role) => roleIds.includes(role.id));
  } catch (error) {
    console.error('Could not read the admin roles; refusing:', error);
    return false;
  }
}
