import type { Guild, GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { bot } from '../bot.js';
import { getSetup, updateSetup } from './setup.js';

export type LinkRoleResult =
  | { ok: true; changed: boolean }
  | {
      ok: false;
      reason: 'unconfigured' | 'missing-role' | 'forbidden' | 'no-member' | 'error';
      error?: Error;
    };

/**
 * @returns The role given to members with a linked Minecraft account, or null
 *   when the feature is switched off.
 */
export async function getLinkRoleId(guildId: string): Promise<string | null> {
  const setup = await getSetup(guildId);
  return setup.linkRoleId || null;
}

/**
 * @param roleId - Pass null to turn the feature off. Changing or clearing the
 *   role deliberately leaves the previous one on members: it may well have been
 *   handed out for unrelated reasons too.
 */
export async function setLinkRoleId(guildId: string, roleId: string | null): Promise<void> {
  await updateSetup(guildId, { linkRoleId: roleId });
}

/**
 * Resolves a Discord user id to a member of a server.
 *
 * Fetches by id rather than sweeping the roster: `guild.members.fetch()` with
 * no argument goes over the gateway, and a single-id fetch is a plain REST call.
 *
 * @returns null when the user is not in the server (left, or never joined).
 */
export async function resolveMember(
  guildId: string,
  userId: string
): Promise<GuildMember | null> {
  try {
    const guild: Guild = await bot.guilds.fetch(guildId);
    return await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

/**
 * Adds or removes the configured link role on a member.
 *
 * Never throws. Role changes fail for mundane reasons — role deleted, bot
 * demoted below it, Manage Roles revoked — and none of those should abort the
 * link itself, which is the part the member actually asked for. Callers report
 * the failure and carry on.
 */
export async function applyLinkRole(
  member: GuildMember,
  action: 'add' | 'remove'
): Promise<LinkRoleResult> {
  const roleId = await getLinkRoleId(member.guild.id);
  if (!roleId) return { ok: false, reason: 'unconfigured' };

  const role =
    member.guild.roles.cache.get(roleId) ??
    (await member.guild.roles.fetch(roleId).catch(() => null));
  if (!role) return { ok: false, reason: 'missing-role' };

  const has = member.roles.cache.has(roleId);
  if (action === 'add' ? has : !has) return { ok: true, changed: false };

  const me = member.guild.members.me;
  if (
    !me?.permissions.has(PermissionFlagsBits.ManageRoles) ||
    role.comparePositionTo(me.roles.highest) >= 0 ||
    role.managed
  ) {
    return { ok: false, reason: 'forbidden' };
  }

  try {
    if (action === 'add') {
      await member.roles.add(role, 'Linked a Minecraft account.');
    } else {
      await member.roles.remove(role, 'Unlinked their Minecraft account.');
    }
    return { ok: true, changed: true };
  } catch (error) {
    return { ok: false, reason: 'error', error: error as Error };
  }
}

/**
 * {@link applyLinkRole} for somebody who may not be in the member cache.
 */
export async function applyLinkRoleById(
  guildId: string,
  userId: string,
  action: 'add' | 'remove'
): Promise<LinkRoleResult> {
  if (!(await getLinkRoleId(guildId))) return { ok: false, reason: 'unconfigured' };

  const member = await resolveMember(guildId, userId);
  if (!member) return { ok: false, reason: 'no-member' };

  return applyLinkRole(member, action);
}

/**
 * Turns a failed {@link applyLinkRole} result into something worth putting in
 * the log channel, or null when the failure is not worth reporting.
 */
export function describeFailure(result: LinkRoleResult): string | null {
  if (result.ok) return null;

  switch (result.reason) {
    case 'unconfigured':
    case 'no-member':
      return null;
    case 'missing-role':
      return 'the configured link role no longer exists — set a new one with `/linkrole set`';
    case 'forbidden':
      return 'I need **Manage Roles** and a role ranked above the link role';
    default:
      return `an unexpected error occurred: ${result.error?.message ?? 'unknown'}`;
  }
}
