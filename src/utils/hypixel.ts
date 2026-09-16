const BASE_URL = 'https://api.hypixel.net/v2';
const TIMEOUT_MS = 10_000;
const USER_AGENT = 'thg-community (+https://github.com/TheHypixelGuardians/thg-community)';

export type HypixelFailureCode =
  | 'no-key'
  | 'http'
  | 'rate-limit'
  | 'invalid-key'
  | 'upstream'
  | 'no-profiles';

export type HypixelResult<T> = { ok: true; data: T } | { ok: false; code: HypixelFailureCode };

function getApiKey(): string | null {
  const key = process.env.HYPIXEL_API_KEY;
  if (typeof key !== 'string') return null;
  const trimmed = key.trim();
  return trimmed || null;
}

async function hypixelGet(
  path: string,
  params: Record<string, string> = {}
): Promise<HypixelResult<Record<string, unknown>>> {
  const key = getApiKey();
  if (!key) return { ok: false, code: 'no-key' };

  const url = new URL(BASE_URL + path);
  url.searchParams.set('key', key);
  for (const [name, value] of Object.entries(params)) {
    if (value) url.searchParams.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, code: 'http' };
  }

  if (response.status === 429) return { ok: false, code: 'rate-limit' };
  if (response.status === 403) return { ok: false, code: 'invalid-key' };
  if (!response.ok) return { ok: false, code: 'http' };

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, code: 'upstream' };
  }

  if (body.success !== true) {
    const cause = String(body.cause ?? '').toLowerCase();
    if (cause.includes('invalid') && cause.includes('key')) {
      return { ok: false, code: 'invalid-key' };
    }
    if (cause.includes('rate')) return { ok: false, code: 'rate-limit' };
    return { ok: false, code: 'upstream' };
  }

  return { ok: true, data: body };
}

export type HypixelGuild = {
  _id?: string;
  name?: string;
  [key: string]: unknown;
};

export async function getGuildByPlayer(
  uuid: string
): Promise<HypixelResult<{ guild: HypixelGuild | null }>> {
  const cleaned = String(uuid ?? '')
    .replace(/-/g, '')
    .trim();
  if (!cleaned) return { ok: false, code: 'http' };

  const result = await hypixelGet('/guild', { player: cleaned });
  if (!result.ok) return result;

  const guild = (result.data.guild as HypixelGuild | null | undefined) ?? null;
  return { ok: true, data: { guild } };
}

export type SkyblockProfile = {
  profile_id?: string;
  cute_name?: string;
  selected?: boolean;
  game_mode?: string;
  banking?: { balance?: number };
  members?: Record<string, SkyblockMember>;
  [key: string]: unknown;
};

export type SkyblockMember = {
  leveling?: { experience?: number };
  currencies?: { coin_purse?: number };
  player_data?: { experience?: Record<string, number> };
  [key: string]: unknown;
};

export async function getSkyblockProfiles(
  uuid: string
): Promise<HypixelResult<{ profiles: SkyblockProfile[] }>> {
  const cleaned = String(uuid ?? '')
    .replace(/-/g, '')
    .trim();
  if (!cleaned) return { ok: false, code: 'http' };

  const result = await hypixelGet('/skyblock/profiles', { uuid: cleaned });
  if (!result.ok) return result;

  const profiles = result.data.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return { ok: false, code: 'no-profiles' };
  }

  return { ok: true, data: { profiles: profiles as SkyblockProfile[] } };
}

/**
 * Museum data for one SkyBlock profile (optional input to skyhelper-networth).
 */
export async function getMuseum(
  profileId: string
): Promise<HypixelResult<{ members: Record<string, unknown> }>> {
  const id = String(profileId ?? '').trim();
  if (!id) return { ok: false, code: 'http' };

  const result = await hypixelGet('/skyblock/museum', { profile: id });
  if (!result.ok) return result;

  const members =
    result.data.members && typeof result.data.members === 'object'
      ? (result.data.members as Record<string, unknown>)
      : {};
  return { ok: true, data: { members } };
}

/**
 * Finds a profile member blob for a Mojang UUID (dashed or undashed keys).
 */
export function findMember(profile: SkyblockProfile, uuid: string): SkyblockMember | undefined {
  const members = profile.members ?? {};
  const undashed = uuid.replace(/-/g, '').toLowerCase();
  const key = Object.keys(members).find((k) => k.replace(/-/g, '').toLowerCase() === undashed);
  return key ? members[key] : undefined;
}

export function pickSelectedProfile(profiles: SkyblockProfile[]): SkyblockProfile {
  return profiles.find((p) => p.selected) ?? profiles[0];
}

/** Cumulative XP required to reach each skill level (index = level). */
const SKILL_XP: number[] = [
  0, 50, 175, 375, 675, 1175, 1925, 2925, 4425, 6425, 9925, 14925, 22425, 32425, 47425, 67425,
  97425, 147425, 222425, 322425, 522425, 822425, 1222425, 1722425, 2322425, 3022425, 3822425,
  4722425, 5722425, 6822425, 8022425, 9322425, 10722425, 12222425, 13822425, 15522425, 17322425,
  19222425, 21222425, 23322425, 25522425, 27822425, 30222425, 32722425, 35322425, 38072425,
  40922425, 43872425, 46922425, 50072425, 53322425, 56672425, 60122425, 63672425, 67322425,
  71072425, 74922425, 78872425, 82922425, 87072425, 91322425,
];

const AVERAGE_SKILLS = [
  'SKILL_FARMING',
  'SKILL_MINING',
  'SKILL_COMBAT',
  'SKILL_FORAGING',
  'SKILL_FISHING',
  'SKILL_ENCHANTING',
  'SKILL_ALCHEMY',
  'SKILL_TAMING',
  'SKILL_CARPENTRY',
] as const;

export function skillLevelFromXp(xp: number): number {
  const value = Number.isFinite(xp) ? xp : 0;
  let level = 0;
  for (let i = 1; i < SKILL_XP.length; i++) {
    if (value >= SKILL_XP[i]) level = i;
    else break;
  }
  return level;
}

export function skyblockLevelFromExperience(experience: number): number {
  const value = Number.isFinite(experience) ? experience : 0;
  return Math.floor(value / 100);
}

/**
 * Average of the nine common progression skills. Returns null when the
 * experience map is missing (API settings hide skills).
 */
export function skillAverage(member: SkyblockMember | undefined): number | null {
  const experience = member?.player_data?.experience;
  if (!experience || typeof experience !== 'object') return null;

  const levels = AVERAGE_SKILLS.map((key) => skillLevelFromXp(Number(experience[key] ?? 0)));
  const sum = levels.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / levels.length) * 100) / 100;
}

export function formatUuidDashed(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) return uuid;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function minecraftHeadUrl(uuid: string): string {
  return `https://mc-heads.net/avatar/${formatUuidDashed(uuid)}/128`;
}
