const PROFILE_URL = 'https://api.mojang.com/users/profiles/minecraft/';

export type MojangProfile = {
  uuid: string;
  name: string;
};

/**
 * Looks up a Minecraft account by name.
 *
 * Distinguishes "no such player" (null) from "couldn't reach Mojang" (throws)
 * so callers can report the two cases differently.
 */
export async function lookupProfile(name: string): Promise<MojangProfile | null> {
  const response = await fetch(PROFILE_URL + encodeURIComponent(name), {
    signal: AbortSignal.timeout(5000),
  });

  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) {
    throw new Error(`Mojang API returned ${response.status}`);
  }

  const data = (await response.json()) as { id?: string; name?: string };
  if (!data?.id || !data?.name) return null;

  return { uuid: data.id, name: data.name };
}
