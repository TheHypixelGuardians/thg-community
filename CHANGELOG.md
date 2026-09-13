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
    + The admin panel, the global profile change and auditing stay on **TriBridge** — all three reach into
      guild chat, so they belong with the Minecraft side. `/adminpanel` and `/auditchannel` are still run
      there, and the role list configured here is what gates them.

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

