# Account linking

Binds a Discord user to a Minecraft account on the community bot, and lets `/skyblock` and `/networth` default
to your own account. It only records the link: it gives no role and changes no nickname, because roles are
handled by another bot in the server and two bots managing the same members would fight over them. These are this bot's own
links: [TriBridge](https://github.com/TheHypixelGuardians/TriBridge) keeps a separate list with its own `/link`.

## Commands

| Command                      | Who      | Does                                                          |
|------------------------------|----------|----------------------------------------------------------------|
| `/link`                      | anyone   | Bind your Minecraft account: a form for the name, then a verification code when verification is on |
| `/unlink [user]`             | anyone / bot-admin for `user:` | Remove your link, or somebody else's       |
| `/whois <user\|username>`    | bot-admin | Look one up in either direction                               |
| `/links`                     | bot-admin | List every link                                               |
| `/setrank <user> [rank]`     | bot-admin | Set the guild rank stored on a link; leave `rank` out to clear |

## What is stored

`MinecraftLink`, one row per member, related to `User.id` rather than to the Discord id — the schema
convention. It holds the canonical name Mojang returned and the account's UUID.

It also holds a **rank**, set by hand with `/setrank` and shown by `/whois` and `/links`. It is free text (up to
32 characters) and only a record: nothing fills it in from Hypixel, and nothing reads it to hand out a role. A
relink keeps it; `/unlink` deletes it with the link.

**The UUID is why a link survives a rename**: avatar URLs are built from it, so a member who changes their
Minecraft name keeps their head and only the stored name goes stale.

**Both directions are enforced.** One link per Discord user (`userId` is unique) and one Discord user per
Minecraft account (`uuid` is unique, and `setLink` refuses a name already claimed by somebody else). Silently
reassigning an account would let anybody wear a guild member's identity across the bridge.

Links are deliberately **not** scoped to a Hypixel guild: one link per member, whatever guild they are in.

## Verification

With verification on, `/link` proves the member owns the account:

1. `/link` opens a form asking for their Minecraft username. The bot looks it up with Mojang.
2. It replies (only to them) with an embed explaining how to join the verification server, and an **Enter
   code** button.
3. They join the server in Minecraft. It is online-mode, so Mojang's session server confirms the account is
   theirs, and they are disconnected straight away with a six-digit code. Nobody loads into a world.
4. **Enter code** opens a second form. A correct code links the account and turns the embed into a
   confirmation. A wrong one gets a separate error, and the button keeps working.

A code works once and expires after five minutes; joining again replaces it. It only redeems for the account
named in step 1, so the account linked is always the one the member asked for and the embed showed; a code
for another account is refused (and counts as a wrong guess) without being used up. The button stops working fifteen minutes after the username step, or when the bot restarts.

Wrong codes are limited to five per Discord user per ten minutes. The code is the only thing between a member
and somebody else's account, and a million combinations is not many without a limit.

A verified link **takes the account over** from anybody who claimed it before, and that member's link is
gone. Refusing would let one unverified claim lock the real owner out for good.

The server is part of the bot process (`utils/linkVerification.ts`, built on `minecraft-protocol`). It is not
a client and uses no Minecraft account. It is switched on by setting both `VERIFY_SERVER_PORT` (the port it
listens on, on the panel the server's allocated port) and `VERIFY_SERVER_ADDRESS` (what members are told to
join). Codes live in memory, so a restart drops codes that were not yet used.

It accepts every Java Edition release from 1.7 up, including releases newer than the bot's `minecraft-protocol`
has data for: those are handled as the newest version it knows, since the login step that issues the code has
not changed between them. The server list reports each client's own version back to it. Reporting one fixed
version would show "Outdated server" to anybody on a newer release and tell them not to try.

With verification off (either variable unset, or the port could not be bound), the name from the form is
linked straight away, on trust: it checks with Mojang that the account exists, and nothing more. Anyone can then link any
real Minecraft name; an admin undoes a wrong one with `/unlink user:@them`. Hypixel guild membership is not
checked either way.

A Mojang lookup distinguishes three outcomes, and the reply differs for each: no such account, Mojang
unreachable, and success. Collapsing the middle case into the first would tell a member they typed their own
name wrong when the truth was an outage.

## The bridge

TriBridge does **not** read these links. It has its own `/link` and its own list, separate on purpose: the two
bots share the database, the blacklist and the admin roles, and nothing else. It started its list from this bot's links once, on
its first start with links of its own, and the two have been independent since. See
[SHARED_DATABASE.md](SHARED_DATABASE.md).

## SkyBlock lookups

`/skyblock` and `/networth` look up your own linked account when no `username` is given. Without a link you
get a reply asking for a `username` instead.
