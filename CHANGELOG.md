# Changelog

All notable changes to the THG community bot are documented here.

Format is SkyHanni-style: `##` release section, `###` category, `####` feature area, then `+` bullets.
See [CLAUDE.md](CLAUDE.md) for the full conventions.

## Unreleased

### New Features

#### Account Linking

+ Added `/link <username>`, which binds your Minecraft account to your Discord account. TriBridge reads the
  link and uses it to attribute guild chat, so linking here is what makes the bridge show your Minecraft head
  and name.
    + The account's UUID is stored alongside the name, so a link survives a Minecraft rename.
    + One link per Discord user and one Discord user per Minecraft account, both enforced — silently
      reassigning an account would let anybody wear a guild member's identity across the bridge.
    + The name is verified with Mojang. Guild membership is **not** checked: that used to read the live
      Hypixel roster, which needs a Minecraft account, and this bot has none. An admin undoes a wrong link
      with `/unlink user:@them`.
+ Added `/unlink [user]` to remove your own link, or anybody's with a bot-admin role.
+ Added `/whois <user|username>` and `/links` for admins, to look a link up in either direction or list them
  all.
+ Added `/linkrole set|show|clear`, an optional role handed to everybody who links. Setting it backfills the
  role onto everybody already linked, and every startup re-syncs from the stored links so a link made while
  the bot was down still gets it.
    + The role never gates the link: a missing role or a lost **Manage Roles** is reported and the link goes
      ahead anyway.
    + The sync only ever *adds*. The role may be handed out for unrelated reasons, so it is never stripped
      from somebody merely because they have no link.
+ See [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md).

#### Admin Setup

+ Added `/adminrole add|remove|show`, the list of Discord roles that count as bot-admin. TriBridge reads the
  same list, so one list decides who is staff on both bots.
    + Gated on the Discord **Administrator** permission, because it is the command that decides who else is
      an admin.
    + **Until it has an entry, nothing admin-gated works** on either bot.
+ Added `/adminpanel`, an ephemeral panel with a button per admin function. It shows what is running — who,
  since when, how much longer, and which bridge legs are switched on — plus **Stop effect** and **Refresh**.
+ Added the **global profile change**: for a chosen duration, everybody's messages are reposted wearing one
  member's name and avatar, in Discord and across the Hypixel guild-chat bridge.
    + Durations run from five minutes to a day, until stopped, or a custom `90m` / `2h30m` / `1d12h`.
    + **Test mode** applies it only to listed testers in listed channels, so it can be tried before it goes
      server-wide. Over the bridge a tester is recognised by their account link — without that, testing would
      silently relabel guild members who never agreed to take part.
    + Each bridge direction has its own switch. Switching *Discord → Minecraft* off stops the disguise at the
      bridge rather than turning it off outright.
    + Channels can be excluded from a live effect. The bridge channel and every officer channel are excluded
      always, because TriBridge handles the first itself and a repost in the second would be dropped by its
      officer relay — losing the message with no error anywhere.
    + The target is never disguised as themselves, and an effect that has lapsed is cleared the next time
      anything asks whether it is running, so a timer lost to a restart can never leave the disguise stuck on.
    + Messages carrying stickers, polls, forwards or voice notes are left undisguised rather than reposted
      without them, and `!`-prefixed messages are left alone so a command's reply does not end up pointing at
      a deleted message.
+ Added `/auditchannel set|show|clear`. Reposting deletes the original, so this channel is the only way back
  to who really sent a disguised message; every repost is recorded there with a jump link, along with the
  start and end of each effect. TriBridge records its own bridge legs into the same channel.
+ See [GLOBAL_PROFILE.md](GLOBAL_PROFILE.md).

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

#### Core

+ Slash commands no longer run twice (removed duplicate `common.ts` event handlers that caused
  `InteractionAlreadyReplied` after `/help` and other commands)
+ `/help` no longer shows an empty Miscellaneous category (moved into Utility; categories with no
  listable commands are omitted from the picker)
+ Removed debug `console.log` spam when browsing `/help` categories

### Technical Details

#### Core

+ Bumped `@discordx/utilities` to 8.0.0 so `@Category` works with `discordx` 11.13 (fixes
  `decorateUnknown is not a function` on startup)
+ Aligned Prisma on stable 7.10.0 for both `prisma` and `@prisma/client` (dropped the mismatched 8 RC CLI)
+ Added `prisma.config.ts`, switched the generator to `prisma-client`, and wired `@prisma/adapter-pg`
+ Shared a single Prisma client from `utils/prisma` (`/profile` and user helpers import it; no second pool)
+ Split Prisma client setup out of `userManager` into `utils/prisma.ts`
+ Raised the Node engine requirement to `>=20.19.0` and upgraded TypeScript to 5.9.3, Biome, chokidar 5,
  and related dependencies
+ Migrated the community half of TriBridge into this bot, leaving that repository as the bridge and nothing
  else. Account linking, bot-admin roles, the admin panel, the global profile change, auditing and feature
  requests all moved; the bridge keeps only the legs that need a Minecraft account.
+ Added seven Prisma models: `MinecraftLink`, `AdminRole`, `FeatureRequest`, `GlobalProfileEffect` and
  `BridgeChannel`, plus link-role, request-channel, audit-channel and log-channel columns on `Setup` and the
  matching relations on `User`. TriBridge reads four of them with plain SQL, so renaming a column there breaks
  the bridge silently — see [SHARED_DATABASE.md](SHARED_DATABASE.md).
+ `BridgeChannel` is the one table TriBridge *writes*: it publishes its bridge channel and every officer
  channel at startup, and the disguise here skips them. Publishing beats a second copy of the ids in this
  bot's configuration, which would go stale the moment a guild's officer channel changed.
+ Caches for the per-message disguise gate are invalidated on write rather than expiring, because this
  process owns every write. `bridgeChannels.ts` is the exception at a 60s TTL, and serves the stale set on a
  failed read rather than an empty one — an empty set would let the disguise repost into the bridge and
  officer channels.
+ The admin panel is dispatched from `interactionCreate` rather than through discordx's component decorators.
  It mixes buttons, user selects, channel selects and a modal under one `panel:` id space, and every click
  re-checks that the clicker is still an admin and still the person who opened it.
+ `messageCreate` gained the disguise repost; `clientReady` gained the link-role sync and the re-arming of
  the global profile expiry timer. Both extend the existing handler class rather than adding a second one for
  the same event.
+ Added `LOG_CHANNEL_ID`, and the matching entries in `.env.example` and `src/types/environment.d.ts`. That
  file also gained the `ERROR_LOG_CHANNEL_ID` and SheetDB variables it had been missing.
+ Removed the unused `parseDuration` from `utils/util.ts`; `utils/duration.ts` has a superset of it that
  understands `2h30m` and "forever", and two functions of the same name with different semantics is a trap.

#### Documentation

+ Replaced the discordx template README with a project-accurate description of the THG community bot
  (features, intents, env vars, commands, scripts, structure, database).
+ CLAUDE.md now requires the README to expand as the project expands — new commands, env vars and
  features update it in the same task.
+ Added [ACCOUNT_LINKING.md](ACCOUNT_LINKING.md), [GLOBAL_PROFILE.md](GLOBAL_PROFILE.md) and
  [SHARED_DATABASE.md](SHARED_DATABASE.md); the last is the contract between the two bots — what each reads,
  what TriBridge writes, and what happens when Postgres is unreachable.
+ Updated the README's features, commands, environment variables, project structure and database sections for
  everything above.

