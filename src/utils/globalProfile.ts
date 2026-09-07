import type { GlobalProfileEffect } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

// setTimeout keeps its delay in a signed 32-bit int and fires *immediately* if
// handed anything larger, so long effects re-arm in chunks of this size.
const MAX_TIMEOUT = 2 ** 31 - 1;

export type GlobalProfileMode = 'off' | 'test' | 'live';

export interface GlobalProfileTarget {
  userId: string;
  name: string;
  avatarURL: string | null;
  /** Minecraft name, when the target has a link. Guild chat is told this one. */
  mcName: string | null;
  mcUuid: string | null;
}

export interface GlobalProfileState {
  mode: GlobalProfileMode;
  target: GlobalProfileTarget | null;
  startedById: string | null;
  startedAt: Date | null;
  /** Null while an effect runs means "until somebody stops it". */
  expiresAt: Date | null;
  testerIds: string[];
  testChannelIds: string[];
  excludedChannelIds: string[];
  disguiseToMinecraft: boolean;
  disguiseToDiscord: boolean;
}

/**
 * The running global profile change, per Discord server.
 *
 * The gate below runs on every message in the server, so the row is cached and
 * this process — the only writer — invalidates it on write. TriBridge reads the
 * same row to disguise its two bridge legs, which is why the two direction
 * switches live here rather than only in the panel: they are settings the bridge
 * consults, not part of a run.
 */
const cache = new Map<string, GlobalProfileState>();
const expiryTimers = new Map<string, NodeJS.Timeout>();

function toState(row: GlobalProfileEffect): GlobalProfileState {
  return {
    mode: (row.mode as GlobalProfileMode) ?? 'off',
    target: row.targetUserId
      ? {
          userId: row.targetUserId,
          name: row.targetName ?? 'Unknown',
          avatarURL: row.targetAvatarUrl,
          mcName: row.targetMcName,
          mcUuid: row.targetMcUuid,
        }
      : null,
    startedById: row.startedById,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    testerIds: [...row.testerIds],
    testChannelIds: [...row.testChannelIds],
    excludedChannelIds: [...row.excludedChannelIds],
    disguiseToMinecraft: row.disguiseToMinecraft,
    disguiseToDiscord: row.disguiseToDiscord,
  };
}

function copy(state: GlobalProfileState): GlobalProfileState {
  return {
    ...state,
    target: state.target ? { ...state.target } : null,
    testerIds: [...state.testerIds],
    testChannelIds: [...state.testChannelIds],
    excludedChannelIds: [...state.excludedChannelIds],
  };
}

/**
 * @returns A copy of the stored state, safe to read from without reaching into
 *   the cache. Creates the row at its defaults on first use.
 */
export async function getState(guildId: string): Promise<GlobalProfileState> {
  const cached = cache.get(guildId);
  if (cached) return copy(cached);

  const row = await prisma.globalProfileEffect.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  const state = toState(row);
  cache.set(guildId, state);
  return copy(state);
}

type EffectWrite = Partial<Omit<GlobalProfileEffect, 'id' | 'guildId' | 'createdAt' | 'updatedAt'>>;

/**
 * Writes columns and refreshes the cache.
 *
 * The same object is handed to `update` and `create` — every caller passes plain
 * values rather than Prisma's update operators, so a row that has gone missing
 * is recreated with the write applied rather than silently losing it.
 */
async function write(guildId: string, data: EffectWrite): Promise<GlobalProfileState> {
  const row = await prisma.globalProfileEffect.upsert({
    where: { guildId },
    update: data,
    create: { guildId, ...data },
  });

  const state = toState(row);
  cache.set(guildId, state);
  return copy(state);
}

/**
 * Whether a global profile change is running right now.
 *
 * This is the authoritative check, not the expiry timer: a lapsed effect is
 * cleared here on read, so a timer lost to a restart or a clock jump can never
 * leave the disguise stuck on.
 */
export async function isActive(guildId: string): Promise<boolean> {
  const state = await getState(guildId);
  if (state.mode === 'off' || !state.target) return false;

  if (state.expiresAt !== null && Date.now() >= state.expiresAt.getTime()) {
    await stop(guildId);
    return false;
  }

  return true;
}

/**
 * @returns The identity everybody is currently being shown as, or null.
 */
export async function getTarget(guildId: string): Promise<GlobalProfileTarget | null> {
  const state = await getState(guildId);
  return state.target;
}

/**
 * The gate for one Discord message.
 *
 * Called once per message, so it stays cheap: a cached read and two array
 * lookups, with no database round trip after the first.
 *
 * @param guildId - Discord server the message was sent in.
 * @param userId - Author of the message.
 * @param channelId - Channel the message was sent in.
 */
export async function appliesTo(
  guildId: string,
  userId: string,
  channelId: string
): Promise<boolean> {
  if (!(await isActive(guildId))) return false;

  const state = await getState(guildId);
  if (!state.target) return false;

  // They already wear that face; reposting would cost a send and a delete to
  // produce exactly the same message.
  if (userId === state.target.userId) return false;

  if (state.mode === 'test') {
    return state.testerIds.includes(userId) && state.testChannelIds.includes(channelId);
  }

  return !state.excludedChannelIds.includes(channelId);
}

/**
 * Begins a global profile change.
 *
 * The target's identity is snapshotted rather than looked up per message: the
 * gate runs on every message in the server and must not fetch a member.
 *
 * @param options.durationMs - Null runs until somebody stops it.
 */
export async function start(
  guildId: string,
  options: {
    target: GlobalProfileTarget;
    durationMs: number | null;
    startedById: string;
    mode: 'test' | 'live';
  }
): Promise<GlobalProfileState> {
  const { target, durationMs, startedById, mode } = options;

  return write(guildId, {
    mode,
    targetUserId: target.userId,
    targetName: target.name,
    targetAvatarUrl: target.avatarURL,
    targetMcName: target.mcName,
    targetMcUuid: target.mcUuid,
    startedById,
    startedAt: new Date(),
    expiresAt: durationMs === null ? null : new Date(Date.now() + durationMs),
  });
}

/**
 * Ends the effect, leaving the tester and channel lists and the two bridge
 * switches intact so the next run does not have to be set up from scratch.
 *
 * @returns What was running, for whoever announces the end.
 */
export async function stop(guildId: string): Promise<GlobalProfileState> {
  const previous = await getState(guildId);

  await write(guildId, {
    mode: 'off',
    targetUserId: null,
    targetName: null,
    targetAvatarUrl: null,
    targetMcName: null,
    targetMcUuid: null,
    startedById: null,
    startedAt: null,
    expiresAt: null,
  });

  clearExpiry(guildId);
  return previous;
}

export function clearExpiry(guildId: string): void {
  const timer = expiryTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    expiryTimers.delete(guildId);
  }
}

/**
 * Schedules `onEnd` for when the running effect lapses.
 *
 * The timer exists only to *announce* the end and is safe to miss —
 * {@link isActive} is what actually decides whether the disguise applies.
 *
 * @param onEnd - Handed the state that just ended.
 */
export async function armExpiry(
  guildId: string,
  onEnd: (previous: GlobalProfileState) => void | Promise<void>
): Promise<void> {
  clearExpiry(guildId);

  const state = await getState(guildId);
  if (state.mode === 'off' || state.expiresAt === null) return;

  const remaining = state.expiresAt.getTime() - Date.now();
  if (remaining <= 0) {
    await onEnd(await stop(guildId));
    return;
  }

  const timer = setTimeout(() => {
    expiryTimers.delete(guildId);

    void (async () => {
      const current = await getState(guildId);
      if (current.mode === 'off') return;

      if (current.expiresAt !== null && Date.now() >= current.expiresAt.getTime()) {
        await onEnd(await stop(guildId));
        return;
      }

      // Only a chunk of a longer wait has elapsed; queue the next one.
      await armExpiry(guildId, onEnd);
    })();
  }, Math.min(remaining, MAX_TIMEOUT));

  timer.unref?.();
  expiryTimers.set(guildId, timer);
}

type ListKey = 'testerIds' | 'testChannelIds' | 'excludedChannelIds';

/**
 * Replaces one of the scope lists wholesale — the panel's select menus hand
 * back the full selection rather than a single addition.
 */
export async function setList(
  guildId: string,
  key: ListKey,
  ids: string[]
): Promise<GlobalProfileState> {
  const unique = [...new Set(ids.map(String))];

  if (key === 'testerIds') return write(guildId, { testerIds: unique });
  if (key === 'testChannelIds') return write(guildId, { testChannelIds: unique });
  return write(guildId, { excludedChannelIds: unique });
}

export const setTesters = (guildId: string, ids: string[]): Promise<GlobalProfileState> =>
  setList(guildId, 'testerIds', ids);
export const setTestChannels = (guildId: string, ids: string[]): Promise<GlobalProfileState> =>
  setList(guildId, 'testChannelIds', ids);
export const setExcludedChannels = (guildId: string, ids: string[]): Promise<GlobalProfileState> =>
  setList(guildId, 'excludedChannelIds', ids);

/**
 * Switches one leg of the bridge disguise on or off.
 *
 * Kept out of {@link start} and {@link stop} on purpose: like the tester and
 * channel lists, this is settings rather than part of a run, so it survives an
 * effect ending and applies to the next one. TriBridge reads both columns and
 * is the only thing that acts on them.
 */
export async function setDirection(
  guildId: string,
  key: 'disguiseToMinecraft' | 'disguiseToDiscord',
  enabled: boolean
): Promise<GlobalProfileState> {
  return key === 'disguiseToMinecraft'
    ? write(guildId, { disguiseToMinecraft: Boolean(enabled) })
    : write(guildId, { disguiseToDiscord: Boolean(enabled) });
}

/** Drops a cached row. Only needed when something outside this process wrote it. */
export function clearGlobalProfileCache(guildId?: string): void {
  if (guildId) cache.delete(guildId);
  else cache.clear();
}
