import { randomInt } from 'node:crypto';
import mc, { type Server } from 'minecraft-protocol';

/**
 * Account verification for `/link`.
 *
 * A small online-mode Minecraft server: a player joins it, Mojang's session
 * server confirms they own the account they joined with, and they are kicked
 * straight away with a six-digit code. Typing it into `/link`'s **Enter code**
 * form in Discord then links that account. Nobody ever loads into a world, and no Minecraft account
 * of the bot's is involved: this is a server, not a client.
 *
 * Without verification, `/link` takes anybody's name on trust, so a
 * member could claim somebody else's account and get their nickname and role.
 *
 * Switched on by `VERIFY_SERVER_PORT` and `VERIFY_SERVER_ADDRESS` together;
 * with either missing, `/link` falls back to taking the username as given.
 */

/** How long a code stays valid. */
const CODE_TTL_MS = 5 * 60 * 1000;

/** Wrong codes a Discord user may try per window before being made to wait. */
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

type PendingCode = { uuid: string; name: string; expiresAt: number };

const codes = new Map<string, PendingCode>();
const attempts = new Map<string, { count: number; windowStart: number }>();

let server: Server | null = null;
let listening = false;

/**
 * The address members are told to join, or null when verification is off.
 */
export function verificationAddress(): string | null {
  const address = process.env.VERIFY_SERVER_ADDRESS?.trim();
  return address && listening ? address : null;
}

function dropExpired(now: number): void {
  for (const [code, pending] of codes) {
    if (pending.expiresAt <= now) codes.delete(code);
  }
}

/**
 * Issues a code for a verified account, replacing any code that account still
 * had, so only the latest join counts.
 */
function issueCode(uuid: string, name: string): string {
  const now = Date.now();
  dropExpired(now);
  for (const [code, pending] of codes) {
    if (pending.uuid === uuid) codes.delete(code);
  }

  let code: string;
  do {
    code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  } while (codes.has(code));

  codes.set(code, { uuid, name, expiresAt: now + CODE_TTL_MS });
  return code;
}

export type RedeemResult =
  | { ok: true; uuid: string; name: string }
  | { ok: false; reason: 'invalid' | 'rate_limited' }
  | { ok: false; reason: 'wrong_account'; name: string };

/**
 * Exchanges a code for the account it was issued to. A code works once.
 *
 * Wrong guesses are limited per Discord user: a code is the only thing
 * standing between a member and somebody else's account, and a million
 * combinations is not many without a limit.
 *
 * A code issued to a different account than the member said they would link
 * is refused and left in place, so the member who joined can still use it.
 * It counts as a wrong guess: otherwise naming any account would make every
 * live code free to probe.
 *
 * @param discordId - Whoever is redeeming it.
 * @param input - The code as typed.
 * @param expectedUuid - The account the member asked to link, undashed.
 */
export function redeemCode(discordId: string, input: string, expectedUuid: string): RedeemResult {
  const now = Date.now();
  const tries = attempts.get(discordId);
  if (tries && now - tries.windowStart < ATTEMPT_WINDOW_MS && tries.count >= MAX_ATTEMPTS) {
    return { ok: false, reason: 'rate_limited' };
  }

  const countAttempt = () => {
    if (!tries || now - tries.windowStart >= ATTEMPT_WINDOW_MS) {
      attempts.set(discordId, { count: 1, windowStart: now });
    } else {
      tries.count += 1;
    }
  };

  dropExpired(now);
  const code = input.replace(/\s/g, '');
  const pending = codes.get(code);
  if (!pending) {
    countAttempt();
    return { ok: false, reason: 'invalid' };
  }
  if (pending.uuid !== expectedUuid.replace(/-/g, '').toLowerCase()) {
    countAttempt();
    return { ok: false, reason: 'wrong_account', name: pending.name };
  }

  codes.delete(code);
  attempts.delete(discordId);
  return { ok: true, uuid: pending.uuid, name: pending.name };
}

/**
 * Starts the verification server when it is configured. Never throws: a port
 * that cannot be bound leaves `/link` on the unverified path and is logged.
 */
export function startVerificationServer(): void {
  const port = Number(process.env.VERIFY_SERVER_PORT);
  if (!process.env.VERIFY_SERVER_ADDRESS?.trim() || !Number.isInteger(port) || port <= 0) {
    console.log('Link verification server is off (VERIFY_SERVER_PORT / VERIFY_SERVER_ADDRESS).');
    return;
  }

  try {
    server = mc.createServer({
      port,
      'online-mode': true,
      // Accept whatever version the player's client speaks: they only ever
      // reach the login step, which every supported version can complete.
      version: false,
      // A client newer than this library knows is still tried as the newest
      // version it does know, rather than turned away.
      fallbackVersion: mc.defaultVersion,
      motd: 'Account verification - join to get your /link code',
      // The server list shows any version the server does not report as its
      // own as incompatible, which tells a member on a release newer than this
      // library ("Outdated server") not to bother joining. Reporting the
      // client's own protocol keeps every release joinable from the list (the
      // name is only shown for an incompatible server); the login step it then
      // goes through is the same across them.
      beforePing: (response, client) => {
        response.version.protocol = client.protocolVersion;
        return response;
      },
      maxPlayers: 100,
      hideErrors: true,
      errorHandler: (client) => client.end('Something went wrong, please try again.'),
      beforeLogin: (client) => {
        const code = issueCode(client.uuid.replace(/-/g, '').toLowerCase(), client.username);
        console.log(`Issued a link code to ${client.username}.`);
        // The server's own `end` takes a second, preformatted reason, which
        // the library's typings leave out; without it the code would show up
        // as raw JSON on the player's screen.
        const kick = client.end as unknown as (reason: string, fullReason: string) => void;
        kick.call(
          client,
          '',
          JSON.stringify({
            text: '',
            extra: [
              { text: 'Your link code is\n\n', color: 'gray' },
              { text: `${code}\n\n`, color: 'green', bold: true },
              { text: 'Click ', color: 'gray' },
              { text: 'Enter code', color: 'white' },
              {
                text: ' under your /link message in Discord.\nIt expires in 5 minutes.',
                color: 'gray',
              },
            ],
          })
        );
        // Ending here, inside the login step, is the point; the library goes on
        // to write the login packets after this hook returns, into a stream
        // that has just been closed. Dropping those writes keeps that from
        // surfacing as an error for every single code.
        client.write = () => {};
      },
    });
  } catch (error) {
    console.error('Could not start the link verification server:', error);
    return;
  }

  server.on('listening', () => {
    listening = true;
    console.log(`Link verification server listening on port ${port}.`);
  });
  server.on('error', (error) => {
    listening = false;
    console.error('Link verification server error:', error);
  });
}

/**
 * Stops the verification server, if it runs. Part of the graceful shutdown.
 */
export function stopVerificationServer(): void {
  if (!server) return;
  listening = false;
  server.close();
  server = null;
}
