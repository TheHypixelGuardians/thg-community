# BOT.md — THG Community

> Brief written 2026-10-12 from the code on `origin/main` (2b28b80, PR #4 merged). Lines marked *(fill in)*
> could not be read from the code.

## Purpose
The Discord-side bot for the THG Hypixel SkyBlock guild community: member profiles, Minecraft account
linking, bot-admin roles, feature requests and SkyBlock lookups, with moderation and tickets planned. It is
**not** a Minecraft bridge. Anything that needs a Minecraft client belongs to TriBridge.

## Repo and location
- GitHub: https://github.com/TheHypixelGuardians/thg-community (fork: https://github.com/Trilleo/thg-community)
- Local: `Discord-Projecten/THG/thg-community`

## Scope
- One server: the THG community. Commands register to every guild the bot is in (`botGuilds` = cached guilds).
- **Commands:** `skyblock`, `networth` (Hypixel API, skyhelper-networth); `link`, `unlink`, `whois`, `links`, `setrank`;
  `request`, `requestchannel`, `requeststatus`; `adminrole`, `setup`, `pingdiamond`; `help`, `info`, `ping`, `profile`.
- Honours the shared blacklist written by TriBridge's `/blacklist`: listed members can't use any command.
- The admin panel, the global profile change and auditing stay on TriBridge.
- Planned, as a separate round with its own plan: moderation, tickets, automod (the `Setup` model already has
  their columns).
- English-only.

## Template parts
Built from `bot-template` (discordx 11, Prisma **7** with `@prisma/adapter-pg`, Biome, Yarn, Docker).

| Part | Status |
|---|---|
| Core, slash commands, help | Kept |
| Database | Kept, schema replaced: `User`, `Setup`, `MinecraftLink`, `AdminRole`, `FeatureRequest` |
| Localization | Removed 2026-10-12: English-only, strings are plain literals (wording unchanged); `User.language` dropped by a migration 2026-10-21 |
| SheetDB | Removed 2026-10-12: `sheetdb.ts` had no importer, `axios` no other user; `SHEETDB_*` env vars gone |
| Prefix commands | Removed 2026-10-12: no `@SimpleCommand` existed; `messageCreate.ts`, `simpleCommand` and the GuildMessages and MessageContent intents went with them |
| Error log channel | Kept |
| Docker | Kept; the image installs from `yarn.lock`, generates the Prisma client and applies migrations on start. Compose uses the shared database; its Postgres is a `local-db` dev profile |
| CI | Added 2026-10-20: lint, build, migrations applied to a fresh Postgres, schema/migration drift check |
| Secret scanning | Added 2026-10-12: gitleaks pre-commit hook, `Secret scan` workflow, `prepare` script that leaves a configured `core.hooksPath` alone |

## Intents
Guilds only (2026-10-21: GuildMembers dropped with the link role; the community bot gives no roles or
nicknames, another bot does). MessageContent
can be switched off in the Developer Portal. GuildMessageReactions and GuildVoiceStates were dropped: nothing
handles reactions or voice.

## Env vars
`DISCORD_TOKEN`, `DATABASE_URL`, `ERROR_LOG_CHANNEL_ID`, `LOG_CHANNEL_ID`, `HYPIXEL_API_KEY`, `NODE_ENV`.
`.env.example`, `environment.d.ts` and the README list the same set;
Compose reads `.env` through `env_file` and overrides only `DATABASE_URL`.

## Data model
PostgreSQL through Prisma 7 (client generated to `src/generated/prisma`), applied with **migrations**
(`prisma migrate deploy`; `0_init` is the baseline of the pushed schema).
The database is **shared with TriBridge**, along with the `Blacklist` and `AdminRole` tables: this bot owns
the `public` schema, TriBridge writes `Blacklist` and reads `AdminRole` with plain SQL, and keeps its own data
(links included) in a separate `tribridge` schema (see `SHARED_DATABASE.md`).
- `User`: discordId, username
- `Setup`: per Discord server; ticket and automod columns, plus request channel and log channel (the old `linkRoleId` column is unused)
- `MinecraftLink`: a member's Minecraft UUID, name and hand-set `rank` (`/setrank`), related to `User.id`
- `AdminRole`: the bot-admin roles per Discord server
- `FeatureRequest`: `/request` submissions, numbered by a sequence
- `Blacklist`: members barred from both bots, keyed on Discord id. Written by TriBridge, read here

## Hosting
zVapor's Pterodactyl panel, sharing one Neon Postgres database with TriBridge (use the direct, non-pooled
connection string). Docker Compose remains for self-hosting.

## Decisions made
- Kept separate from TriBridge, which handles the Minecraft side.
- One shared database with TriBridge; this bot owns the schema.
- Changelogs use the SkyHanni format, same as TriBridge (see `CLAUDE.md`).
- Networth lookups moved here from TriBridge.
- Blacklist (2026-10-20): the command lives on TriBridge, which writes the `Blacklist` table; this bot reads it
  and fails open.
- Migrations replace `db push` (2026-10-20), because the shared database holds data worth keeping.
