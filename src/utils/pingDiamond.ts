import { createHash } from 'node:crypto';
import type { Guild, SendableChannels } from 'discord.js';
import { bot } from '../bot.js';
import { logGlobal } from './logChannel.js';
import { prisma } from './prisma.js';
import { clearSetupCache, getSetup } from './setup.js';

/**
 * The one member `/pingdiamond` pings, from `PINGDIAMOND_USER_ID`. Read on
 * every run rather than at import, so a changed `.env` needs only a restart.
 *
 * @returns The id, or null when unset or not shaped like a Discord id.
 */
export function pingDiamondTarget(): string | null {
  const id = process.env.PINGDIAMOND_USER_ID?.trim();
  return id && /^\d{17,20}$/.test(id) ? id : null;
}

/**
 * Pings the member and deletes the message straight away: the notification
 * has already gone out, and nothing is left behind in the channel.
 *
 * @throws When the ping can't be sent.
 * @returns Whether the ping was also deleted. A bot can always delete its own
 *   message, so this is only false when it was already gone.
 */
export async function ghostPing(channel: SendableChannels, id: string): Promise<boolean> {
  const ping = await channel.send({
    content: `<@${id}>`,
    // Only ever the configured member: nothing else in this message may ping,
    // whatever the environment variable is set to.
    allowedMentions: { users: [id] },
  });

  try {
    await ping.delete();
    return true;
  } catch (error) {
    console.error('/pingdiamond could not delete its ping:', error);
    return false;
  }
}

/** Random pings land between 09:00 and 21:00 UTC, never at night. */
const WINDOW_START_MINUTE = 9 * 60;
const WINDOW_MINUTES = 12 * 60;
/** A ping more than this late (the bot was down) is skipped, not sent late. */
const GRACE_MS = 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_PINGS_PER_WEEK = 3;

/** Monday 00:00 UTC of the week `now` falls in. */
function weekStart(now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

/**
 * This week's random ping times for a server: one to three of them, at most
 * {@link MAX_PINGS_PER_WEEK}. They come from a hash of the server and the week
 * rather than `Math.random()`, so a restart works out the same times again
 * instead of drawing new ones, which could add up to more than three a week.
 */
export function weeklySchedule(guildId: string, now = new Date()): Date[] {
  const start = weekStart(now);
  const bytes = createHash('sha256')
    .update(`${guildId}:${start.toISOString()}:pingdiamond`)
    .digest();

  const count = 1 + (bytes[0] % MAX_PINGS_PER_WEEK);
  const times: Date[] = [];
  for (let i = 0; i < count; i++) {
    const day = bytes[1 + i * 3] % 7;
    const minute = WINDOW_START_MINUTE + (bytes.readUInt16BE(2 + i * 3) % WINDOW_MINUTES);
    times.push(new Date(start.getTime() + day * 24 * 60 * 60 * 1000 + minute * 60 * 1000));
  }
  return times.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Sends the random ping that is due in a server, if any.
 *
 * A ping is claimed in the database before it is sent, with a conditional
 * update on `pingDiamondLastAt`. Without that, a restart inside the check
 * interval could send the same scheduled ping twice.
 */
async function runDuePing(guild: Guild): Promise<void> {
  const id = pingDiamondTarget();
  if (!id) return;

  const setup = await getSetup(guild.id);
  if (!setup.pingDiamondChannelId) return;

  const now = Date.now();
  const due = weeklySchedule(guild.id)
    .filter((t) => t.getTime() <= now)
    .filter((t) => !setup.pingDiamondLastAt || t > setup.pingDiamondLastAt)
    .at(-1);
  if (!due) return;

  const claimed = await prisma.setup.updateMany({
    where: {
      guildId: guild.id,
      OR: [{ pingDiamondLastAt: null }, { pingDiamondLastAt: { lt: due } }],
    },
    data: { pingDiamondLastAt: due },
  });
  clearSetupCache(guild.id);
  if (claimed.count === 0) return;

  // Claimed but not sent: the bot was down when this one was due.
  if (now - due.getTime() > GRACE_MS) return;

  const channel = guild.channels.cache.get(setup.pingDiamondChannelId);
  if (!channel?.isSendable()) {
    console.warn(`Random /pingdiamond: I cannot post in channel ${setup.pingDiamondChannelId}.`);
    return;
  }

  const deleted = await ghostPing(channel, id);
  await logGlobal(guild.id, {
    content: `👻 Random \`/pingdiamond\` in <#${channel.id}>${
      deleted ? '' : ', but the ping could not be deleted. Remove it by hand.'
    }`,
    allowedMentions: { parse: [] },
  });
}

/**
 * Starts the check for random pings, every five minutes. Kept on `globalThis`
 * so the hot reload in `dev.ts` replaces the timer instead of adding a second
 * one, which would check twice as often but still send each ping once.
 */
export function startPingDiamondSchedule(): void {
  const key = Symbol.for('thg.pingDiamondTimer');
  const store = globalThis as unknown as Record<symbol, NodeJS.Timeout | undefined>;
  if (store[key]) clearInterval(store[key]);

  const tick = () => {
    for (const guild of bot.guilds.cache.values()) {
      runDuePing(guild).catch((error) => console.error('Random /pingdiamond failed:', error));
    }
  };
  store[key] = setInterval(tick, CHECK_INTERVAL_MS);
  tick();
}
