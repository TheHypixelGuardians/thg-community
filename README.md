# THG Community Bot

The Discord bot for the **THG** community server — a Hypixel SkyBlock guild community. It owns the
Discord side of community life: member profiles, account linking, feature requests, SkyBlock lookups, server
setup data, and (as they land) moderation and tickets.

It is **not** a Minecraft bridge. There is no in-game account and no guild-chat relay. Anything that
needs a Minecraft client belongs in the sibling
[TriBridge](https://github.com/Trilleo/THGBridge) repository. SkyBlock features here talk
to HTTP APIs only.

The two bots serve one Discord server and share one **PostgreSQL database**, the **blacklist** and the **admin
roles** (set here with `/adminrole`). Everything else is separate: each has its own account links. See
[SHARED_DATABASE.md](SHARED_DATABASE.md).

> Status: early alpha (`0.0.1-alpha.1`). Utility commands, account linking, feature requests, tickets and
> moderation work today; automod is planned.

## Features

- **Member profiles** — `/profile` views or updates the database row created for every member who
  runs a command.
- **SkyBlock lookup** — `/skyblock [username]` shows a player's selected SkyBlock profile via the
  Hypixel public API (needs `HYPIXEL_API_KEY`).
- **SkyBlock networth** — `/networth [username]` calculates richest-profile networth via Hypixel +
  `skyhelper-networth` (needs `HYPIXEL_API_KEY`).
- **Help** — `/help` lists slash commands by category with a Components V2 select menu.
- **User info & ping** — `/info` and `/ping`.
- **Automatic user registration** — every non-bot command run ensures a `User` row exists first.
  See [USER_MANAGEMENT.md](USER_MANAGEMENT.md).
- **Server setup panel** — `/setup` configures the log channel, the feature request channel, the admin
  roles, tickets and the mod log from one ephemeral panel, a page per area, and lists the server's
  AutoMod rules (read-only, needs **Manage Server**).
- **Own role permissions** — at startup the bot adds the permissions it needs to its own role if they are
  missing (only adds, and logs what it added). It needs Manage Roles through a higher role to do so. Settings live in the `Setup` table, keyed by
  Discord server id.
- **Tickets** — members open a private channel with staff from a panel of buttons (Support, Guild
  application, Report a member), fill in a short form first, and get a transcript in the log when it
  closes. Set up on the **Tickets** page of `/setup`. See [TICKETS.md](TICKETS.md).
- **Moderation** — `/warn`, `/timeout`, `/kick`, `/ban` and their undo commands record numbered cases, DM
  the member and post to the mod log; `/cases` and `/case` show and correct the history, `/purge` bulk-deletes.
  Gated by the matching Discord permissions. See [MODERATION.md](MODERATION.md).
- **Shared blacklist** — a member blacklisted with TriBridge's `/blacklist` can't use any command of
  this bot either (refused within 15 seconds). If the database can't be read, the check lets people
  through rather than locking the whole server out.
- **Error reporting** — unhandled errors can post to a Discord channel when
  `ERROR_LOG_CHANNEL_ID` is set.
- **Hot reload in development** — `yarn dev` reloads commands and events on file change without a
  full process restart.

## Prerequisites

| Requirement     | Details                                                                                         |
|-----------------|-------------------------------------------------------------------------------------------------|
| **Node.js**     | **v22** or newer (`minecraft-protocol` requires it; Prisma 7 and chokidar 5 need 20.19+)         |
| **Yarn**        | Package manager for this repo                                                                   |
| **PostgreSQL**  | The database shared with TriBridge (Neon in production); set `DATABASE_URL` to its **direct**, non-pooled connection string, which migrations need |
| **Discord bot** | Application at the [Developer Portal](https://discord.com/developers/applications); Message Content only for ticket transcripts |

### Discord intents

Enable these in the Developer Portal (they match `src/bot.ts`):

| Intent                 | Privileged | Why                                                          |
|------------------------|------------|--------------------------------------------------------------|
| Guilds                 | no         | Servers, channels and roles                                  |

**Message Content** is not requested at login, but switch it **on** in the Developer Portal if you use
tickets: the transcript reads message text through the API, which follows the portal setting rather than the
intents the bot connects with. Without it, transcripts have no text. **Presence** and **Server Members** are
not needed.

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
| `LOG_CHANNEL_ID`       | no       | Fallback general log channel — account links and warnings. A per-server `logChannelId` in the database wins over it |
| `NODE_ENV`             | no       | `development` includes stack traces in user-facing error replies         |
| `PINGDIAMOND_USER_ID`  | no       | The Discord user id `/pingdiamond` pings. The command says it is not set up without it |
| `VERIFY_SERVER_PORT`   | no       | Port for the `/link` verification Minecraft server. Verification is on only when this and `VERIFY_SERVER_ADDRESS` are both set |
| `VERIFY_SERVER_ADDRESS`| no       | The address members join to get a link code, e.g. `verify.example.com` |

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
| `/link`                        | Linking  | Link your Minecraft account: enter your name, then a code from the verification server |
| `/unlink [user]`               | Linking  | Remove a link — your own, or anyone's (admin only)       |
| `/links`                       | Linking  | List every linked Minecraft account (admin only)         |
| `/whois <user\|username>`      | Linking  | Look up a link in either direction (admin only)          |
| `/setrank <user> [rank]`       | Linking  | Set or clear the guild rank stored on a link (admin only) |
| `/request`                     | Requests | Submit a feature request through a short form            |
| `/requestchannel set\|show`     | Requests | Where feature requests are posted (admin only)           |
| `/requeststatus <id> <status>` | Requests | Mark a request accepted, denied, planned or duplicate (admin only) |
| `/adminrole add\|remove\|show`  | Management | The roles that count as bot-admin, on both bots (admin only) |
| `/pingdiamond`                 | Management | Ping the member in `PINGDIAMOND_USER_ID` and delete the ping straight away (needs Manage Roles). Also fires by itself up to 3 times a week once a channel is set in `/setup` |
| `/setup`                       | Management | One panel for the log channel, request channel, admin roles, tickets and the mod log, plus the server's AutoMod rules (admin only) |
| `/ticket add <user>`           | Tickets  | Let a member into the ticket this is run in (staff only)  |
| `/ticket remove <user>`        | Tickets  | Take a member back out of the ticket (staff only)         |
| `/ticket close [reason]`       | Tickets  | Close the ticket: transcript to the log, DM to the member (opener or staff) |
| `/warn <user> <reason>`        | Moderation | Warn a member: a case plus a DM (Moderate Members)      |
| `/timeout <user> <duration> [reason]` | Moderation | Discord timeout, up to 28 days (Moderate Members) |
| `/untimeout <user> [reason]`   | Moderation | Take a timeout off early (Moderate Members)             |
| `/kick <user> [reason]`        | Moderation | Kick a member (Kick Members)                            |
| `/ban <user> [reason] [delete_messages]` | Moderation | Ban a member or a user id (Ban Members)       |
| `/unban <user> [reason]`       | Moderation | Lift a ban (Ban Members)                                |
| `/purge <count> [user]`        | Moderation | Bulk-delete up to 100 recent messages (Manage Messages) |
| `/cases <user>`                | Moderation | A member's latest 25 cases (Moderate Members)           |
| `/case view\|reason\|delete <id>` | Moderation | Show, re-word or delete one case                     |

New commands go under `src/commands/categories/<category>/` as `@Discord()` + `@Category(...)`
classes. A command without `@Category` still works but is invisible in `/help`.

## Scripts

| Script            | What it does                                      |
|-------------------|---------------------------------------------------|
| `yarn setup`      | Install, `prisma generate`, apply migrations      |
| `yarn setup:prod` | Same, omitting devDependencies                    |
| `yarn dev`        | Run `src/dev.ts` with hot reload                  |
| `yarn watch`      | Nodemon wrapper around `yarn dev`                 |
| `yarn build`      | Empty `build/`, `prisma generate`, then `tsc` → `build/` |
| `yarn start`      | `node build/main.js`                              |
| `yarn start:prod` | Build then start                                  |
| `yarn prisma:migrate` | Apply pending migrations (`prisma migrate deploy`) |
| `yarn prisma:migrate:dev` | Create a migration from a schema change (development) |
| `yarn prisma:baseline` | One-time: mark `0_init` as applied on a database created with `db push` |
| `yarn legacy:import --dir <folder> --guild <server id> [--dry-run]` | One-time: import TriBridge's old JSON files (links, admin roles, feature requests) |
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
│       ├── linking/        # /link, /unlink, /links, /whois, /setrank
│       ├── requests/       # /request, /requestchannel, /requeststatus
│       ├── management/     # /adminrole, /setup, /pingdiamond
│       ├── tickets/        # /ticket and the ticket panel buttons
│       └── moderation/     # /warn, /timeout, /kick, /ban, /purge, /cases, /case, …
├── events/                 # @On / @Once handlers
├── utils/                  # prisma, userManager, errorHandler, shutdown, …
├── types/                  # environment.d.ts
└── generated/prisma/       # Prisma client (gitignored — run yarn prisma:generate)
prisma/
└── schema.prisma           # User, Setup, MinecraftLink, AdminRole,
                            # FeatureRequest, Blacklist, Ticket, ModCase
```

There are **two entry points and they are not equivalent**: `main.ts` installs global error
handlers and `dev.ts` does not. Both close the Discord client and the database connection on
SIGINT/SIGTERM (`src/utils/shutdown.ts`). See [CLAUDE.md](CLAUDE.md) before changing startup behaviour.

## Database

PostgreSQL via **Prisma 7** (`prisma-client` generator, `@prisma/adapter-pg`). Schema changes are
**migrations** in `prisma/migrations/`: make one with `yarn prisma:migrate:dev` against a development
database, commit it, and production applies it with `yarn prisma:migrate` (the Docker image does that
on every start). CI applies every migration to a fresh database and fails when `schema.prisma` and the
migrations disagree. Import the shared client from `src/utils/prisma.ts` — never construct a second
`PrismaClient` in a command.

**Switching an existing database over from `db push`, once:** run `yarn prisma:baseline` (marks
`0_init` as already applied, because `db push` created those tables), then `yarn prisma:migrate`. Don't
run `prisma db push` against the shared database again after that: it doesn't record migrations, so
the next `migrate deploy` would try to create tables that already exist. TriBridge's own `tribridge`
schema is never touched by either.

**Moving over from TriBridge's JSON files, once:** `yarn legacy:import --dir <folder> --guild <server id>`
reads `linkedAccountsConfig.json`, `adminRolesConfig.json`, `linkRoleConfig.json` and
`featureRequestsConfig.json` from the folder into the database for that Discord server. It only adds — an
existing link, role, setting or request is kept — so running it twice is harmless, and a link made with
`/link` since always wins over the old file. Request numbers are kept, and the next `/request` continues
after the highest one. `--dry-run` only reports what the files hold.

| Model                 | Purpose                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| `User`                | One row per Discord user (`discordId` unique) and their Discord username |
| `Setup`               | Per-Discord-server configuration: tickets, automod, request channel, log channel |
| `MinecraftLink`       | A member's Minecraft account — name, UUID and a hand-set rank, related to `User.id` |
| `AdminRole`           | Discord roles that count as bot-admin on both bots. Read by TriBridge    |
| `FeatureRequest`      | A `/request` submission. `id` is a sequence, which is what stops two concurrent submits sharing a number |
| `Blacklist`           | Members barred from every command of both bots. **Written by TriBridge**'s `/blacklist`, read here |
| `Ticket`              | A ticket: number (a sequence), type, opener, claim, form answers and how it closed. See [TICKETS.md](TICKETS.md) |
| `ModCase`             | A moderation case: number (a sequence), action, member, moderator, reason, duration. See [MODERATION.md](MODERATION.md) |

`Blacklist` is the one table TriBridge writes, and `AdminRole` the one other table it reads. Renaming a column in
either breaks the bridge silently — see [SHARED_DATABASE.md](SHARED_DATABASE.md) before touching them.

## Language

The bot is **English-only**. User-facing strings are plain English in the command that sends them; there is
no localisation module and no per-user language setting.

## Documentation

| Doc                                        | Audience                                      |
|--------------------------------------------|-----------------------------------------------|
| [CLAUDE.md](CLAUDE.md)                     | Conventions, architecture, after-change checklist |
| [CHANGELOG.md](CHANGELOG.md)               | Release notes                                 |
| [USER_MANAGEMENT.md](USER_MANAGEMENT.md)   | Automatic user registration                   |
| [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md)   | Minecraft account links and verification       |
| [TICKETS.md](TICKETS.md)                   | Tickets: setup, permissions, closing, transcripts |
| [MODERATION.md](MODERATION.md)             | Moderation commands, hierarchy checks, cases     |
| [SHARED_DATABASE.md](SHARED_DATABASE.md)   | The contract with TriBridge                   |
| [discordx docs](https://discordx.js.org)   | Decorator / framework reference               |

## License

MIT — see [LICENSE](LICENSE).
