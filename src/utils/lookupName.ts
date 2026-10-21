import type { User } from 'discord.js';
import { getLink } from './linkedAccounts.js';

export type LookupName = { ok: true; name: string } | { ok: false; message: string };

/**
 * The Minecraft name a SkyBlock lookup is for: the typed `username` when one
 * was given, otherwise the linked account of `user`, otherwise the caller's own
 * linked account.
 *
 * @param username - The `username` option, or null when left out.
 * @param user - The `user` option, or null when left out.
 * @param caller - Whoever ran the command.
 */
export async function resolveLookupName(
  username: string | null,
  user: User | null,
  caller: User
): Promise<LookupName> {
  const typed = username?.trim();
  if (typed) return { ok: true, name: typed };

  const target = user ?? caller;
  const link = await getLink(target.id);
  if (link) return { ok: true, name: link.name };

  return {
    ok: false,
    message:
      target.id === caller.id
        ? '❌ You have not linked a Minecraft account.\n' +
          '> Pass a `username`, or link yours with `/link`.'
        : `❌ <@${target.id}> has not linked a Minecraft account.\n> Pass a \`username\` instead.`,
  };
}
