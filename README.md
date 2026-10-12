# THG Community Bot

The Discord bot for the **THG** community server — a Hypixel SkyBlock guild community. It owns the
Discord side of community life: member profiles, account linking, feature requests, SkyBlock lookups, server
setup data, and (as they land) moderation and tickets.

It is **not** a Minecraft bridge. There is no in-game account and no guild-chat relay. Anything that
needs a Minecraft client belongs in the sibling
[TriBridge](https://github.com/Trilleo/THGBridge) repository. SkyBlock features here talk
to HTTP APIs only.

The two bots serve one Discord server and **share one PostgreSQL database**, so they agree about who is
linked and who is staff. This bot owns the schema; TriBridge reads it. See
[SHARED_DATABASE.md](SHARED_DATABASE.md).

> Status: early alpha (`0.0.1-alpha.1`). Utility commands, account linking and feature requests work today;
> moderation, tickets and automod are scaffolded in the schema but not yet shipped as
> commands.

## Features

- **Member profiles** — `/profile` views or updates the database row created for every member who
  runs a command.
- **SkyBlock lookup** — `/skyblock <username>` shows a player's selected SkyBlock profile via the
  Hypixel public API (needs `HYPIXEL_API_KEY`).
- **SkyBlock networth** — `/networth <username>` calculates richest-profile networth via Hypixel +
  `skyhelper-networth` (needs `HYPIXEL_API_KEY`).
- **Help** — `/help` lists slash commands by category with a Components V2 select menu.
- **User info & ping** — `/info` and `/ping`.
- **Automatic user registration** — every non-bot command run ensures a `User` row exists first.
  See [USER_MANAGEMENT.md](USER_MANAGEMENT.md).
- **Per-server setup storage** — ticket and automod settings live in the `Setup` table, keyed by
  Discord server id.
- **Error reporting** — unhandled errors can post to a Discord channel when
  `ERROR_LOG_CHANNEL_ID` is set.
- **Hot reload in development** — `yarn dev` reloads commands and events on file change without a
  full process restart.

## Prerequisites

| Requirement     | Details                                                                                         |
|-----------------|-------------------------------------------------------------------------------------------------|
| **Node.js**     | **v20.19** or newer (Prisma 7 and chokidar 5 require it)                                        |
| **Yarn**        | Package manager for this repo                                                                   |
| **PostgreSQL**  | A reachable database; set `DATABASE_URL`                                                        |
| **Discord bot** | Application at the [Developer Portal](https://discord.com/developers/applications) with the privileged intents below enabled |

### Discord intents

Enable these in the Developer Portal (they match `src/bot.ts`):

| Intent                 | Privileged | Why                                                          |
|------------------------|------------|--------------------------------------------------------------|
| Server Members         | yes        | The link role: resolving members and keeping their cached roles current |
| Guilds                 | no         | Servers, channels and roles                                  |

The bot has no prefix commands, so it does not need **Message Content** — you can switch it off in the
Developer Portal. **Presence** is not needed either.

Slash commands register **per guild** (`botGuilds`), so changes show up immediately rather than
after Discord's global propagation delay.

## Installation

1. **Clone and install**

   ```bash
   git clone <this-repo-url> thg-community
   cd thg-community
   yarn setup
   ```

   `yarn setup` installs dependencies, generates the Prisma client into `src/generated/prisma`
   (gitignored), and pushes the schema to the database. A fresh clone will not typecheck or boot
   until `yarn prisma:generate` has run.

2. **Create `.env`** from [.env.example](.env.example):

   ```bash
   cp .env.example .env
   ```

3. **Invite the bot** with the intents above, then start it:

   ```bash
   yarn dev      # development — hot reload
   # or
   yarn build && yarn start   # production — runs build/main.js
   ```

## Environment variables

| Variable               | Required | Description                                                              |
|------------------------|----------|--------------------------------------------------------------------------|
| `DISCORD_TOKEN`        | yes      | Bot token from the Developer Portal                                      |
| `DATABASE_URL`         | yes      | PostgreSQL connection string (also read by `prisma.config.ts`)           |
| `HYPIXEL_API_KEY`      | no       | Hypixel public API key — required for `/skyblock` and `/networth` |
| `ERROR_LOG_CHANNEL_ID` | no       | Channel that receives error embeds from the global error handler         |
| `LOG_CHANNEL_ID`       | no       | Fallback general log channel — account links and link-role sync. A per-server `logChannelId` in the database wins over it |
| `NODE_ENV`             | no       | `development` includes stack traces in user-facing error replies         |

Keep `.env`, `src/generated/` and `build/` out of git. Never commit tokens or database URLs.

Two secret scans back that up, both with [gitleaks](https://github.com/gitleaks/gitleaks): a pre-commit hook
in `.githooks/` (enabled by `yarn install` unless you already have a `core.hooksPath`, such as a global hooks
folder; needs `gitleaks` on your PATH) and the **Secret scan** GitHub Actions workflow on every push and pull
request.

## Commands

| Command                        | Category | Description                                              |
|--------------------------------|----------|----------------------------------------------------------|
| `/help`                        | Utility  | Browse slash commands by category                        |
| `/ping`                        | Utility  | Bot latency                                              |
| `/info [user]`                 | Utility  | Discord user information                                 |
| `/profile action:view\|update` | Utility  | View or refresh your community profile row               |
| `/link <username>`             | Linking  | Bind your Minecraft account to your Discord account      |
| `/unlink [user]`               | Linking  | Remove a link — your own, or anyone's (admin only)       |
| `/links`                       | Linking  | List every linked Minecraft account (admin only)         |
| `/whois <user\|username>`      | Linking  | Look up a link in either direction (admin only)          |
| `/linkrole set\|show\|clear`    | Linking  | The role given to linked members (admin only)            |
| `/request`                     | Requests | Submit a feature request through a short form            |
| `/requestchannel set\|show`     | Requests | Where feature requests are posted (admin only)           |
| `/requeststatus <id> <status>` | Requests | Mark a request accepted, denied, planned or duplicate (admin only) |
| `/adminrole add\|remove\|show`  | Management | The roles that count as bot-admin (server admin only)  |

New commands go under `src/commands/categories/<category>/` as `@Discord()` + `@Category(...)`
classes. A command without `@Category` still works but is invisible in `/help`.

## Scripts

| Script            | What it does                                      |
|-------------------|---------------------------------------------------|
| `yarn setup`      | Install, `prisma generate`, `prisma db push`      |
| `yarn setup:prod` | Same, omitting devDependencies                    |
| `yarn dev`        | Run `src/dev.ts` with hot reload                  |
| `yarn watch`      | Nodemon wrapper around `yarn dev`                 |
| `yarn build`      | Empty `build/`, `prisma generate`, then `tsc` → `build/` |
| `yarn start`      | `node build/main.js`                              |
| `yarn start:prod` | Build then start                                  |
| `yarn lint`       | Biome check                                       |
| `yarn biome:fix`  | Biome lint + format write                         |

## Project structure

```plaintext
src/
├── main.ts                 # Production entry — error handlers, graceful shutdown
├── dev.ts                  # Development entry — hot reload (no global error handlers)
├── bot.ts                  # Shared discordx Client, intents, botGuilds
├── commands/
│   └── categories/         # Slash commands, one file per command
│       ├── utility/        # /help, /ping, /info, /profile
│       ├── linking/        # /link, /unlink, /links, /whois, /linkrole
│       ├── requests/       # /request, /requestchannel, /requeststatus
│       └── management/     # /adminrole
├── events/                 # @On / @Once handlers
├── utils/                  # prisma, userManager, errorHandler, shutdown, …
├── types/                  # environment.d.ts
└── generated/prisma/       # Prisma client (gitignored — run yarn prisma:generate)
prisma/
└── schema.prisma           # User, Setup, MinecraftLink,
                            # AdminRole, FeatureRequest
```

There are **two entry points and they are not equivalent**: `main.ts` installs global error
handlers and `dev.ts` does not. Both close the Discord client and the database connection on
SIGINT/SIGTERM (`src/utils/shutdown.ts`). See [CLAUDE.md](CLAUDE.md) before changing startup behaviour.

## Database

PostgreSQL via **Prisma 7** (`prisma-client` generator, `@prisma/adapter-pg`). Schema changes in
development use `yarn prisma:push`. Import the shared client from `src/utils/prisma.ts` — never
construct a second `PrismaClient` in a command.

| Model                 | Purpose                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| `User`                | One row per Discord user (`discordId` unique); `language` defaults to `nl` |
| `Setup`               | Per-Discord-server configuration: tickets, automod, link role, request channel, log channel |
| `MinecraftLink`       | A member's Minecraft account — name and UUID, related to `User.id`      |
| `AdminRole`           | Discord roles that count as bot-admin. Shared with TriBridge             |
| `FeatureRequest`      | A `/request` submission. `id` is a sequence, which is what stops two concurrent submits sharing a number |

`MinecraftLink` and `AdminRole` are read by TriBridge as well. Renaming a column in either breaks the bridge
silently — see [SHARED_DATABASE.md](SHARED_DATABASE.md) before touching them.

## Language

The bot is **English-only**. User-facing strings are plain English in the command that sends them; there is
no localisation module and no per-user language setting.

## Documentation

| Doc                                        | Audience                                      |
|--------------------------------------------|-----------------------------------------------|
| [CLAUDE.md](CLAUDE.md)                     | Conventions, architecture, after-change checklist |
| [CHANGELOG.md](CHANGELOG.md)               | Release notes                                 |
| [USER_MANAGEMENT.md](USER_MANAGEMENT.md)   | Automatic user registration                   |
| [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md)   | Minecraft account links and the link role     |
| [SHARED_DATABASE.md](SHARED_DATABASE.md)   | The contract with TriBridge                   |
| [discordx docs](https://discordx.js.org)   | Decorator / framework reference               |

## License

MIT — see [LICENSE](LICENSE).
