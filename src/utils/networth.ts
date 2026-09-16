import { createRequire } from 'node:module';
import {
  findMember,
  getMuseum,
  getSkyblockProfiles,
  type HypixelFailureCode,
  type SkyblockProfile,
} from './hypixel.js';
import { lookupProfile } from './mojang.js';

const require = createRequire(import.meta.url);
const { ProfileNetworthCalculator, NetworthManager, UpdateManager } =
  require('skyhelper-networth') as {
    ProfileNetworthCalculator: new (
      profileData: object,
      museumData?: object,
      bankBalance?: number
    ) => { getNetworth: (options?: object) => Promise<SkyhelperNetworth> };
    NetworthManager: { setOnlyNetworth: (value: boolean) => void };
    UpdateManager: { disable: () => void };
  };

// Prices-only payloads; skip item lists. Disable the package's npm update poller.
NetworthManager.setOnlyNetworth(true);
UpdateManager.disable();

const CACHE_TTL_OK_MS = 10 * 60_000;
const CACHE_TTL_MISS_MS = 5 * 60_000;
const CACHE_TTL_TRANSIENT_MS = 30_000;
const COOLDOWN_MS = 15_000;
const CACHE_LIMIT = 200;

type SkyhelperNetworth = {
  networth: number;
  unsoulboundNetworth: number;
  noInventory: boolean;
  purse: number;
  bank: number;
  personalBank: number;
  types: Record<string, { total: number; unsoulboundTotal: number }>;
};

export type ProfileNetworth = {
  profileId: string;
  cuteName: string;
  gameMode: string | null;
  current: boolean;
  networth: number;
  unsoulbound: number;
  purse: number;
  bank: number;
  personalBank: number;
  noInventory: boolean;
  types: Record<string, { total: number; unsoulbound: number }>;
};

export type NetworthFailureCode =
  | HypixelFailureCode
  | 'unknown-player'
  | 'mojang-error'
  | 'no-networth'
  | 'cooldown'
  | 'calc-error';

export type NetworthLookupResult =
  | {
      ok: true;
      player: { name: string; uuid: string };
      best: ProfileNetworth;
      profiles: ProfileNetworth[];
    }
  | { ok: false; code: NetworthFailureCode; detail?: string; retryAfterMs?: number };

type CacheEntry = { expiresAt: number; result: NetworthLookupResult };

const cache = new Map<string, CacheEntry>();
const lastAsk = new Map<string, number>();

const MISS_CODES = new Set<NetworthFailureCode>(['unknown-player', 'no-profiles', 'no-networth']);
const TRANSIENT_CODES = new Set<NetworthFailureCode>([
  'http',
  'rate-limit',
  'upstream',
  'mojang-error',
  'calc-error',
]);

function pruneMap<K, V>(map: Map<K, V>, limit: number): void {
  while (map.size > limit) {
    const first = map.keys().next().value;
    if (first === undefined) break;
    map.delete(first);
  }
}

function cachePut(nameKey: string, result: NetworthLookupResult): void {
  let ttl = CACHE_TTL_OK_MS;
  if (!result.ok) {
    if (MISS_CODES.has(result.code)) ttl = CACHE_TTL_MISS_MS;
    else if (TRANSIENT_CODES.has(result.code)) ttl = CACHE_TTL_TRANSIENT_MS;
    else if (result.code === 'no-key' || result.code === 'invalid-key') {
      ttl = CACHE_TTL_TRANSIENT_MS;
    } else {
      ttl = CACHE_TTL_TRANSIENT_MS;
    }
  }
  cache.set(nameKey, { expiresAt: Date.now() + ttl, result });
  pruneMap(cache, CACHE_LIMIT);
}

function projectTypes(
  types: SkyhelperNetworth['types'] | undefined
): Record<string, { total: number; unsoulbound: number }> {
  const out: Record<string, { total: number; unsoulbound: number }> = {};
  if (!types || typeof types !== 'object') return out;
  for (const [key, value] of Object.entries(types)) {
    if (!value || typeof value !== 'object') continue;
    const total = Number(value.total);
    if (!Number.isFinite(total) || total <= 0) continue;
    out[key] = {
      total,
      unsoulbound: Number(value.unsoulboundTotal) || 0,
    };
  }
  return out;
}

async function computeProfile(
  profile: SkyblockProfile,
  uuid: string
): Promise<ProfileNetworth | null> {
  const member = findMember(profile, uuid);
  if (!member) return null;

  const profileId = String(profile.profile_id ?? '');
  let museumData: object | undefined;
  if (profileId) {
    const museum = await getMuseum(profileId);
    if (museum.ok) {
      const undashed = uuid.replace(/-/g, '').toLowerCase();
      const museumKey = Object.keys(museum.data.members).find(
        (k) => k.replace(/-/g, '').toLowerCase() === undashed
      );
      if (museumKey) {
        museumData = museum.data.members[museumKey] as object;
      }
    }
  }

  const bankBalance = Number(profile.banking?.balance) || 0;
  const calc = new ProfileNetworthCalculator(member, museumData, bankBalance);
  const nw = await calc.getNetworth({ onlyNetworth: true });

  const total = Number(nw.networth);
  if (!Number.isFinite(total)) return null;

  return {
    profileId: profileId || 'unknown',
    cuteName: String(profile.cute_name ?? 'Unknown').slice(0, 16),
    gameMode: typeof profile.game_mode === 'string' ? profile.game_mode : null,
    current: profile.selected === true,
    networth: total,
    unsoulbound: Number(nw.unsoulboundNetworth) || 0,
    purse: Number(nw.purse) || 0,
    bank: Number(nw.bank) || bankBalance,
    personalBank: Number(nw.personalBank) || 0,
    noInventory: nw.noInventory === true,
    types: projectTypes(nw.types),
  };
}

function pickRichest(profiles: ProfileNetworth[]): ProfileNetworth | null {
  if (profiles.length === 0) return null;
  return profiles.reduce((best, profile) => (profile.networth > best.networth ? profile : best));
}

/**
 * Looks up a player's SkyBlock networth on their richest profile.
 *
 * @param username Minecraft username
 * @param requesterKey Cooldown key (e.g. Discord user id)
 */
export async function lookupNetworth(
  username: string,
  requesterKey: string
): Promise<NetworthLookupResult> {
  const now = Date.now();
  const last = lastAsk.get(requesterKey) ?? 0;
  if (now - last < COOLDOWN_MS) {
    return {
      ok: false,
      code: 'cooldown',
      retryAfterMs: COOLDOWN_MS - (now - last),
    };
  }
  lastAsk.set(requesterKey, now);
  pruneMap(lastAsk, CACHE_LIMIT);

  const nameKey = String(username ?? '')
    .trim()
    .toLowerCase();
  if (!nameKey) return { ok: false, code: 'unknown-player' };

  const cached = cache.get(nameKey);
  if (cached && cached.expiresAt > now) return cached.result;

  let profile: Awaited<ReturnType<typeof lookupProfile>>;
  try {
    profile = await lookupProfile(username.trim());
  } catch {
    const result: NetworthLookupResult = { ok: false, code: 'mojang-error' };
    cachePut(nameKey, result);
    return result;
  }

  if (!profile) {
    const result: NetworthLookupResult = {
      ok: false,
      code: 'unknown-player',
      detail: username.trim(),
    };
    cachePut(nameKey, result);
    return result;
  }

  const profilesResult = await getSkyblockProfiles(profile.uuid);
  if (!profilesResult.ok) {
    const result: NetworthLookupResult = {
      ok: false,
      code: profilesResult.code,
      detail: profile.name,
    };
    cachePut(nameKey, result);
    return result;
  }

  const computed: ProfileNetworth[] = [];
  try {
    for (const sbProfile of profilesResult.data.profiles) {
      const entry = await computeProfile(sbProfile, profile.uuid);
      if (entry) computed.push(entry);
    }
  } catch (error) {
    console.error('Networth calculation failed:', error);
    const result: NetworthLookupResult = { ok: false, code: 'calc-error' };
    cachePut(nameKey, result);
    return result;
  }

  const best = pickRichest(computed);
  if (!best) {
    const result: NetworthLookupResult = {
      ok: false,
      code: 'no-networth',
      detail: profile.name,
    };
    cachePut(nameKey, result);
    return result;
  }

  const result: NetworthLookupResult = {
    ok: true,
    player: { name: profile.name, uuid: profile.uuid },
    best,
    profiles: computed.sort((a, b) => b.networth - a.networth),
  };
  cachePut(nameKey, result);
  return result;
}

export function formatCoins(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(2)}T`;
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${Math.floor(abs).toLocaleString('en-US')}`;
}

export function formatExact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.floor(value).toLocaleString('en-US');
}
