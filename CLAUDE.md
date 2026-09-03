# CLAUDE.md

Guidance for Claude Code when working in this repository.

## After every change: keep docs and changelog in sync

This repository is young and its documentation is thin, so it is easy to leave behind. Before finishing
any task that changes the bot:

1. **Update the changelog** — add an entry under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md), in the
   same commit as the change itself so the changelog never lags behind. The file does not exist yet;
   the first change that warrants an entry creates it.
    - Format is SkyHanni-style, matching the sibling TriBridge repository: `##` release section
      (`Unreleased` / `Version X.Y.Z`), then a `###` category (`New Features` / `Improvements` / `Fixes` /
      `Technical Details` / `Removed Features`), then a `####` feature area (`Moderation`, `Tickets`,
      `Profiles`, `Skyblock`, `Localization`, `Admin Setup`, `Core`, `Misc` — free-form, `Misc` is the
      catch-all), then `+` bullets, one change per bullet, indented `+` sub-bullets for details.
    - Only include categories and feature areas that actually have entries — omit empty ones.
    - Write entries for the people running and using the bot, not for developers: "Added `/profile` to view
      your community profile", not "Refactored userManager". Refactors, dependency bumps and tooling go
      under `### Technical Details`.
    - Skip the changelog only for changes with no effect on the running bot or its workflow (e.g. a doc typo).

2. **Check the Discord changelog** — [DISCORD_CHANGELOG.md](DISCORD_CHANGELOG.md) is the short,
   copy-pasteable version posted in the THG announcement channel. It gets a line only for changes members
   would actually notice — new commands, changed behaviour, user-visible fixes. Internal work, refactors and
   anything under `### Technical Details` never appears there.
    - Written in second person, for members rather than server staff: one line per change, no sub-bullets.
    - Only markdown Discord renders — `#`/`##`/`###`, `**bold**`, `` `code` ``, `-` bullets, `>` quotes. No
      tables, no `+` bullets, no titled links. Each `##` section must stay under 2000 characters so it pastes
      as a single message.
    - During development add entries under the same `## Unreleased` heading as the main changelog; rename it
      at release time in both files together.

3. **Check the README** — [README.md](README.md) is currently the canonical user-facing description, so it
   carries more weight here than it does in a repo with a `docs/` folder. Update it whenever the change
   touches commands, installation, `.env` variables, Discord permissions or intents, the Node version,
   dependencies, or the project structure. A new command gets a line; a new environment variable gets a row
   in the environment section *and* an entry in [src/types/environment.d.ts](src/types/environment.d.ts) and
   [.env.example](.env.example) — those three drift apart constantly, and a missing `.env.example` line is
   how a fresh clone fails at boot with no explanation.

4. **Check the subsystem docs** — [USER_MANAGEMENT.md](USER_MANAGEMENT.md) documents automatic user
   registration and is the model for how a subsystem gets written up here: what it does, where it hooks in,
   what happens when it fails. When a subsystem outgrows a README bullet, give it its own `<SUBSYSTEM>.md`
   at the root rather than swelling the README. Keep the existing ones honest — `USER_MANAGEMENT.md` still
   describes an `ideas` relation the schema no longer has, which is exactly the rot to avoid.
    - One rule worth carrying over from TriBridge: where a rule exists because the obvious alternative was
      actively harmful (a silent drop, a double-executed command, a permission escalation), say so. That
      sentence is what stops the rule being "simplified" away later.

Releases: bump `version` in `package.json` and rename `## Unreleased` to `## Version X.Y.Z` in **both**
changelogs, adding a fresh empty `## Unreleased` above it. Note `package.json` still says
`"name": "template"` and `"version": "1.0.0"` from the discordx starter — rename it before the first real
release.

**Do not create git tags by hand.** Pushing a `package.json` version bump to `main` where the new version
is a minor or major (`X.Y.0` — patch component must be `0`, no prerelease suffix) triggers
[.github/workflows/release.yml](.github/workflows/release.yml). That workflow extracts the matching
`## Version X.Y.Z` section from [CHANGELOG.md](CHANGELOG.md) and creates the GitHub Release (and its
`vX.Y.Z` tag). Patch bumps (`X.Y.Z` with `Z ≠ 0`) are ignored on purpose — ship those without a GitHub
Release. The changelog heading must already exist before the push; an empty or missing section fails the
job rather than publishing a blank release. Use `workflow_dispatch` only to re-run a missed release.

## Project

The THG community bot is the Discord bot for the THG community server — a Hypixel SkyBlock guild
community. It handles the Discord side of community life: member profiles, moderation, tickets, automod
and SkyBlock-facing lookups.

It is **not** a bridge. There is no `mineflayer`, no Minecraft account, no Hypixel guild chat relay and no
in-game presence of any kind. Anything that needs a Minecraft client belongs in the sibling **TriBridge**
repository (`../THG Bridge`), which owns the Discord ↔ Hypixel guild chat bridge. SkyBlock features here
talk to HTTP APIs (Hypixel, Mojang, SkyCrypt) and nothing else — if a feature seems to need an in-game
account, it is a TriBridge feature, not one for this repo.

- **TypeScript, ESM, decorators.** `"type": "module"`, `experimentalDecorators: true`, `strict: true`.
  Commands and events are classes decorated with [discordx](https://discordx.js.org) decorators — there is
  no `module.exports` command object and no hand-written event router.
- Node 18+ in `engines`, but development is on current LTS. Yarn is the package manager (`yarn.lock` is
  gitignored, which is unusual and probably wrong for an application; don't "fix" it in passing).
- Dependencies: `discordx`, `discord.js` v14, `@discordx/importer`, `@discordx/utilities`, `@prisma/client`
  - `prisma` (PostgreSQL), `axios`, `dotenv`, `pg`. Dev: `tsx`, `chokidar`, `@biomejs/biome`, `typescript`.
- **No test suite.** There is no `test` script. Verification is typechecking (`yarn build`) and linting
  (`yarn lint`); most utilities are pure and easy to reason about, so prefer reading them over running the
  bot.
- Biome is the linter *and* formatter — there is no ESLint and no Prettier.

## Running

```bash
yarn setup        # install + prisma generate + prisma db push
yarn dev          # tsx src/dev.ts — hot reload of commands and events
yarn watch        # nodemon wrapper around yarn dev
yarn build        # tsc -> build/
yarn start        # node build/main.js
yarn biome:fix    # lint --write + format --write
```

Requires a `.env` (gitignored) with at minimum `DISCORD_TOKEN` and `DATABASE_URL`; `ERROR_LOG_CHANNEL_ID`,
`SHEETDB_API_URL`, `SHEETDB_API_KEY` and `NODE_ENV` are optional but several features are inert without
them. See [.env.example](.env.example).

**`yarn prisma:generate` is not optional.** The Prisma client is generated into `src/generated/prisma`,
which is gitignored, so a fresh clone will not typecheck or boot until you run it — every import of
`../generated/prisma` fails with a module-not-found that looks like a broken path but isn't.

Running the bot logs into live Discord as the community bot and registers slash commands against real
servers. Don't start it to "verify" a change unless asked.

## Architecture

There are **two entry points and they are not equivalent**:

- **`src/main.ts`** (production) loads `.env`, installs the global error handlers, discovers modules with
  `importx`, logs in, sets the error handler's client, and registers SIGINT/SIGTERM handlers that close the
  Prisma connection.
- **`src/dev.ts`** (development) loads `.env`, discovers modules, logs in, and then watches the module glob
  with `chokidar`; on any change it calls `bot.removeEvents()`, clears `MetadataStorage` and the DI engine,
  re-imports every file with a cache-busting `?version=` query, rebuilds the metadata and re-runs
  `initApplicationCommands()`.

`dev.ts` deliberately does *not* install the global error handlers or the graceful-shutdown hooks. That
means an unhandled rejection behaves differently under `yarn dev` than in production — when you are
debugging a crash that "only happens in production", this asymmetry is the first thing to check. If you add
startup work, add it to **both** files or it will silently not happen in one of them.

**`src/bot.ts`** exports the single `Client` instance. Everything else imports `bot` from there; there is no
DI container in use and no second client. Two settings there are load-bearing:

- **`botGuilds`** maps to every cached guild, so commands register **per guild**, not globally. That is why
  changes appear instantly instead of taking up to an hour — but it also means a guild the bot joins after
  startup gets no commands until `initApplicationCommands()` runs again. Switching to global commands is a
  deliberate decision, not a cleanup.
- **`simpleCommand.prefix: '!'`** enables `@SimpleCommand` handling via `bot.executeCommand(message)`, which
  is why `MessageContent` is in the intents. `MessageContent` and `GuildMembers` are both privileged and must
  be enabled in the Discord developer portal.

**Module discovery** is `importx` over `src/{events,commands}/**/*.{ts,js}`. There is no manual registry:
a file is wired up purely by being in that tree and exporting a `@Discord()`-decorated class. Deleting a
command means deleting its file. `src/commands/slashes.ts` is an empty backwards-compatibility stub and is
intentionally inert.

### Commands

Commands live in `src/commands/categories/<category>/<name>.ts`. Each is a class:

```ts
@Discord()
@Category('Utility')
export class Ping {
  @Slash({ description: "Ping the bot to check if it's online" })
  async ping(
    @SlashOption({
      name: 'user',
      description: 'The user to look up',
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: GuildMember | null,
    interaction: CommandInteraction,
  ): Promise<void> {}
}
```

- **Parameter order matters.** discordx injects `interaction` and `client` *after* every `@SlashOption`
  parameter, in that order. Putting `interaction` first silently gives you an option value where you expected
  the interaction.
- **`@Category` from `@discordx/utilities` is what `/help` reads.** `help.ts` builds its category list by
  scanning `MetadataStorage.instance.applicationCommands` for a `category`, so a command without the
  decorator is invisible in `/help` while still being usable. Category strings are compared
  case-insensitively but displayed as written — reuse the exact casing of an existing category rather than
  inventing `utility` next to `Utility`. New categories should get an emoji in `categoryEmojis` in
  `help.ts`, otherwise they fall back to 🔧.
- **Components are bound by custom id**, not by the message they were sent on: `@SelectMenuComponent({ id })`,
  `@ButtonComponent({ id })`. Ids are global across the process, so prefix them per feature (`helpSelect`,
  `ticketOpen`) to avoid two features answering the same click. Where a component should only respond to the
  person who ran the command, check that explicitly — `help.ts` does, and without it any passer-by can drive
  someone else's menu.
- `/help` renders with **Components V2** (`ContainerBuilder`, `TextDisplayBuilder`,
  `MessageFlags.IsComponentsV2`). Components V2 messages cannot also carry `content` or `embeds`; if you add
  to that command, stay inside the container API.

### Events

Events are classes in `src/events/` using `@On()` / `@Once()`, with the handler method named after the
event and taking a destructured `[arg]: ArgsOf<'eventName'>`.

**Every event file registers additively, and nothing deduplicates.** `src/events/common.ts` handles
`messageCreate`, `interactionCreate` and `ready`, and `messageCreate.ts`, `interactionCreate.ts` and
`ready.ts` handle exactly the same three events — so as things stand each one runs twice and every command
executes twice. `common.ts` is the older, pre-split version and is the copy to delete; the split files are
the ones with the `ensureUserExists` call. Do not add a third handler for an event that already has one:
extend the existing class instead.

The two command-dispatch events are the only place errors are caught for commands. `messageCreate` calls
`bot.executeCommand(message)`, `interactionCreate` calls `bot.executeInteraction(interaction)`, both wrapped
in try/catch that hands the error to `errorHandler.handleError` with command, user, guild and channel
context. A command that throws is therefore already reported — don't wrap the whole body of a command in a
try/catch that swallows the error, or it disappears from the error channel.

Both dispatchers call `ensureUserExists()` **before** executing, guarded by `!author.bot`. That guarantee is
what lets a command assume the user row exists. Keep the bot guard: without it every webhook and bot message
in the server creates a `User` row.

## Database

Prisma over PostgreSQL, schema in [prisma/schema.prisma](prisma/schema.prisma), client generated to
`src/generated/prisma` (gitignored). Two models today:

- **`User`** — `discordId` is the unique Discord-facing key, `id` is a uuid used for relations. Always relate
  to `user.id`, never to the Discord ID. `language` defaults to `"nl"`.
- **`Setup`** — per-Discord-server configuration keyed by `guildId`, holding ticket channel/category/staff
  role/log channel and the automod switches and exception lists. This is the place for new server-scoped
  configuration; do not introduce JSON config files on disk the way TriBridge does — that pattern does not
  exist here and this bot has a database.

`src/utils/userManager.ts` owns user rows: `ensureUserExists()` (find, create, or update a changed
username), `getUserByDiscordId()`, `updateUserLanguage()`, `closePrismaConnection()`.

**Instantiate `PrismaClient` once.** `userManager.ts` creates one and `commands/categories/utility/profile.ts`
creates a second, so the process holds two connection pools and `closePrismaConnection()` only closes one of
them. New code must not add a third — import from `userManager.ts`, and when touching `profile.ts` collapse
it onto the shared client.

Schema changes go through `yarn prisma:push` in development. Follow the conventions in
`.cursor/rules/schema-conventions.mdc`: both sides of every relation, `createdAt` / `updatedAt` on every
model, `@@index` on frequently queried fields.

## Localization

`src/utils/localization.ts` holds a nested `locales` object for `nl`, `en` and `es`, with `t(key, locale,
params)` doing dotted-path lookup and `{placeholder}` substitution, and `tWithUser(key, userId, params)`
resolving the locale from the user's stored `language`. **The default locale is Dutch (`nl`)** — `t()` with
no locale is Dutch, and a missing key returns the key itself rather than throwing, so a typo shows up as
`commands.ping.respons` in the user's face rather than as an error.

Two things to know before extending it. The locale tables are far ahead of the code: they describe `ban`,
`kick`, `timeout`, `warn`, `setup`, `language` and `fetchData` commands that do not exist yet, so an entry
being present is not evidence that a feature is. And the tables still carry template residue from the
discordx starter — the bot statuses in `ready.ts` advertise "NightMT" and `discord.gg/opminetopia`, which is
the wrong community. Fix those when you touch that area rather than adding THG strings alongside them.

When you add a user-facing string, add it to **all three** locales. A key present only in `nl` renders as the
raw key path for English and Spanish users.

## Errors

`src/utils/errorHandler.ts` exports a singleton `errorHandler` plus `BotError`, `ErrorSeverity`,
`setupGlobalErrorHandlers()`, `safeDatabaseOperation()` and `createError()`. `handleError()` logs with
context, posts an embed to `ERROR_LOG_CHANNEL_ID` when configured, and replies ephemerally to the user when
an unanswered interaction is available. `main.ts` calls `errorHandler.setClient(bot)` after login — before
that call, errors log to the console only.

Stack traces and error messages are only included in the user-facing embed when `NODE_ENV === 'development'`.
Keep it that way: the channel embed already carries the full context for staff, and the reply is visible to
whoever ran the command.

Three known weaknesses, worth knowing before you rely on this module:

- **The rate limiter never resets.** `isErrorRateLimited` tries to expire entries by parsing the first
  segment of its own key as a timestamp, but the key starts with the command name — so counters only grow,
  and after ten errors for a given command/user pair that user stops getting *any* error feedback for the
  lifetime of the process.
- **The channel report happens before the rate-limit check**, so `ERROR_LOG_CHANNEL_ID` is not protected by
  it at all.
- **Shutdown handlers race.** `setupGlobalErrorHandlers()` registers SIGINT/SIGTERM handlers that call
  `process.exit(0)` synchronously, while `main.ts` registers its own that await `closePrismaConnection()`.
  Both fire; the synchronous one usually wins and the Prisma disconnect never completes.

## Conventions

- **"Guild" means two things — keep them apart.** A *Hypixel guild* is the SkyBlock guild the community is
  built around; a *Discord server* is the Discord community this bot serves. discord.js calls a server a
  "guild", so `interaction.guildId` and the `Setup.guildId` column are Discord server ids — that is the
  library's word, not ours. When you add anything that refers to the Hypixel guild, name it explicitly
  (`hypixelGuildId`, `guildTag`); never leave a bare `guildId` ambiguous.
- **ESM import specifiers need the `.js` extension.** `main.ts` and `dev.ts` get this right
  (`./utils/localization.js`); most files under `events/` and `commands/` do not (`'../bot'`). Extensionless
  specifiers work under `tsx` in development and fail at runtime under `node build/main.js`, because Node's
  ESM resolver does no extension guessing. Write new relative imports with `.js`, and fix the ones you touch.
- **Style is Biome's, configured in [biome.json](biome.json):** 2-space indent, **single quotes**, semicolons,
  ES5 trailing commas, 100-column lines. Run `yarn biome:fix` before finishing. Note `help.ts` is
  4-space-indented and out of line with the rest — reformatting it is fine, but do it as its own commit so
  it doesn't bury a behaviour change.
- **Biome only lints the paths in `files.includes`** (`src/commands`, `src/events`, `src/utils`, and the
  three entry points). A new top-level directory under `src/` — `services/`, say — is silently unchecked
  until you add it there. `src/types/` is currently in that blind spot.
- **`emitDecoratorMetadata` is `false` and must stay false.** discordx does not need it; enabling it pulls in
  `reflect-metadata` and changes emit for no benefit.
- **`noExplicitAny` is a warning, `noUnusedVariables` is an error.** Prefer a real type or `unknown` over
  `any`; the codebase already does this (`Record<string, unknown>` in the error context).
- **Replies:** `deferReply()` first for anything that hits the database or an external API, then
  `editReply()`. User-facing strings use ✅ / ⚠️ / ❌ prefixes and `>` blockquotes — `src/utils/util.ts`
  has `responseEmbed(ResponseType, content)` for the standard shapes; use it rather than rebuilding an embed.
- **Discord limits:** embed description 4096 characters, message content 2000, embed field value 1024. The
  error handler truncates explicitly at 1000; do the same for anything echoing API output.
- **External APIs:** `src/utils/sheetdb.ts` wraps the SheetDB moderation sheet with `axios`. It reads
  `SHEETDB_API_URL` and `SHEETDB_API_KEY` **at import time**, so `dotenv`'s `config()` must run before the
  module is imported — it does today because both entry points call it before `importx`, but that ordering is
  load-bearing. Any new API wrapper should read `process.env` inside the function instead.
- JSDoc on non-trivial helpers, matching `util.ts` and `errorHandler.ts`.
- Commit messages follow the sibling repository's `<tag>: <message>` convention (`Feature:`, `Improvement:`,
  `Fix:`, `Internal:`, `Backend:`, `Update:`), one granular commit per logical change.

## Known rough edges

This repository is a lightly-modified discordx template and several starter artefacts are still in place.
Treat these as known, not as things to discover again:

- Duplicate event handlers (`common.ts` vs the split files) — see **Events**.
- Two `PrismaClient` instances — see **Database**.
- `main.ts` calls `bot.clearApplicationCommands(...bot.guilds.cache.map(g => g.id))` immediately after
  login. The cache is normally still empty at that point, so it clears *global* commands — which is what you
  want given `botGuilds` — but it races the `ready` handler that registers guild commands, and would wipe
  them if the cache ever were populated. Don't build on this ordering.
- `src/types/environment.d.ts` declares `CLIENT_ID` and `BUG_REPORT_CHANNEL_ID`, which nothing reads, and
  omits `ERROR_LOG_CHANNEL_ID` and the SheetDB variables, which several things do.
- [docker-compose.yml](docker-compose.yml) passes the token as `BOT_TOKEN` while the code reads
  `DISCORD_TOKEN`, so the container as written cannot log in. It also runs its own throwaway Postgres
  rather than attaching to the existing server.
- `interaction.message.interaction` in `help.ts` is deprecated in discord.js v14 in favour of
  `interactionMetadata`.
- `README.md` still opens with the commented-out discordx template banner and describes itself as a
  "Discord Bot Template".

## Files to leave alone

`.env`, `.env.local`, `src/generated/` and `build/` — local, generated or secret state. Never print or
commit a token, a database URL or a SheetDB key.
