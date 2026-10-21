import type { GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

/** What `/link` puts in front of the Minecraft name. */
export const LINK_NICKNAME_PREFIX = '[Knight] ';

export type LinkNicknameResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'owner' | 'forbidden' | 'error'; error?: Error };

/**
 * The nickname `/link` gives a member, e.g. `[Knight] Notch`. Minecraft names
 * are at most 16 characters, so this always fits Discord's 32.
 */
export function linkNickname(minecraftName: string): string {
  return `${LINK_NICKNAME_PREFIX}${minecraftName}`;
}

/**
 * Sets a linked member's nickname to {@link linkNickname}, or on unlink clears
 * it — but only while it is still the one `/link` gave them, so a nickname the
 * member or staff picked since is left alone.
 *
 * Never throws, for the same reason as `applyLinkRole`: the link is what the
 * member asked for, and a nickname that cannot be changed must not undo it.
 *
 * @param minecraftName - The linked name: the new one on `add`, the removed
 *   one on `remove`.
 */
export async function applyLinkNickname(
  member: GuildMember,
  minecraftName: string,
  action: 'add' | 'remove'
): Promise<LinkNicknameResult> {
  const wanted = linkNickname(minecraftName);
  if (action === 'add' ? member.nickname === wanted : member.nickname !== wanted) {
    return { ok: true, changed: false };
  }

  // Discord never lets a bot rename the server owner.
  if (member.id === member.guild.ownerId) return { ok: false, reason: 'owner' };

  const me = member.guild.members.me;
  if (
    !me?.permissions.has(PermissionFlagsBits.ManageNicknames) ||
    member.roles.highest.comparePositionTo(me.roles.highest) >= 0
  ) {
    return { ok: false, reason: 'forbidden' };
  }

  try {
    await member.setNickname(
      action === 'add' ? wanted : null,
      action === 'add' ? 'Linked a Minecraft account.' : 'Unlinked their Minecraft account.'
    );
    return { ok: true, changed: true };
  } catch (error) {
    return { ok: false, reason: 'error', error: error as Error };
  }
}

/**
 * Turns a failed {@link applyLinkNickname} result into something worth putting
 * in the log channel, or null when it is not worth reporting.
 */
export function describeNicknameFailure(result: LinkNicknameResult): string | null {
  if (result.ok) return null;

  switch (result.reason) {
    case 'owner':
      return null;
    case 'forbidden':
      return 'I need **Manage Nicknames** and a role ranked above theirs';
    default:
      return `an unexpected error occurred: ${result.error?.message ?? 'unknown'}`;
  }
}
