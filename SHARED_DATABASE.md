# The shared database

This bot and [TriBridge](https://github.com/TheHypixelGuardians/TriBridge) are two processes serving one Discord server.
This bot owns the community half — profiles, account links, bot-admin roles, feature requests — and TriBridge
owns the Discord ↔ Hypixel guild chat bridge, along with the admin panel and the global profile change, which
both reach into guild chat.

Two of the things this bot owns are *needed* by the bridge, so rather than each keeping its own copy, both
talk to one PostgreSQL database.

**This bot owns the schema.** [prisma/schema.prisma](prisma/schema.prisma) defines every table, and
its migrations (`yarn prisma:migrate`) are what create them. TriBridge has no Prisma schema; it reads with
plain SQL through its `src/utils/db.js`, using the same `DATABASE_URL`. It writes exactly **one** table
here, `Blacklist`, and keeps its own settings in a separate `tribridge` schema that this bot never touches.

## What TriBridge reads from us

| Table                   | What the bridge does with it                                                            |
|-------------------------|------------------------------------------------------------------------------------------|
| `MinecraftLink`, `User` | Attributes guild chat to a member's Minecraft name and reposts them with their head      |
| `AdminRole`             | Gates every admin command it has, including `/adminpanel` and `/auditchannel`             |
| `Blacklist`             | Refuses every command and stops relaying Discord messages into Minecraft for listed members |

## What TriBridge writes

**`Blacklist`, and nothing else.** `/blacklist add|remove|list` lives on the bridge, so the bridge inserts and
deletes those rows with plain SQL; this bot only reads them (`src/utils/blacklist.ts`). Because TriBridge never
runs Prisma, the columns it relies on have **database-side** defaults: `id` is `gen_random_uuid()` and
`updatedAt` defaults to `now()`. Prisma's client-side `uuid()` and `@updatedAt` would leave a raw insert
failing on a null id. Keep those defaults if the model changes.

The writer is another process, so this bot caches the list for 15 seconds rather than invalidating on write,
the same window as TriBridge's caches. The check **fails open**: an unreadable database lets members through,
because failing closed would lock the whole server out of both bots during an outage. `isAdmin()` still fails
closed, so nothing privileged opens up.

Three consequences for anyone changing those tables:

- **Renaming a column breaks the bridge silently.** TriBridge selects them by name in raw SQL, and a failed
  query there returns `null` rather than throwing — which every caller reads as "no link" / "not an admin". A
  rename needs a matching change in TriBridge's `utils/linkedAccounts.js` or `utils/adminRoles.js`, in the
  same change.
- **TriBridge caches both reads for fifteen seconds** and cannot see our writes, so a change here takes up to
  that long to reach the bridge. That is why `/link` tells the member their *next* message will be attributed
  — not this one.
- **A `MinecraftLink` row is what makes TriBridge's global profile test mode work.** Guild chat carries no
  Discord author, so the bridge recognises a tester by matching the Minecraft name back to a link. Deleting
  somebody's link mid-test quietly stops rewriting their guild chat.

## What TriBridge does *not* read

The admin panel, the global profile change, the audit channel and the Hypixel guild registry are TriBridge's
own, stored in its `tribridge.config` table (with local JSON snapshots on its server). Nothing in this bot starts, stops or records a
disguise — if you are looking for `/adminpanel`, it is on the bridge.

## Failure behaviour

This bot is the owner and treats a database failure as a real error: commands surface it through the error
handler. TriBridge, whose reads sit on the message path, degrades instead — links read as *not linked*, and
`isAdmin` **fails closed**, which means an unset `DATABASE_URL` on the bridge leaves every admin command
there refusing. Its side of the contract is written up in its own `docs/SHARED_DATABASE.md`.

## Caching here

This process is the only writer of everything except `Blacklist`, so those caches are invalidated on write rather than expiring —
[`setup.ts`](src/utils/setup.ts), [`adminRoles.ts`](src/utils/adminRoles.ts) and
[`linkedAccounts.ts`](src/utils/linkedAccounts.ts) all work that way.
