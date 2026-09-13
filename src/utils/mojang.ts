const PROFILE_URL = 'https://api.mojang.com/users/profiles/minecraft/';

export interface MinecraftProfile {
  /// Undashed Mojang UUID.
  uuid: string;
  /// Canonical name, with Mojang's own casing.
  name: string;
}

/**
 * Looks up a Minecraft account by name.
 *
 * Distinguishes "no such player" (null) from "couldn't reach Mojang" (throws)
 * so callers can report the two cases differently — refusing a link because
 * Mojang was down would be indistinguishable, to the member, from refusing it
 * because they typed their own name wrong.
 *
 * @param name - Username to look up, in any casing.
 * @returns The profile with canonical casing, or null if no account has that name.
 * @throws If Mojang is unreachable or answers with an unexpected status.
 */
export async function lookupProfile(name: string): Promise<MinecraftProfile | null> {
  const response = await fetch(PROFILE_URL + encodeURIComponent(name), {
    signal: AbortSignal.timeout(5000),
  });

  // Mojang answers an unknown name with 404, and historically with 204.
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) {
    throw new Error(`Mojang API returned ${response.status}`);
  }

  const data = (await response.json()) as { id?: string; name?: string } | null;
  if (!data?.id || !data?.name) return null;

  return { uuid: data.id, name: data.name };
}

/**
 * The player-head avatar for a Minecraft account.
 *
 * Takes the UUID rather than the name so the avatar keeps working after a
 * Minecraft rename.
 */
export function headURL(id: string): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(id)}`;
}
