# Global profile change

For a set duration, everybody's messages are reposted wearing one member's name and avatar. It is run from
`/adminpanel`, recorded in the audit channel, and applies across the Hypixel guild-chat bridge as well as in
Discord.

## Running it

`/adminpanel` (bot-admin only) opens an **ephemeral** panel — it exposes who is being impersonated and every
channel the effect is scoped to, which is nobody else's business. Three views:

- **Main** — what is running, the scope lists, the bridge switches, the audit channel. Carries **Stop effect**
  and **Refresh**.
- **Global Profile** — pick the target and a duration, toggle the two bridge legs, then **Start in test mode**
  or **Start live**.
- **Testers & channels** — the tester allowlist, the test-channel allowlist, and the channels excluded from
  live mode.

Durations run from five minutes to a day, or **Until stopped**, or a custom value: `90m`, `2h30m`, `1d12h`, or
a bare number read as minutes. `0`, `none`, `never`, `forever`, `permanent` and `indefinite` all mean "until
somebody stops it".

A half-filled form lives in memory between clicks rather than in the button ids, so restarting the bot
mid-set-up costs the admin one re-pick. It expires after fifteen minutes.

## Who it applies to

**Live mode** rewrites everybody, everywhere, except the excluded channels. **Test mode** rewrites only a
listed tester posting in a listed channel — and, over the bridge, only guild chat from a tester's own linked
Minecraft account. Without that last rule, testing would silently relabel guild members who never agreed to
take part.

Never rewritten:

- **The target themselves.** They already wear that face, and a repost would cost a send and a delete to
  produce exactly the same message.
- **Anything TriBridge owns** — the bridge channel and every officer channel. See below.
- **`!`-prefixed messages.** A repost deletes the original, so a `@SimpleCommand`'s own reply would point at a
  message that no longer exists.
- **Messages a webhook cannot reproduce** — stickers, polls, forwards, voice notes, and anything with neither
  text nor attachments. Reposting those drops the part that mattered, so leaving them alone is the honest
  outcome.

## The split with TriBridge

This bot reposts in ordinary channels. The bridge applies the same effect to the three places it owns: the
repost in the bridge channel, the name guild chat is told (`disguiseToMinecraft`), and the name on incoming
guild chat (`disguiseToDiscord`). Both switches are on the panel here and are read only by the bridge —
nothing in this bot acts on them.

The two channel kinds this bot must skip come from the `BridgeChannel` table, which TriBridge publishes at
startup. Skipping them is not tidiness:

- **The bridge channel** is reposted by TriBridge, which has to repost there anyway to attribute a linked
  member. Two bots deleting the same message race, and the loser deletes a message the winner already
  replaced.
- **An officer channel** would break outright: a webhook repost is authored by a bot, and TriBridge's officer
  relay drops anything a bot authored — so the officer's line would vanish from Discord and never reach
  Hypixel, with no error anywhere. A channel that exists to record what officers said is also the last place
  to relabel who said it.

See [SHARED_DATABASE.md](SHARED_DATABASE.md).

## How it ends

At the stored expiry, or when an admin presses **Stop effect**.

`isActive()` is the authority, not the timer: it clears a lapsed effect on read, so a timer lost to a restart
or a clock jump can never leave the disguise stuck on. The timer exists only to *announce* the end, and
`clientReady` re-arms it after a restart — nothing else does.

Stopping leaves the tester and channel lists and the two bridge switches intact, so the next run does not have
to be set up from scratch.

## Auditing

Reposting deletes the original, so the real author is no longer visible on the message. Every disguised
message is therefore recorded in the channel set with `/auditchannel set`, with a jump link to the repost,
plus an entry when an effect starts and ends. TriBridge records its own legs into the same channel.

An audit write that fails is logged and otherwise ignored: the entry accompanies work that has already
happened, and a misconfigured channel must not take that work down with it. **Without an audit channel the
disguise still runs** and nothing records who really sent each message — set one first.

## Permissions

The repost needs **Manage Webhooks** and **Manage Messages** in every channel it applies to. A channel missing
either is skipped and left completely alone, with one warning to the log channel per server — latched, so a
missing permission does not spam.

Because a repost is a new message:

- a disguised message cannot afterwards be edited or deleted by the person who wrote it;
- replies keep a jump link instead of Discord's reply header.

Reposts within a channel are chained, so a burst arrives in the order it was sent.

## Custom ids

Every component the panel owns uses `panel:{view}:{action}:{invokerId}`, dispatched by
[`src/utils/adminPanelHandler.ts`](src/utils/adminPanelHandler.ts) from `interactionCreate` rather than
through discordx's component decorators. The panel mixes buttons, user selects, channel selects and a modal
under one id space, and every click re-checks three things — that the clicker is still an admin, that they are
the person who opened the panel, and that it is in a server. One dispatcher with those guards at the top is
what makes them impossible to forget when a button is added.
