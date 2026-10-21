/**
 * One-time import of the JSON files TriBridge kept before account linking,
 * admin roles and feature requests moved to this bot.
 *
 *   yarn legacy:import --dir <folder> --guild <discord server id> [--dry-run]
 *
 * Reads `linkedAccountsConfig.json`, `adminRolesConfig.json` and
 * `featureRequestsConfig.json` from the folder; a missing file is skipped.
 * `linkRoleConfig.json` is ignored: this bot hands out no link role. It only adds: an existing link, role, setting or
 * request is left as it is, so running it twice changes nothing the second
 * time. Output names counts and ids, never a Minecraft account's details.
 *
 * The files carry no Discord server id (TriBridge served exactly one), so it
 * is passed with `--guild`.
 */
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { closePrismaConnection, prisma } from '../src/utils/prisma.js';

interface LegacyRequest {
  id: number;
  userId: string;
  userTag?: string;
  title: string;
  description: string;
  status?: string;
  channelId?: string | null;
  messageId?: string | null;
  handledBy?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

function parseArgs(argv: string[]) {
  const args = { dir: '', guild: '', dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') args.dir = argv[++i] ?? '';
    else if (argv[i] === '--guild') args.guild = argv[++i] ?? '';
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  if (!args.dir || !/^\d{17,20}$/.test(args.guild)) {
    console.error('Usage: yarn legacy:import --dir <folder> --guild <discord server id> [--dry-run]');
    process.exit(1);
  }
  return args;
}

function readJson<T>(dir: string, name: string): T | null {
  const file = path.join(dir, name);
  if (!existsSync(file)) {
    console.log(`- ${name}: not found, skipped`);
    return null;
  }
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

/**
 * The `User` row for a Discord id, created when missing. The username is a
 * placeholder (the Discord id) until the bot's next startup, when
 * `refreshUsernames` fetches the real one by id.
 */
async function userFor(discordId: string, username?: string) {
  return prisma.user.upsert({
    where: { discordId },
    update: {},
    create: { discordId, username: username || discordId },
  });
}

async function importLinks(dir: string, dryRun: boolean) {
  const file = readJson<{ links: Record<string, { name: string; uuid: string }> }>(
    dir,
    'linkedAccountsConfig.json'
  );
  if (!file) return;
  const entries = Object.entries(file.links ?? {});
  if (dryRun) {
    console.log(`✓ linkedAccountsConfig.json: ${entries.length} link(s)`);
    return;
  }

  let added = 0;
  let kept = 0;
  const conflicts: string[] = [];
  for (const [discordId, link] of entries) {
    const uuid = link.uuid.replace(/-/g, '').toLowerCase();
    const user = await userFor(discordId);
    const existing = await prisma.minecraftLink.findFirst({
      where: { OR: [{ userId: user.id }, { uuid }] },
    });
    if (existing) {
      if (existing.userId === user.id && existing.uuid === uuid) kept++;
      else conflicts.push(discordId);
      continue;
    }
    await prisma.minecraftLink.create({ data: { userId: user.id, uuid, name: link.name } });
    added++;
  }
  console.log(`✓ links: ${added} added, ${kept} already there, ${conflicts.length} conflict(s)`);
  // A conflict means the database already holds a different link for that
  // member or that account, made with /link since. The newer one wins.
  if (conflicts.length > 0) console.log(`  kept the existing link for: ${conflicts.join(', ')}`);
}

async function importAdminRoles(dir: string, guildId: string, dryRun: boolean) {
  const file = readJson<{ roleIds: string[] }>(dir, 'adminRolesConfig.json');
  if (!file) return;
  const roleIds = file.roleIds ?? [];
  if (dryRun) {
    console.log(`✓ adminRolesConfig.json: ${roleIds.length} role(s)`);
    return;
  }
  const { count } = await prisma.adminRole.createMany({
    data: roleIds.map((roleId) => ({ guildId, roleId })),
    skipDuplicates: true,
  });
  console.log(`✓ admin roles: ${count} added, ${roleIds.length - count} already there`);
}

/** Sets one `Setup` column only when it is still empty. */
async function setIfUnset(
  guildId: string,
  column: 'requestChannelId',
  value: string | null | undefined,
  label: string
) {
  if (!value) return;
  const setup = await prisma.setup.upsert({ where: { guildId }, update: {}, create: { guildId } });
  if (setup[column]) {
    console.log(`✓ ${label}: already set, kept`);
    return;
  }
  await prisma.setup.update({ where: { guildId }, data: { [column]: value } });
  console.log(`✓ ${label}: set`);
}

async function importRequests(dir: string, guildId: string, dryRun: boolean) {
  const file = readJson<{ channelId?: string | null; requests?: Record<string, LegacyRequest> }>(
    dir,
    'featureRequestsConfig.json'
  );
  if (!file) return;
  const requests = Object.values(file.requests ?? {});
  if (dryRun) {
    console.log(
      `✓ featureRequestsConfig.json: ${requests.length} request(s), ` +
        `${file.channelId ? 'a' : 'no'} request channel`
    );
    return;
  }

  await setIfUnset(guildId, 'requestChannelId', file.channelId, 'request channel');

  let added = 0;
  for (const request of requests) {
    // Ids are kept: they are the numbers members already know these by.
    if (await prisma.featureRequest.findUnique({ where: { id: request.id } })) continue;
    const user = await userFor(request.userId, request.userTag);
    await prisma.featureRequest.create({
      data: {
        id: request.id,
        guildId,
        userId: user.id,
        title: request.title,
        description: request.description,
        status: request.status ?? 'pending',
        channelId: request.channelId ?? null,
        messageId: request.messageId ?? null,
        handledById: request.handledBy ?? null,
        createdAt: request.createdAt ? new Date(request.createdAt) : undefined,
        updatedAt: request.updatedAt ? new Date(request.updatedAt) : undefined,
      },
    });
    added++;
  }

  // Inserting explicit ids leaves the sequence behind them, and the next
  // /request would then collide with an imported number.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"FeatureRequest"', 'id'),
            GREATEST((SELECT COALESCE(MAX(id), 0) FROM "FeatureRequest"), 1))`
  );
  console.log(`✓ feature requests: ${added} added, ${requests.length - added} already there`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = path.resolve(args.dir);
  console.log(`${args.dryRun ? 'Checking' : 'Importing'} legacy files from ${dir}`);
  await importLinks(dir, args.dryRun);
  await importAdminRoles(dir, args.guild, args.dryRun);
  await importRequests(dir, args.guild, args.dryRun);
}

main()
  .catch((error) => {
    console.error('Import failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closePrismaConnection());
