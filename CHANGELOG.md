# Changelog

All notable changes to the THG community bot are documented here.

Format is SkyHanni-style: `##` release section, `###` category, `####` feature area, then `+` bullets.
See [CLAUDE.md](CLAUDE.md) for the full conventions.

## Unreleased

### New Features

#### Skyblock

+ Added `/skyblock <username>` to look up a player's selected SkyBlock profile via the Hypixel public API
  (profile name, game mode, SkyBlock level, skill average, purse, bank, and Hypixel guild when available).
    + Requires `HYPIXEL_API_KEY` in `.env`. Fields the player has hidden in-game API settings show as hidden
      rather than failing the whole lookup.
+ Added `/networth <username>` to calculate a player's richest SkyBlock profile networth via the Hypixel API
  and `skyhelper-networth` (replaces the old TriBridge SkyCrypt lookups).
    + Cached for ten minutes; one lookup per Discord user every fifteen seconds.
+ `/skyblock` and `/networth` look up your own linked account when you leave out `username`.

#### Account Linking

+ Added `/link`, which binds your Minecraft account to your Discord account on this bot. The
  bridge keeps its own, separate `/link`; the two bots share only the database and the blacklist.
    + The account's UUID is stored alongside the name, so a link survives a Minecraft rename.
    + One link per Discord user and one Discord user per Minecraft account, both enforced — silently
      reassigning an account would let anybody wear a guild member's identity across the bridge.
    + It only records the link: no role, no nickname. Another bot in the server handles the roles for
      linking, and two bots managing the same members would undo each other.
    + The name is verified with Mojang. Guild membership is **not** checked: that used to read the live
      Hypixel roster, which needs a Minecraft account, and this bot has none. An admin undoes a wrong link
      with `/unlink user:@them`.
+ Added `/unlink [user]` to remove your own link, or anybody's with a bot-admin role.
+ Added `/whois <user|username>` and `/links` for admins, to look a link up in either direction or list them
  all.
+ Added `/setrank <user> [rank]` for admins, to store a member's guild rank on their link by hand. `/whois` and
  `/links` show it; leave `rank` out to clear it.
    + Only a record: it gives no role and is never filled in or changed automatically. Each change is noted in
      the log channel.
+ `/link` can verify that you own the account: it asks for your Minecraft name in a form, then shows how to
  join the verification server. You get a six-digit code there, click **Enter code**, type it in, and the
  message turns into a confirmation once you are linked.
    + On when `VERIFY_SERVER_PORT` and `VERIFY_SERVER_ADDRESS` are set; without them the name from the form is
      linked straight away, on trust.
    + A code only works for the account you named, so you always end up linked to the name you entered.
    + Codes work once and expire after five minutes. Five wrong codes per ten minutes, then a wait.
    + The verification server takes any Java Edition release from 1.7 up, including ones newer than the bot
      has protocol data for (26.3 today): the server list shows it as joinable for every version instead of
      "Outdated server".
    + A verified link takes the account over from whoever claimed it before.
+ See [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md).

#### Admin Setup

+ Added `/pingdiamond`, moved here from TriBridge: it pings the member set in `PINGDIAMOND_USER_ID` and
  deletes the ping straight away, so the notification arrives but nothing stays in the channel.
    + Needs **Manage Roles**, and is hidden from members without it.
    + Only that member can ever be pinged by it, and each use is noted in the log channel.

+ Added `/adminrole add|remove|show`, the list of Discord roles that count as bot-admin. TriBridge reads the
  same list, so one list decides who is staff on both bots.
    + Open to bot admins and to holders of the Discord **Administrator** permission, so a fresh server can
      set its first admin role. A bot admin can therefore make others admins on both bots.
    + **Until it has an entry, nothing admin-gated works** on either bot.
    + The admin panel, the global profile change and auditing stay on **TriBridge** — all three reach into
      guild chat, so they belong with the Minecraft side. `/adminpanel` and `/auditchannel` are still run
      there, and the role list configured here is what gates them.

+ Added `/setup`, one panel for this server's log channel, feature request channel and admin roles.
    + Pick a channel or role to change a setting; clear the picker to turn it off.
    + Opens for bot admins and for server administrators (so a fresh server can set its first admin role),
      and everyone who can open it can change every setting on it, admin roles included.
    + Applies the same check as `/requestchannel`: the bot must be able to post in the channel.

#### Automod

+ Added an **AutoMod** page to `/setup` that lists the server's own AutoMod rules: what each one matches, what
  it does and what is exempt.
    + Read-only: the rules are still changed in Server Settings. It is there so the bot's own automod can be
      built around the rules already in place instead of duplicating them.
    + Keyword lists show as counts, not the words themselves.
    + Needs the bot to have **Manage Server**; without it the page says so.

#### Tickets

+ Added tickets: members press a button on the ticket panel, fill in a short form and get a private channel
  `ticket-0042` with staff. See [TICKETS.md](TICKETS.md).
    + Three types: **Support**, **Guild application** (Minecraft name checked with Mojang, SkyBlock level, why
      you want to join) and **Report a member**. One open ticket per type per member.
    + **Claim** marks who handles a ticket; **Close** takes an optional reason, posts a transcript to the
      ticket log, DMs the member and deletes the channel.
    + Staff can reopen a closed ticket from its log entry for 24 hours. It gets a new channel with the same
      number.
    + `/ticket add`, `/ticket remove` and `/ticket close` for use inside a ticket.
    + Transcripts need the **Message Content** intent switched on in the Developer Portal; without it they
      list the messages without their text.
    + A ticket channel deleted by hand closes its ticket, so its member isn't stuck unable to open another.
+ `/setup` has a **Tickets** page for the panel channel, category, staff role and log channel, and a button
  that posts the panel (replacing the old one).

#### Moderation

+ Added `/warn`, `/timeout`, `/untimeout`, `/kick`, `/ban` and `/unban`. Each one becomes a numbered case,
  is posted to the mod log and is DMed to the member. See [MODERATION.md](MODERATION.md).
    + Gated by the matching Discord permission (Moderate Members, Kick Members, Ban Members).
    + Refused on yourself, the bot, the owner, anyone whose top role is equal to or above yours, and bot
      admins unless you are a server administrator.
    + The DM goes out before a kick or ban, since it can't reach them after. Closed DMs don't stop the action.
    + `/ban` also takes a user id for someone who isn't in the server, and can delete their recent messages.
+ Added `/cases` for a member's history and `/case view|reason|delete` for one case.
+ Added `/purge` to bulk-delete up to 100 recent messages, optionally from one user.
+ `/setup` has a **Moderation** page for the mod log channel.
+ Members blacklisted with TriBridge's `/blacklist` can no longer use any command of this bot.
    + Refused within 15 seconds of being blacklisted, with an ephemeral message; autocomplete returns nothing.
    + If the database can't be read, members are let through rather than locking everybody out.

#### Requests

+ Added `/request`, which opens a short form — a name and a description — and posts the submission with an
  incrementing number to the channel set by `/requestchannel set`.
    + The number comes from a database sequence, so two concurrent submissions cannot share one.
    + The body is arbitrary member-supplied text posted by the bot, so mentions in it are suppressed: an
      `@everyone` in a request does not ping.
    + A request that could not be posted is still saved, and the reply says so.
+ Added `/requeststatus <id> <status>` for admins — **accepted**, **denied**, **planned** or **duplicate** —
  which recolours and updates the original embed in place. A new request starts as ⏳ Pending.
    + The status is written before the message edit, so it is never lost when the edit fails, and the message
      is fetched by the request's *own* channel so requests posted before a `/requestchannel set` still edit.

### Fixes

#### Hosting

+ The production build starts: `yarn build && yarn start` used to stop at a module-not-found
    + The generated Prisma client is emitted with `.js` import specifiers and compiled into `build/`, and
      `yarn build` runs `prisma generate` itself.
    + `.env` is loaded before the Prisma client is created, and `prisma generate` no longer needs
      `DATABASE_URL`, so the build works without a database.
    + The last extensionless relative import (`/help`) has its `.js`.
+ The Docker image builds the bot properly: it installs with Yarn from `yarn.lock` instead of npm, copies
  `prisma/` and `prisma.config.ts`, generates the Prisma client and adds the `openssl` Prisma needs on Alpine.
  It used to ship without a Prisma client.
+ The Docker Compose app can log in: it passed the token as `BOT_TOKEN` while the bot reads `DISCORD_TOKEN`.
  Compose now reads `.env` through `env_file` and overrides only `DATABASE_URL`.
+ A failed start (missing token, failed login) now exits with code 1. It used to log the error and sit there
  doing nothing, so Docker never restarted it.
+ Stopping the bot (Ctrl+C, `docker stop`) now closes the Discord connection and the database connection
  before it exits. A second signal handler used to exit first, so the database disconnect never ran.

#### Skyblock

+ `/skyblock` and `/networth` no longer fail with "Unknown interaction" when the database is slow —
  Discord is acknowledged before any Prisma work, and the DB connection is warmed on ready so the
  first query after a restart cannot burn the 3s ack window.

#### Core

+ Slash commands no longer run twice (removed duplicate `common.ts` event handlers that caused
  `InteractionAlreadyReplied` after `/help` and other commands)
+ `/help` no longer shows an empty Miscellaneous category (moved into Utility; categories with no
  listable commands are omitted from the picker)
+ Removed debug `console.log` spam when browsing `/help` categories
+ Stale global slash commands are removed once on startup, before the server's commands register, instead
  of in a call that raced the registration. A failed cleanup is logged and no longer stops startup.
+ Error replies no longer stop for good after ten errors: the per-user error limit now resets after a minute,
  instead of silencing that user's error messages until the bot restarts

### Improvements

#### Core

+ The username stored for each member is now fetched from Discord by their id, rather than copied from
  whatever the command passed along.
    + Every startup refreshes the stored names in the background, so a rename shows up even for members who
      have not used the bot since, and imported rows that only had the Discord id as a name get the real one.
+ The bot's rotating status no longer shows "Made by Vapor", a leftover from the template it was built on.

#### Localization

+ Dropped Dutch and Spanish string tables — the bot is English-only (`t()` with no per-user language).

### Removed Features

#### Core

+ Removed prefix-command support (`!`), which no command used: the `messageCreate` handler, discordx
  `simpleCommand` and the **Message Content** (privileged) and Guild Messages intents. Message Content can be
  switched off in the Developer Portal.
    + Sending a message no longer creates a `User` row; running any command still does.
+ Dropped the Guild Message Reactions and Guild Voice States intents, which nothing used. The bot now asks for
  Guilds only.
+ Removed the link role (`/linkrole`, the `/setup` picker, the startup sync) and the `[Knight] <name>`
  nickname that `/link` set for a while. Roles for linking belong to another bot in the server.
    + Members who already got the role or nickname keep them; this bot no longer adds or removes either.
    + **Server Members** (privileged) is no longer requested and can be switched off in the Developer Portal.

#### Misc

+ Removed the unused SheetDB helper (`src/utils/sheetdb.ts`) and its `axios` dependency. Nothing imported
  it; `SHEETDB_API_URL` and `SHEETDB_API_KEY` are no longer read and can be deleted from `.env`.

### Technical Details

#### Core

+ Added the `ModCase` table and `Setup.modLogChannelId` with a migration.
+ Added the `Ticket` table and `Setup.ticketPanelMessageId` with a migration.
+ `/setup` is split into pages (General, Tickets), since a Components V2 message holds at most 40
  components.

+ Dropped the unused `linkRoleId` column from `Setup` with a migration. Nothing has read it since the link
  role was removed.

+ Dropped the unused `language` column from `User` with a migration. The bot has been English-only since the
  localisation tables went; the column was never read.

+ Added `minecraft-protocol` for the link verification server. Node **22** is now the minimum.

+ Schema changes are now Prisma migrations (`prisma/migrations/`) instead of `prisma db push`.
    + `0_init` is the baseline the live database was pushed with. Switch an existing database once with
      `yarn prisma:baseline`, then `yarn prisma:migrate`.
    + The Docker image applies pending migrations before starting the bot.
+ Added `yarn legacy:import`, a one-time import of TriBridge's old JSON files: account links, admin roles,
  the request channel and feature requests, for one Discord server.
    + Only adds, so a second run changes nothing, and a newer `/link` beats the old file.
    + Request numbers are kept and the request number sequence is moved past them.
+ The startup line now reads `Discord bot logged in as …`, which is what the panel's Node.js egg waits for, so a
  started server shows as running instead of hanging on "starting".
+ Added the `Blacklist` table, written by TriBridge with plain SQL, so its `id` and `updatedAt` defaults are
  database-side.
+ Added a CI workflow: lint, build, apply every migration to a fresh Postgres, and fail when `schema.prisma`
  and the migrations disagree.
+ `docker-compose.yml` now uses the shared database from `.env`; the bundled Postgres is a `local-db` profile
  for development only.
+ `/help` no longer reads the deprecated `message.interaction` field.
+ Bumped `@discordx/utilities` to 8.0.0 so `@Category` works with `discordx` 11.13 (fixes
  `decorateUnknown is not a function` on startup)
+ Aligned Prisma on stable 7.10.0 for both `prisma` and `@prisma/client` (dropped the mismatched 8 RC CLI)
+ Added `prisma.config.ts`, switched the generator to `prisma-client`, and wired `@prisma/adapter-pg`
+ Shared a single Prisma client from `utils/prisma` (`/profile` and user helpers import it; no second pool)
+ Split Prisma client setup out of `userManager` into `utils/prisma.ts`
+ Raised the Node engine requirement to `>=20.19.0` and upgraded TypeScript to 5.9.3, Biome, chokidar 5,
  and related dependencies
+ Added `src/utils/hypixel.ts` and `src/utils/mojang.ts` for Hypixel / Mojang HTTP lookups
+ Added `skyhelper-networth` and `src/utils/networth.ts` for SkyBlock networth calculation
+ Documented `HYPIXEL_API_KEY` in `.env.example`
+ Slash-command dispatch defers `/skyblock` and `/networth` before any Prisma work, warms the
  database on ready, and ignores Discord's stale-interaction codes (10062 / 40060) by matching
  on `error.code` (discord.js and `@discordjs/rest` export different `DiscordAPIError` classes,
  so `instanceof` never matched)
+ Fixed the two type errors that stopped `yarn build` after the PR #4 merge: `linkedAccounts.ts` imported
  a `MinecraftProfile` type the merged `mojang.ts` no longer exports, and `/requeststatus` imported a
  `RequestStatus` type with the same name as its own class
+ `yarn lint` passes: Biome checks every `.ts` file under `src/` except the generated Prisma client instead of
  a hand-kept folder list, and line endings are pinned to LF (`.gitattributes`, Biome `lineEnding`) so a
  Windows checkout no longer fails the format check on every file
+ `yarn build` empties `build/` first. `tsc` never deletes output, so a removed source file kept its compiled
  `.js`, and `importx` loaded it — a deleted command or event stayed live in production
+ Removed `src/utils/localization.ts`. The bot is English-only, so `t()` was a lookup into a single table,
  mostly keys for commands that do not exist. `/skyblock`, `/networth` and the bot statuses now use plain
  strings with the same wording.
+ Removed template leftovers: the empty `src/commands/slashes.ts`, a duplicate `console.log` of every
  interaction error (the error handler already logs it), and the deprecated `fetchReply` (`/ping`) and
  `ephemeral` (`/help`) reply options
+ Added secret scanning with gitleaks: a pre-commit hook in `.githooks/` and a **Secret scan** workflow that
  scans the full history on every push and pull request. `yarn install` enables the hook through
  `scripts/setup-hooks.cjs`, which leaves an existing `core.hooksPath` (such as a global hooks folder) alone.
+ Committed `yarn.lock` (it was gitignored, so builds were not reproducible) and added a `.dockerignore`
  that keeps `.env`, `node_modules`, `build/` and the generated client out of the image build context
+ The env var lists agree: removed `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID` from `.env.example` and the
  README and `CLIENT_ID` and `BUG_REPORT_CHANNEL_ID` from `environment.d.ts` (nothing reads them), and added
  `HYPIXEL_API_KEY` to `environment.d.ts`, with the optional variables typed as optional
+ `yarn dev` hot reload fires again: chokidar 5 has no glob support, so `dev.ts` now watches the `events/` and
  `commands/` folders and filters by extension
+ Migrated the community half of TriBridge into this bot: account linking, bot-admin roles and feature
  requests. The bridge keeps the admin panel, the global profile change and auditing, since all three reach
  into guild chat.
+ Added three Prisma models — `MinecraftLink`, `AdminRole` and `FeatureRequest` — plus link-role,
  request-channel and log-channel columns on `Setup` and the matching relations on `User`. TriBridge reads
  the first two with plain SQL, so renaming a column there breaks the bridge silently — see
  [SHARED_DATABASE.md](SHARED_DATABASE.md).
+ Caches are invalidated on write rather than expiring, because this process owns every write. TriBridge, a
  reader, cannot do the same and expires on a 15-second timer instead — which is the lag between a write here
  and the bridge honouring it.
+ `clientReady` gained the link-role sync, extending the existing handler class rather than adding a second
  one for the same event.
+ Added `LOG_CHANNEL_ID`, and the matching entries in `.env.example` and `src/types/environment.d.ts`. That
  file also gained the `ERROR_LOG_CHANNEL_ID` and SheetDB variables it had been missing.

#### Documentation

+ Replaced the discordx template README with a project-accurate description of the THG community bot
  (features, intents, env vars, commands, scripts, structure, database).
+ CLAUDE.md now requires the README to expand as the project expands — new commands, env vars and
  features update it in the same task.
+ Added [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md) and [SHARED_DATABASE.md](SHARED_DATABASE.md); the second is
  the contract between the two bots — which tables TriBridge reads, what happens when Postgres is
  unreachable, and why the admin panel stayed on the bridge.
+ Updated the README's features, commands, environment variables, project structure and database sections for
  everything above.
+ Rewrote [USER_MANAGEMENT.md](USER_MANAGEMENT.md), which described a different bot (a "Checklist Bot" with an
  `ideas` relation and a `common.ts` handler).

