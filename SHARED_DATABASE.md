# The shared database

This bot and [TriBridge](https://github.com/TheHypixelGuardians/TriBridge) are two processes serving one Discord server,
and their **features are separate**. Each has its own account links and its own bot-admin roles: linking or being
staff on one bot does not carry over to the other. They share exactly two things — **the PostgreSQL database**,
and **the blacklist** in it.

Linking and admin roles used to be shared too: this bot owned both and the bridge read them. That made a
feature on one bot depend on the other's tables and caches, so they were split back on 2026-10-21.

**This bot owns the `public` schema.** [prisma/schema.prisma](prisma/schema.prisma) defines every table there,
and its migrations (`yarn prisma:migrate`) are what create them. TriBridge has no Prisma schema. It keeps its own
settings, links and admin roles in a separate `tribridge` schema that this bot never touches, and reaches into
`public` only for the blacklist, with plain SQL through its `src/utils/db.js` and the same `DATABASE_URL`.

## The one shared table: `Blacklist`

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

## A one-time read of `MinecraftLink`

TriBridge reads `MinecraftLink` and `User` exactly once: on its first start with no link list of its own, to
start that list from this bot's links so nobody had to link again. The copy is saved even when it is empty, so it
never repeats. After it, the two link lists are independent and changing these tables does not affect the bridge.

## What TriBridge keeps to itself

The admin panel, the global profile change, the audit channel, the Hypixel guild registry, the bridge's links
and its admin roles are TriBridge's own, stored in its `tribridge.config` table (with local JSON snapshots on its
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
