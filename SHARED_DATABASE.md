# The shared database

This bot and [TriBridge](https://github.com/Trilleo/THGBridge) are two processes serving one Discord server.
This bot owns the community half — profiles, account links, bot-admin roles, feature requests — and TriBridge
owns the Discord ↔ Hypixel guild chat bridge, along with the admin panel and the global profile change, which
both reach into guild chat.

Two of the things this bot owns are *needed* by the bridge, so rather than each keeping its own copy, both
talk to one PostgreSQL database.

**This bot owns the schema.** [prisma/schema.prisma](prisma/schema.prisma) defines every table, and
`yarn prisma:push` is what creates them. TriBridge has no schema and no ORM; it reads with plain SQL through
its `src/utils/db.js`, using the same `DATABASE_URL`, and **never writes**.

## What TriBridge reads from us

| Table                   | What the bridge does with it                                                            |
|-------------------------|------------------------------------------------------------------------------------------|
| `MinecraftLink`, `User` | Attributes guild chat to a member's Minecraft name and reposts them with their head      |
| `AdminRole`             | Gates every admin command it has, including `/adminpanel` and `/auditchannel`             |

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

The admin panel, the global profile change and the audit channel are TriBridge's own, stored in its
`globalProfileConfig.json` and `auditChannelConfig.json`. Nothing in this bot starts, stops or records a
disguise — if you are looking for `/adminpanel`, it is on the bridge.

## Failure behaviour

This bot is the owner and treats a database failure as a real error: commands surface it through the error
handler. TriBridge, whose reads sit on the message path, degrades instead — links read as *not linked*, and
`isAdmin` **fails closed**, which means an unset `DATABASE_URL` on the bridge leaves every admin command
there refusing. Its side of the contract is written up in its own `docs/SHARED_DATABASE.md`.

## Caching here

This process is the only writer, so its caches are invalidated on write rather than expiring —
[`setup.ts`](src/utils/setup.ts), [`adminRoles.ts`](src/utils/adminRoles.ts) and
[`linkedAccounts.ts`](src/utils/linkedAccounts.ts) all work that way.
