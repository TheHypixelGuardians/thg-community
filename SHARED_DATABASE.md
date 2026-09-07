# The shared database

This bot and [TriBridge](https://github.com/Trilleo/THGBridge) are two processes serving one Discord server.
This bot owns the community half — profiles, account links, bot-admin roles, the admin panel, feature requests
— and TriBridge owns the Discord ↔ Hypixel guild chat bridge. Some of what this bot owns is *needed* by the
bridge, so rather than each keeping its own copy, both talk to one PostgreSQL database.

**This bot owns the schema.** [prisma/schema.prisma](prisma/schema.prisma) defines every table, and
`yarn prisma:push` is what creates them. TriBridge has no schema and no ORM; it reads with plain SQL through
its `src/utils/db.js`, using the same `DATABASE_URL`.

## What TriBridge reads from us

| Table                   | What the bridge does with it                                                       |
|-------------------------|-------------------------------------------------------------------------------------|
| `MinecraftLink`, `User` | Attributes guild chat to a member's Minecraft name and reposts them with their head |
| `AdminRole`             | Gates `/send`, `/guilds`, `/invite`, `/kick`, `/promote`, `/demote`, `/login`        |
| `GlobalProfileEffect`   | Applies the disguise to its two bridge legs and to the bridge channel                |
| `Setup.auditChannelId`  | Records a disguised guild-chat line in the same channel we use                       |

Three consequences for anyone changing those tables:

- **Renaming a column breaks the bridge silently.** TriBridge selects them by name in raw SQL, and a failed
  query there returns `null` rather than throwing — which every caller reads as "no link" / "not running". A
  rename needs a matching change in TriBridge's `utils/linkedAccounts.js`, `utils/adminRoles.js`,
  `utils/globalProfile.js` or `utils/auditChannel.js`, in the same change.
- **TriBridge caches every read for 10–30 seconds** and cannot see our writes, so a change here takes up to
  that long to reach the bridge. That is why `/link` tells the member their *next* message will be attributed
  — not this one.
- **`disguiseToMinecraft` and `disguiseToDiscord` do nothing in this bot.** They are read only by TriBridge,
  for the two bridge legs. The admin panel shows and toggles them; nothing here acts on them.

## What TriBridge writes to us

Exactly one table: **`BridgeChannel`**, republished on each of its startups. It lists the bridge channel and
every Hypixel guild's officer channel.

[`src/utils/bridgeChannels.ts`](src/utils/bridgeChannels.ts) reads it, and the disguise in
[`src/events/messageCreate.ts`](src/events/messageCreate.ts) skips any channel it names. Both skips are
load-bearing:

- **The bridge channel** is reposted by TriBridge itself, because it has to repost there anyway to attribute a
  linked member's Minecraft name. Two bots deleting the same message race, and the loser deletes a message the
  winner already replaced.
- **An officer channel** must never be reposted here: a webhook repost is authored by a bot, and TriBridge's
  officer relay drops anything a bot authored — so the officer's line would vanish from Discord *and* never
  reach Hypixel, with no error anywhere.

Rows are durable, so the skips keep working while TriBridge is down. They are only absent before its first
startup against this database — set `DATABASE_URL` on the bridge and start it once before running a live
global profile change.

## Failure behaviour

This bot is the owner and treats a database failure as a real error: commands surface it through the error
handler. TriBridge, whose reads sit on the message path, degrades instead — links read as *not linked*, the
disguise reads as *not running*, and `isAdmin` **fails closed**. Its side of the contract is written up in its
own `docs/SHARED_DATABASE.md`.

## Caching here

This process is the only writer of everything except `BridgeChannel`, so its caches are invalidated on write
rather than expiring — [`setup.ts`](src/utils/setup.ts), [`adminRoles.ts`](src/utils/adminRoles.ts),
[`linkedAccounts.ts`](src/utils/linkedAccounts.ts) and [`globalProfile.ts`](src/utils/globalProfile.ts) all
work that way, which is what keeps the per-message disguise gate off the database.

`bridgeChannels.ts` is the exception and uses a 60-second TTL, because TriBridge writes it. When that read
fails it serves the stale set rather than an empty one: an empty set would let the disguise repost into the
bridge and officer channels, which is exactly what the table exists to prevent.
