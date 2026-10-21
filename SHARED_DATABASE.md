# The shared database

This bot and [TriBridge](https://github.com/TheHypixelGuardians/TriBridge) are two processes serving one Discord server,
and their **features are separate**. Each has its own account links: linking on one bot does not carry over to
the other. They share exactly three things — **the PostgreSQL database**, **the blacklist** in it, and **the
bot-admin roles** in it.

Linking used to be shared too: this bot owned the links and the bridge read them. That made a feature on one bot
depend on the other's tables and caches, so links were split on 2026-10-21. Admin roles were split the same day
and shared again straight after, at the owner's request: one staff list for both bots is the point of them.

**This bot owns the `public` schema.** [prisma/schema.prisma](prisma/schema.prisma) defines every table there,
and its migrations (`yarn prisma:migrate`) are what create them. TriBridge has no Prisma schema. It keeps its own
settings and links in a separate `tribridge` schema that this bot never touches, and reaches into `public` only
for the blacklist and the admin roles, with plain SQL through its `src/utils/db.js` and the same `DATABASE_URL`.

## Shared table: `Blacklist`

**TriBridge writes it, this bot reads it.** `/blacklist add|remove|list` lives on the bridge, so the bridge
inserts and deletes those rows; this bot only reads them (`src/utils/blacklist.ts`) and refuses every
interaction from a listed member. Because TriBridge never runs Prisma, the columns it relies on have
**database-side** defaults: `id` is `gen_random_uuid()` and `updatedAt` defaults to `now()`. Prisma's
client-side `uuid()` and `@updatedAt` would leave a raw insert failing on a null id. Keep those defaults if the
model changes, and change TriBridge in the same task if a column is renamed: its failed query returns `null`,
which it reads as "nobody is blacklisted".

The writer is another process, so this bot caches the list for 15 seconds rather than invalidating on write.
The check **fails open**: an unreadable database lets members through, because failing closed would lock the
whole server out of both bots during an outage. `isAdmin()` still fails closed, so nothing privileged opens up.

## Shared table: `AdminRole`

**This bot writes it, both bots read it.** `/adminrole add|remove|show` (and the admin-role select in `/setup`)
live here; TriBridge has no `/adminrole` and no write path. It selects `"roleId"` where `"guildId"` is its
Discord server, so a role that is staff here is staff on the bridge too, including `/send`, which runs any
command as a Minecraft account.

TriBridge cannot see this bot's writes, so it caches the list for 15 seconds; that is the lag between a change
here and the bridge honouring it. Both sides **fail closed**: an unreadable database makes nobody an admin.
Renaming `roleId` or `guildId` **breaks the bridge silently**, because its failed query reads as "not an admin"
for everyone. Change TriBridge's `src/utils/adminRoles.js` in the same task.

## A one-time read of `MinecraftLink`

TriBridge reads `MinecraftLink` and `User` exactly once: on its first start with no link list of its own, to
start that list from this bot's links so nobody had to link again. The copy is saved even when it is empty, so it
never repeats. After it, the two link lists are independent and changing these tables does not affect the bridge.

## What TriBridge keeps to itself

The admin panel, the global profile change, the audit channel, the Hypixel guild registry and the bridge's links
are TriBridge's own, stored in its `tribridge.config` table (with local JSON snapshots on its
server). Nothing in this bot starts, stops or records a disguise — if you are looking for `/adminpanel`, it is on
the bridge.

## Failure behaviour

This bot is the owner and treats a database failure as a real error: commands surface it through the error
handler. TriBridge loads its settings at startup and starts from its local snapshots if the database is
unreachable. Its side of the contract is written up in its own `docs/SHARED_DATABASE.md`.

## Caching here

This process is the only writer of everything except `Blacklist`, so those caches are invalidated on write rather than expiring —
[`setup.ts`](src/utils/setup.ts), [`adminRoles.ts`](src/utils/adminRoles.ts) and
[`linkedAccounts.ts`](src/utils/linkedAccounts.ts) all work that way.
