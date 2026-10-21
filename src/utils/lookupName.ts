import type { User } from 'discord.js';
import { getLink } from './linkedAccounts.js';

export type LookupName = { ok: true; name: string } | { ok: false; message: string };

/**
 * The Minecraft name a SkyBlock lookup is for: the typed `username` when one
 * was given, otherwise the caller's own linked account.
 *
 * @param username - The `username` option, or null when left out.
 * @param caller - Whoever ran the command.
 */
export async function resolveLookupName(
  username: string | null,
  caller: User
): Promise<LookupName> {
  const typed = username?.trim();
  if (typed) return { ok: true, name: typed };

  const link = await getLink(caller.id);
  if (link) return { ok: true, name: link.name };

  return {
    ok: false,
    message:
      '❌ You have not linked a Minecraft account.\n' +
      '> Pass a `username`, or link yours with `/link`.',
  };
}
