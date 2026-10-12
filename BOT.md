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
- **Commands:** `skyblock`, `networth` (Hypixel API, skyhelper-networth); `link`, `unlink`, `whois`, `links`,
  `linkrole`; `request`, `requestchannel`, `requeststatus`; `adminrole`; `help`, `info`, `ping`, `profile`.
- The admin panel, the global profile change and auditing stay on TriBridge.
- Planned: moderation, tickets, automod (the `Setup` model already has their columns).
- English-only.

## Template parts
Built from `bot-template` (discordx 11, Prisma **7** with `@prisma/adapter-pg`, Biome, Yarn, Docker).

| Part | Status |
|---|---|
| Core, slash commands, help | Kept |
| Database | Kept, schema replaced: `User`, `Setup`, `MinecraftLink`, `AdminRole`, `FeatureRequest` |
| Localization | `localization.ts` with one English table, used by `/skyblock`, `/networth` and the statuses |
| SheetDB | Removed 2026-10-12: `sheetdb.ts` had no importer, `axios` no other user; `SHEETDB_*` env vars gone |
| Prefix commands | `messageCreate.ts`, `simpleCommand` and the MessageContent intent are present |
| Error log channel | Kept |
| Docker | Kept (app + postgres:16); the image installs from `yarn.lock` and generates the Prisma client |
| Secret scanning | Added 2026-10-12: gitleaks pre-commit hook, `Secret scan` workflow, `prepare` script that leaves a configured `core.hooksPath` alone |

## Intents
Guilds, **GuildMembers (privileged)**, GuildMessages, GuildMessageReactions, GuildVoiceStates,
**MessageContent (privileged)**.

## Env vars
`DISCORD_TOKEN`, `DATABASE_URL`, `ERROR_LOG_CHANNEL_ID`, `LOG_CHANNEL_ID`, `HYPIXEL_API_KEY`, `NODE_ENV`.
`.env.example`, `environment.d.ts` and the README list the same set;
Compose reads `.env` through `env_file` and overrides only `DATABASE_URL`.

## Data model
PostgreSQL through Prisma 7 (client generated to `src/generated/prisma`), applied with `prisma db push`.
The database is **shared with TriBridge**: this bot owns the `public` schema, TriBridge reads `User`,
`MinecraftLink` and `AdminRole` with plain SQL and keeps its own data in a separate `tribridge` schema
(see `SHARED_DATABASE.md`).
- `User`: discordId, username, language (default `nl`, never read)
- `Setup`: per Discord server; ticket and automod columns, plus link role, request channel and log channel
- `MinecraftLink`: a member's Minecraft UUID and name, related to `User.id`
- `AdminRole`: the bot-admin roles per Discord server
- `FeatureRequest`: `/request` submissions, numbered by a sequence

## Hosting
Docker Compose with app and postgres:16. *(fill in the host and where the shared database runs)*

## Decisions made
- Kept separate from TriBridge, which handles the Minecraft side.
- One shared database with TriBridge; this bot owns the schema.
- Changelogs use the SkyHanni format, same as TriBridge (see `CLAUDE.md`).
- Networth lookups moved here from TriBridge.
