# CLAUDE.md

Guidance for Claude Code when working in this repository.

## After every change: keep docs and changelog in sync

This repository is young and its documentation is thin, so it is easy to leave behind. Before finishing
any task that changes the bot:

1. **Update the changelog** — add an entry under `## Unreleased` in [CHANGELOG.md](CHANGELOG.md), in the
   same commit as the change itself so the changelog never lags behind.
    - Format is SkyHanni-style, matching the sibling TriBridge repository: `##` release section
      (`Unreleased` / `Version X.Y.Z`), then a `###` category (`New Features` / `Improvements` / `Fixes` /
      `Technical Details` / `Removed Features`), then a `####` feature area (`Moderation`, `Tickets`,
      `Profiles`, `Skyblock`, `Localization`, `Admin Setup`, `Documentation`, `Core`, `Misc` — free-form,
      `Misc` is the catch-all), then `+` bullets, one change per bullet, indented `+` sub-bullets for details.
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

3. **Keep the README current — and expand it as the project expands.** [README.md](README.md) is the
   canonical user-facing description (there is no `docs/` folder yet), so it must grow with the bot rather
   than staying a thin install sheet. Whenever a change lands that a host or a member would care about,
   update the README in the same task:
    - **New or changed command** → a row in the Commands table (name, category, one-line description).
    - **New or changed `.env` variable** → a row in the Environment variables table *and* matching entries
      in [src/types/environment.d.ts](src/types/environment.d.ts) and [.env.example](.env.example) — those
      three drift apart constantly, and a missing `.env.example` line is how a fresh clone fails at boot
      with no explanation.
    - **New feature or subsystem** → a bullet under Features (what it does, any switch to turn it on). When
      a feature outgrows a bullet, give it its own `<SUBSYSTEM>.md` at the root (see step 4) and leave a
      one-line summary plus link in the README — do not let the README become the only place the behaviour
      is described, and do not leave the README without at least that summary.
    - **Installation, intents, Node/Yarn version, scripts, project structure, database models** → update
      the matching section. A section that no longer matches the code is worse than no section.
    - Skip only changes with no effect on running or understanding the bot (e.g. a changelog typo).
    - Write for whoever hosts or uses the bot, not for developers; implementation traps belong in this
      file and in subsystem docs.

4. **Check the subsystem docs** — [USER_MANAGEMENT.md](USER_MANAGEMENT.md) documents automatic user
   registration and is the model for how a subsystem gets written up here: what it does, where it hooks in,
   what happens when it fails. When a subsystem outgrows a README bullet, give it its own `<SUBSYSTEM>.md`
   at the root rather than swelling the README. Keep the existing ones honest — `USER_MANAGEMENT.md` once
   described an `ideas` relation and a `common.ts` handler from a different bot, which is exactly the rot to
   avoid.
    - One rule worth carrying over from TriBridge: where a rule exists because the obvious alternative was
      actively harmful (a silent drop, a double-executed command, a permission escalation), say so. That
      sentence is what stops the rule being "simplified" away later.

Releases: bump `version` in `package.json` and rename `## Unreleased` to `## Version X.Y.Z` in **both**
changelogs, adding a fresh empty `## Unreleased` above it. The bot is on a pre-release alpha line —
versions are `0.0.1-alpha.N` for now.

**Do not create git tags by hand.** Pushing a `package.json` version bump to `main` where the new version
is a minor or major (`X.Y.0` — patch component must be `0`, no prerelease suffix) triggers
[.github/workflows/release.yml](.github/workflows/release.yml). That workflow extracts the matching
`## Version X.Y.Z` section from [CHANGELOG.md](CHANGELOG.md) and creates the GitHub Release (and its
`vX.Y.Z` tag). Patch bumps (`X.Y.Z` with `Z ≠ 0`) are ignored on purpose — ship those without a GitHub
Release. The changelog heading must already exist before the push; an empty or missing section fails the
job rather than publishing a blank release. Use `workflow_dispatch` only to re-run a missed release.

## Project

The THG community bot is the Discord bot for the THG community server — a Hypixel SkyBlock guild
community. It handles the Discord side of community life: member profiles, account linking, bot-admin
roles, the admin panel, feature requests, moderation, tickets, automod and SkyBlock-facing lookups.

It is **not** a bridge. There is no `mineflayer`, no Minecraft account, no Hypixel guild chat relay and no
in-game presence on Hypixel. Anything that needs a Minecraft client belongs in the sibling **TriBridge**
repository (`../TriBridge`), which owns the Discord ↔ Hypixel guild chat bridge. SkyBlock features here
talk to HTTP APIs (Hypixel, Mojang, SkyCrypt) and nothing else — if a feature seems to need an in-game
account, it is a TriBridge feature, not one for this repo.

The one Minecraft piece is the **`/link` verification server** (`utils/linkVerification.ts`): a
`minecraft-protocol` *server* that players join to prove they own an account, kicked at login with a code.
It is not a client and holds no account. It starts from `main.ts` and `dev.ts`, stops in
`utils/shutdown.ts`, and is off unless `VERIFY_SERVER_PORT` and `VERIFY_SERVER_ADDRESS` are both set. A
verified link takes the account over from an earlier claim (`setLink(..., { takeOver: true })`); an unverified
one never does, or anyone could steal a verified member's account by typing its name. The `/link` flow is
username modal → ephemeral embed with an **Enter code** button (`linkEnterCode`) → code modal → the embed is
edited to success. The username step's profile is held in memory per Discord user, and `redeemCode()` takes
that UUID so a code only redeems for the account the member named.

The admin panel, the global profile change and auditing are **TriBridge's**, not this bot's — all three
reach into guild chat, so they live with the Minecraft side. There is no `/adminpanel` here.

**The two bots' features are separate** (the owner's rule): they share the PostgreSQL database, the
blacklist and the bot-admin roles, and nothing else. This bot owns the `public` schema. Account links
(`MinecraftLink`) here are this bot's alone; TriBridge has its own `/link` in its own `tribridge` schema, and
must not be pointed back at this table. **`AdminRole` is shared**: `/adminrole` lives here only, and TriBridge
reads the table with plain SQL for its own admin commands. TriBridge writes `Blacklist` with plain SQL and
nothing else here. Renaming a column in either **breaks the bridge silently** (a failed query reads as
"nobody is blacklisted" or "nobody is an admin"). Read [SHARED_DATABASE.md](SHARED_DATABASE.md) before
touching them, and change TriBridge in the same task.

- **TypeScript, ESM, decorators.** `"type": "module"`, `experimentalDecorators: true`, `strict: true`.
  Commands and events are classes decorated with [discordx](https://discordx.js.org) decorators — there is
  no `module.exports` command object and no hand-written event router.
- Node **22+** in `engines` (`minecraft-protocol` requires it; Prisma 7 and chokidar 5 need 20.19+);
  development is on current LTS.
  Yarn 1 is the package manager. `yarn.lock` is committed (it used to be gitignored, so no two installs or
  Docker builds were guaranteed the same dependency tree); the Docker build installs with
  `--frozen-lockfile`, so commit the lockfile with every dependency change.
- Dependencies: `discordx` 11.x, `discord.js` v14, `@discordx/importer`, `@discordx/utilities` **8.x**,
  `@prisma/client` **7.x** + `prisma` **7.x** (same major — never mix with Prisma 8 RC),
  `@prisma/adapter-pg`, `dotenv`, `pg`, `skyhelper-networth`, `minecraft-protocol`. Dev: `tsx`, `chokidar` 5, `nodemon`, `@biomejs/biome`,
  `typescript` 5.9.x. Stay on Prisma 7 until Prisma 8 is stable; TypeScript stays on 5.x for ecosystem
  compatibility.
- **No test suite.** There is no `test` script. Verification is typechecking (`yarn build`) and linting
  (`yarn lint`); most utilities are pure and easy to reason about, so prefer reading them over running the
  bot.
- Biome is the linter *and* formatter — there is no ESLint and no Prettier.

## Running

```bash
yarn setup        # install + prisma generate + prisma migrate deploy
yarn dev          # tsx src/dev.ts — hot reload of commands and events
yarn watch        # nodemon wrapper around yarn dev
yarn build        # empty build/, prisma generate, tsc -> build/
yarn start        # node build/main.js
yarn biome:fix    # lint --write + format --write
```

Requires a `.env` (gitignored) with at minimum `DISCORD_TOKEN` and `DATABASE_URL`; `ERROR_LOG_CHANNEL_ID`,
`LOG_CHANNEL_ID`, `HYPIXEL_API_KEY` and `NODE_ENV` are optional but several features are inert without them. See [.env.example](.env.example).

**`yarn prisma:generate` is not optional.** The Prisma client is generated into `src/generated/prisma`
(gitignored), so a fresh clone will not typecheck or boot until you run it — every import of
`../generated/prisma/client.js` fails with a module-not-found that looks like a broken path but isn't.
`yarn build` runs it first, and `tsc` compiles the client into `build/generated/prisma` with the rest.
The database URL lives in [prisma.config.ts](prisma.config.ts), not in the schema. It reads
`process.env.DATABASE_URL` rather than Prisma's `env()`, because `env()` throws when the variable is unset
and `prisma generate` (the build, the Docker image) has no database.

`main.ts` imports `dotenv/config` as its **first** import. `utils/prisma.ts` reads `DATABASE_URL` when it is
imported, and ESM evaluates every static import before the module body, so a `config()` call in the body
runs too late.

Running the bot logs into live Discord as the community bot and registers slash commands against real
servers. Don't start it to "verify" a change unless asked.

## Architecture

There are **two entry points and they are not equivalent**:

- **`src/main.ts`** (production) loads `.env`, installs the global error handlers, discovers modules with
  `importx`, registers the graceful shutdown, logs in and sets the error handler's client. A failed start
  (missing token, failed login) exits with code 1 so a supervisor restarts it; it used to leave an idle
  process behind that never exited.
- **`src/dev.ts`** (development) loads `.env`, discovers modules, logs in, and then watches the `events/` and
  `commands/` folders with `chokidar`, filtering to `.ts`/`.js` (chokidar 4+ has no glob support: it was
  once handed the import glob, matched nothing, and hot reload silently never fired); on any change it calls `bot.removeEvents()`, clears `MetadataStorage` and the DI engine,
  re-imports every file with a cache-busting `?version=` query, rebuilds the metadata and re-runs
  `initApplicationCommands()`.

Both register the **one** SIGINT/SIGTERM path, `registerGracefulShutdown()` in `src/utils/shutdown.ts`: it
destroys the Discord client, awaits `closePrismaConnection()`, then exits. Nothing else may call
`process.exit` on a signal — `errorHandler.ts` used to, synchronously, and that exit won the race so the
Prisma disconnect never ran.

`dev.ts` deliberately does *not* install the global error handlers. That means an unhandled rejection behaves differently under `yarn dev` than in production — when you are
debugging a crash that "only happens in production", this asymmetry is the first thing to check. If you add
startup work, add it to **both** files or it will silently not happen in one of them.

**`src/bot.ts`** exports the single `Client` instance. Everything else imports `bot` from there; there is no
DI container in use and no second client. Two settings there are load-bearing:

- **`botGuilds`** maps to every cached guild, so commands register **per guild**, not globally. That is why
  changes appear instantly instead of taking up to an hour — but it also means a guild the bot joins after
  startup gets no commands until `initApplicationCommands()` runs again. Switching to global commands is a
  deliberate decision, not a cleanup. `clientReady` clears stale *global* commands once, awaited, before
  `initApplicationCommands()`; a failure there is logged and registration goes ahead. (It used to run in
  `main.ts` right after login, where it raced the registration and would have wiped the guild commands
  had the guild cache been populated.)
- **No prefix commands.** There is no `simpleCommand` option and no `messageCreate` handler, so the bot
  needs neither the `GuildMessages` nor the privileged `MessageContent` intent. Bringing prefix commands
  back means all three, plus the `ensureUserExists` call in the new handler.
- **Intents are `Guilds` and `GuildMembers`, nothing else.** `GuildMembers` is privileged and must be enabled
  in the Discord developer portal. It is there for the link role: `utils/linkRole.ts` resolves members with
  `guild.members.fetch(id)` (cached member if there is one) and reads `member.roles.cache`, which only stays
  current while the bot receives member updates. Add an intent only together with the code that needs it.

**Module discovery** is `importx` over `src/{events,commands}/**/*.{ts,js}`. There is no manual registry:
a file is wired up purely by being in that tree and exporting a `@Discord()`-decorated class. Deleting a
command means deleting its file.

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
- **`/setup`** is an ephemeral Components V2 panel of channel and role selects (`setupLogChannel`,
  `setupRequestChannel`, `setupLinkRole`, `setupAdminRoles`). Emptying a select clears that setting, which
  is why every select has `minValues(0)`. It opens for a bot admin *or* a holder of Discord's Administrator
  permission, because a fresh server has no admin roles yet. Every select, the admin-role one included, is
  open to the same people, and `/adminrole` follows the same rule: the owner chose to let any bot admin edit
  the admin role list, knowing a bot admin can then make others admins on both bots (the bridge's `/send`
  included). Every select handler re-checks the
  clicker: a permission can be revoked while the panel is open. Link-role and channel validation live in
  `utils/linkRole.ts` (`assignableProblem`) and `utils/channelPermissions.ts`, shared with `/linkrole` and
  `/requestchannel`, so the panel and the commands refuse the same things.
- `/help` renders with **Components V2** (`ContainerBuilder`, `TextDisplayBuilder`,
  `MessageFlags.IsComponentsV2`). Components V2 messages cannot also carry `content` or `embeds`; if you add
  to that command, stay inside the container API.

### Events

Events are classes in `src/events/` using `@On()` / `@Once()`, with the handler method named after the
event and taking a destructured `[arg]: ArgsOf<'eventName'>`.

**Every event file registers additively, and nothing deduplicates.** One class per Discord event —
`interactionCreate.ts`, `clientReady.ts`. Do not add a second handler for an event that
already has one: extend the existing class instead. A previous `common.ts` that registered the same three
events caused every command to run twice (`InteractionAlreadyReplied` on the second reply); that file is
gone and must not come back.

`interactionCreate` is the only place errors are caught for commands. It calls
`bot.executeInteraction(interaction)` inside a try/catch that hands the error to `errorHandler.handleError`
with command, user, guild and channel context. A command that throws is therefore already reported — don't
wrap the whole body of a command in a try/catch that swallows the error, or it disappears from the error
channel.

It calls `ensureUserExists()` **before** executing, guarded by `!interaction.user.bot`. That guarantee is
what lets a command assume the user row exists. Keep the bot guard: without it every bot that triggers an
interaction creates a `User` row. (A `messageCreate` handler used to do the same for every message anybody
sent, for prefix commands that never existed.)

## Database

Prisma **7** over PostgreSQL. Schema in [prisma/schema.prisma](prisma/schema.prisma); CLI config in
[prisma.config.ts](prisma.config.ts) (`datasource.url` from `DATABASE_URL`). Generator is
`provider = "prisma-client"` with output `src/generated/prisma` (gitignored). Import the client from
`../generated/prisma/client.js`. The models:

- **`User`** — `discordId` is the unique Discord-facing key, `id` is a uuid used for relations. Always relate
  to `user.id`, never to the Discord ID. A legacy `language` column may still exist on the row; the bot
  does not read it (English-only UI).
- **`Setup`** — per-Discord-server configuration keyed by `guildId`, holding ticket channel/category/staff
  role/log channel and the automod switches and exception lists. This is the place for new server-scoped
  configuration; do not introduce JSON config files on disk the way TriBridge does — that pattern does not
  exist here and this bot has a database.

- **`MinecraftLink`** — a member's Minecraft account, related to `User.id`. This bot's links only; TriBridge
  copied them once to start its own list and does not read them since.
- **`AdminRole`** — the bot-admin role list, per Discord server, shared with TriBridge (which reads it with
  plain SQL and a 15-second cache). `isAdmin` fails closed on both sides.
- **`Blacklist`** — members barred from both bots' commands. Written by TriBridge; see below.
- **`FeatureRequest`** — a `/request` submission. `id` is a sequence on purpose: it is the number members
  see, and a counter the bot read and wrote back across an await would let two concurrent submits share one.

**Caches are invalidated on write, not expired**, because this process owns every write:
`utils/setup.ts`, `utils/adminRoles.ts` and `utils/linkedAccounts.ts` all work that way. The one exception
is `Blacklist`, whose writer is TriBridge, so it expires on a 15-second timer instead.

`src/utils/prisma.ts` owns the **single** shared `PrismaClient`, constructed with `@prisma/adapter-pg`,
and exports `closePrismaConnection()`. Import `prisma` from there — never construct a second client in a
command. `src/utils/userManager.ts` holds user-row helpers (`ensureUserExists`, `getUserByDiscordId`)
on top of that client.

Schema changes are **migrations**: change `schema.prisma`, run `yarn prisma:migrate:dev` against a
development database, and commit the generated folder under `prisma/migrations/` with the schema change.
Production applies them with `yarn prisma:migrate` (`migrate deploy`), which the Docker image runs before
the bot starts. CI applies them all to an empty database and runs `prisma migrate diff --exit-code`, so a
schema change without its migration fails the PR. Never `prisma db push` against the shared database: it
records no migration, and the next deploy would then try to create tables that already exist. `0_init` is the
baseline the live database was pushed with; an existing push-created database is switched over once with
`yarn prisma:baseline`.

**`Blacklist` is written by TriBridge**, with plain SQL, so its `id` (`gen_random_uuid()`) and `updatedAt`
(`now()`) defaults must stay **database-side**. A client-side `@default(uuid())` would make every bridge
insert fail. It is read here by `utils/blacklist.ts`, cached for 15 seconds because the writer is another
process, and it **fails open**. `interactionCreate` refuses every interaction from a listed member before
`ensureUserExists`, so a refused interaction creates no `User` row.

Follow the conventions in
`.cursor/rules/schema-conventions.mdc`: both sides of every relation, `createdAt` / `updatedAt` on every
model, `@@index` on frequently queried fields.

## Localization

There is none. The bot is English-only, and user-facing strings are plain literals in the file that uses
them. A `utils/localization.ts` with a single English table and a `t(key)` lookup used to sit in between; a
mistyped key there showed the raw key path to the member instead of failing the build, and most of its keys
were for commands that do not exist. If a second language is ever needed, that is a decision to make then,
not a module to keep warm.

## Errors

`src/utils/errorHandler.ts` exports a singleton `errorHandler` plus `BotError`, `ErrorSeverity`,
`setupGlobalErrorHandlers()`, `safeDatabaseOperation()` and `createError()`. `handleError()` logs with
context, posts an embed to `ERROR_LOG_CHANNEL_ID` when configured, and replies ephemerally to the user when
an unanswered interaction is available. `main.ts` calls `errorHandler.setClient(bot)` after login — before
that call, errors log to the console only.

Stack traces and error messages are only included in the user-facing embed when `NODE_ENV === 'development'`.
Keep it that way: the channel embed already carries the full context for staff, and the reply is visible to
whoever ran the command.

The error replies are rate limited per command/user pair: ten per one-minute window, tracked with a window
start per key. (An earlier version parsed a timestamp out of a key that starts with the command name, so the
counters never expired and a user who hit ten errors got no error feedback until the next restart.)

One known weakness, worth knowing before you rely on this module: **the channel report happens before the
rate-limit check**, so `ERROR_LOG_CHANNEL_ID` is not protected by it at all.

`setupGlobalErrorHandlers()` only handles `unhandledRejection` and `uncaughtException`. Signals belong to
`utils/shutdown.ts` (see Architecture).

## Conventions

- **"Guild" means two things — keep them apart.** A *Hypixel guild* is the SkyBlock guild the community is
  built around; a *Discord server* is the Discord community this bot serves. discord.js calls a server a
  "guild", so `interaction.guildId` and the `Setup.guildId` column are Discord server ids — that is the
  library's word, not ours. When you add anything that refers to the Hypixel guild, name it explicitly
  (`hypixelGuildId`, `guildTag`); never leave a bare `guildId` ambiguous.
- **ESM import specifiers need the `.js` extension.** Every relative import has one, and the generated
  Prisma client gets them from `importFileExtension = "js"` in the generator. Extensionless specifiers work
  under `tsx` in development and fail at runtime under `node build/main.js`, because Node's ESM resolver
  does no extension guessing — `yarn dev` hides the mistake. Write new relative imports with `.js`.
- **Style is Biome's, configured in [biome.json](biome.json):** 2-space indent, **single quotes**, semicolons,
  ES5 trailing commas, 100-column lines, LF line endings. Run `yarn biome:fix` before finishing; `yarn lint`
  passes on a clean checkout, so any error it reports is yours.
- **Biome checks every `.ts` file under `src/`** except the generated Prisma client (`files.includes` is
  `src/**/*.ts` minus `src/generated`). It used to list folders one by one, which left new folders such as
  `src/types/` silently unchecked.
- **Line endings are LF everywhere** (`.gitattributes` and Biome's `lineEnding`). Git for Windows defaults to
  `core.autocrlf=true`, which checked files out with CRLF and made every file fail Biome's format check.
- **`emitDecoratorMetadata` is `false` and must stay false.** discordx does not need it; enabling it pulls in
  `reflect-metadata` and changes emit for no benefit.
- **`noExplicitAny` is a warning, `noUnusedVariables` is an error.** Prefer a real type or `unknown` over
  `any`; the codebase already does this (`Record<string, unknown>` in the error context).
- **`isAdmin()` is async and fails closed.** `utils/adminRoles.ts` reads the shared `AdminRole` table, so
  the check is `await isAdmin(interaction.member as GuildMember)`. Dropping the `await` is silently
  catastrophic: a bare promise is truthy, so `if (!isAdmin(...))` lets *everybody* past. It returns false on
  a database error on purpose — the admin panel can impersonate everybody in the server.
- **Replies:** `deferReply()` first for anything that hits the database or an external API, then
  `editReply()`. User-facing strings use ✅ / ⚠️ / ❌ prefixes and `>` blockquotes — `src/utils/util.ts`
  has `responseEmbed(ResponseType, content)` for the standard shapes; use it rather than rebuilding an embed.
- **Discord limits:** embed description 4096 characters, message content 2000, embed field value 1024. The
  error handler truncates explicitly at 1000; do the same for anything echoing API output.
- **External APIs** (Hypixel, Mojang) use the built-in `fetch`; there is no HTTP client dependency. Read `process.env` inside the function, as `utils/hypixel.ts` does, not at import time.
- JSDoc on non-trivial helpers, matching `util.ts` and `errorHandler.ts`.
- Commit messages follow the sibling repository's `<tag>: <message>` convention (`Feature:`, `Improvement:`,
  `Fix:`, `Internal:`, `Backend:`, `Update:`), one granular commit per logical change.

## Known rough edges

This repository is a lightly-modified discordx template and several starter artefacts are still in place.
Treat these as known, not as things to discover again:

- There is still no unit test suite; CI covers lint, the build and the migrations.

## Secret scanning

`.githooks/pre-commit` runs `gitleaks` on staged changes, and `.github/workflows/secret-scan.yml` scans the
full history on every push and pull request. The `prepare` script (`scripts/setup-hooks.cjs`) points
`core.hooksPath` at `.githooks` only when no `core.hooksPath` is configured yet: overriding a global hooks
folder would silently switch off the owner's global hooks. Never commit with `--no-verify`.

## Files to leave alone

`.env`, `.env.local`, `src/generated/` and `build/` — local, generated or secret state. Never print or
commit a token, a database URL or an API key.
