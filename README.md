# THG Community Bot

The Discord bot for the **THG** community server — a Hypixel SkyBlock guild community. It owns the
Discord side of community life: member profiles, localization, server setup data, and (as they land)
moderation, tickets and SkyBlock lookups.

It is **not** a Minecraft bridge. There is no in-game account and no guild-chat relay. Anything that
needs a Minecraft client belongs in the sibling
[TriBridge](https://github.com/Trilleo/THGBridge) repository. SkyBlock features here talk
to HTTP APIs only.

The two bots serve one Discord server and **share one PostgreSQL database**, so they agree about who is
linked and who is staff. This bot owns the schema; TriBridge reads it. See
[SHARED_DATABASE.md](SHARED_DATABASE.md).

> Status: early alpha (`0.0.1-alpha.1`). Utility commands, account linking, the admin panel and feature
> requests work today; moderation, tickets and automod are scaffolded in the schema and locale tables but
> not yet shipped as commands.

## Features

- **Member profiles** — `/profile` views or updates the database row created for every member who
  runs a command.
- **Help** — `/help` lists slash commands by category with a Components V2 select menu.
- **User info & ping** — `/info` and `/ping`.
- **Automatic user registration** — every non-bot command run ensures a `User` row exists first.
  See [USER_MANAGEMENT.md](USER_MANAGEMENT.md).
- **Localization** — Dutch (`nl`, default), English and Spanish strings via `t()` /
  `tWithUser()`.
- **Account linking** — `/link` binds a Minecraft account to a Discord user, `/linkrole` hands out a role
  for it, and TriBridge uses the link to attribute guild chat. See
  [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md).
- **Global profile change** — `/adminpanel` makes everybody's messages appear under one member's name and
  face for a while, in Discord and across the bridge, with a test mode and an audit trail. See
  [GLOBAL_PROFILE.md](GLOBAL_PROFILE.md).
- **Auditing** — `/auditchannel` sets where disguised messages are recorded, with a jump link to each
  repost, so the real author is never lost.
- **Feature requests** — `/request` opens a short form; the submission is posted with a number, and admins
  move it through a status with `/requeststatus`.
- **Bot-admin roles** — `/adminrole` names the Discord roles that count as staff. The list is shared with
  TriBridge, so one list decides who is staff on both bots.
- **Per-server setup storage** — ticket, automod, link-role, request-channel, audit-channel and log-channel
  settings live in the `Setup` table, keyed by Discord server id.
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
| Server Members         | yes        | Member lookups and profile data                              |
| Message Content        | yes        | Prefix commands (`!`) via discordx `simpleCommand`           |
| Guilds, Messages, Reactions, Voice States | no | Standard guild / message / voice handling |

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
| `ERROR_LOG_CHANNEL_ID` | no       | Channel that receives error embeds from the global error handler         |
| `LOG_CHANNEL_ID`       | no       | Fallback general log channel — account links, link-role sync, repost warnings. A per-server `logChannelId` in the database wins over it |
| `SHEETDB_API_URL`      | no       | SheetDB base URL for moderation-sheet helpers (`src/utils/sheetdb.ts`)   |
| `SHEETDB_API_KEY`      | no       | SheetDB API key                                                          |
| `NODE_ENV`             | no       | `development` includes stack traces in user-facing error replies         |
| `DISCORD_CLIENT_ID`    | no       | Present in `.env.example`; not read by the bot today                     |
| `DISCORD_GUILD_ID`     | no       | Present in `.env.example`; not read by the bot today                     |

Keep `.env`, `src/generated/` and `build/` out of git. Never commit tokens or database URLs.

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
| `/adminpanel`                  | Management | Open the admin panel (admin only)                      |
| `/auditchannel set\|show\|clear` | Management | Where disguised messages are recorded (admin only)    |

New commands go under `src/commands/categories/<category>/` as `@Discord()` + `@Category(...)`
classes. A command without `@Category` still works but is invisible in `/help`.

## Scripts

| Script            | What it does                                      |
|-------------------|---------------------------------------------------|
| `yarn setup`      | Install, `prisma generate`, `prisma db push`      |
| `yarn setup:prod` | Same, omitting devDependencies                    |
| `yarn dev`        | Run `src/dev.ts` with hot reload                  |
| `yarn watch`      | Nodemon wrapper around `yarn dev`                 |
| `yarn build`      | `tsc` → `build/`                                  |
| `yarn start`      | `node build/main.js`                              |
| `yarn start:prod` | Build then start                                  |
| `yarn lint`       | Biome check                                       |
| `yarn biome:fix`  | Biome lint + format write                         |

## Project structure

```plaintext
src/
├── main.ts                 # Production entry — error handlers, shutdown hooks
├── dev.ts                  # Development entry — hot reload (no global error handlers)
├── bot.ts                  # Shared discordx Client, intents, botGuilds
├── commands/
│   ├── slashes.ts          # Empty stub (intentionally inert)
│   └── categories/         # Slash commands, one file per command
│       ├── utility/        # /help, /ping, /info, /profile
│       ├── linking/        # /link, /unlink, /links, /whois, /linkrole
│       ├── requests/       # /request, /requestchannel, /requeststatus
│       └── management/     # /adminrole, /adminpanel, /auditchannel
├── events/                 # @On / @Once handlers
├── utils/                  # prisma, userManager, localization, errorHandler, …
├── types/                  # environment.d.ts
└── generated/prisma/       # Prisma client (gitignored — run yarn prisma:generate)
prisma/
└── schema.prisma           # User, Setup, MinecraftLink, AdminRole,
                            # FeatureRequest, GlobalProfileEffect, BridgeChannel
```

There are **two entry points and they are not equivalent**: `main.ts` installs global error
handlers and closes Prisma on SIGINT/SIGTERM; `dev.ts` does neither. See [CLAUDE.md](CLAUDE.md)
before changing startup behaviour.

## Database

PostgreSQL via **Prisma 7** (`prisma-client` generator, `@prisma/adapter-pg`). Schema changes in
development use `yarn prisma:push`. Import the shared client from `src/utils/prisma.ts` — never
construct a second `PrismaClient` in a command.

| Model                 | Purpose                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| `User`                | One row per Discord user (`discordId` unique); `language` defaults to `nl` |
| `Setup`               | Per-Discord-server configuration: tickets, automod, link role, request channel, audit channel, log channel |
| `MinecraftLink`       | A member's Minecraft account — name and UUID, related to `User.id`      |
| `AdminRole`           | Discord roles that count as bot-admin. Shared with TriBridge             |
| `FeatureRequest`      | A `/request` submission. `id` is a sequence, which is what stops two concurrent submits sharing a number |
| `GlobalProfileEffect` | The running global profile change, one row per server                   |
| `BridgeChannel`       | Channels TriBridge owns, **written by TriBridge**, so the disguise skips them |

`MinecraftLink`, `AdminRole`, `GlobalProfileEffect` and `Setup.auditChannelId` are read by TriBridge as well.
Renaming a column in any of them breaks the bridge silently — see
[SHARED_DATABASE.md](SHARED_DATABASE.md) before touching them.

## Localization

Default locale is **Dutch (`nl`)**. Add every new user-facing string to `nl`, `en` and `es` in
`src/utils/localization.ts`. A key present only in one language shows up as the raw key path for
the others.

## Documentation

| Doc                                        | Audience                                      |
|--------------------------------------------|-----------------------------------------------|
| [CLAUDE.md](CLAUDE.md)                     | Conventions, architecture, after-change checklist |
| [CHANGELOG.md](CHANGELOG.md)               | Release notes                                 |
| [USER_MANAGEMENT.md](USER_MANAGEMENT.md)   | Automatic user registration                   |
| [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md)   | Minecraft account links and the link role     |
| [GLOBAL_PROFILE.md](GLOBAL_PROFILE.md)     | The admin panel, the disguise and auditing    |
| [SHARED_DATABASE.md](SHARED_DATABASE.md)   | The contract with TriBridge                   |
| [discordx docs](https://discordx.js.org)   | Decorator / framework reference               |

## License

MIT — see [LICENSE](LICENSE).
