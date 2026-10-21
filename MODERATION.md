# Moderation

Warns, timeouts, kicks and bans through the bot. Each action becomes a numbered **case** in the database, is
posted to the mod log and is DMed to the member.

## Commands

| Command                                   | Needs              | What it does                                              |
|-------------------------------------------|--------------------|-----------------------------------------------------------|
| `/warn user reason`                       | Moderate Members   | Records a warning and DMs it to the member                |
| `/timeout user duration [reason]`         | Moderate Members   | Discord's timeout, `30m` / `12h` / `7d`, at most 28 days   |
| `/untimeout user [reason]`                | Moderate Members   | Takes a timeout off early                                 |
| `/kick user [reason]`                     | Kick Members       | Kicks the member, after the DM                            |
| `/ban user [reason] [delete_messages]`    | Ban Members        | Bans a member, or a user who isn't in the server (paste their id); can delete their last hour, day or week of messages |
| `/unban user [reason]`                    | Ban Members        | Lifts a ban                                               |
| `/purge count [user]`                     | Manage Messages    | Bulk-deletes up to 100 recent messages in the channel, optionally only one user's |
| `/cases user`                             | Moderate Members   | The member's latest 25 cases                              |
| `/case view id`                           | Moderate Members   | One case                                                  |
| `/case reason id reason`                  | Moderate Members   | Changes the reason: your own cases, or any as an admin    |
| `/case delete id`                         | Administrator or bot admin | Removes a case from the history (the log keeps a line) |

Each command is hidden from members without its permission (`defaultMemberPermissions`), and the permission
is checked again when it runs, because a server administrator can override the first in Discord's command
settings.

## Who can be acted on

The bot refuses when:

- the target is you, the bot or the server owner
- the target's top role is equal to or above yours (unless you are the owner). Without this check, anybody
  with Kick Members could use the bot to kick someone above them, which Discord itself would refuse.
- the target is a **bot admin** and you are not a server administrator, so a moderator can't remove the
  people who run both bots
- the bot's own top role is not above the target's, or it lacks the permission

## DMs

The member gets a DM saying what happened, in which server, the reason and the duration. It is sent **before**
a kick or ban, since it can't reach them after, and after a warn or timeout. Closed DMs are normal: the action
still happens, and the case records that the DM failed.

## Cases and the mod log

A case is written only **after** Discord accepted the action, so the history never shows a ban that didn't
happen. Every case is posted to the mod log channel (set on the **Moderation** page of `/setup`), which falls
back to the general log channel. Purges, reason changes and deleted cases are logged there too.

Actions taken by hand in Discord (right-click → Ban) don't go through the bot, so they are not cases.

## What the bot needs

Moderate Members, Kick Members and Ban Members for the matching commands, and Manage Messages plus Read
Message History in a channel for `/purge`. Its role must sit above the roles of the members it acts on.

No intent beyond Guilds: members are looked up by id through the API, and `/purge` reads only message ids,
authors and timestamps.

## Data

`ModCase` holds:
- `id`: the case number, a sequence
- `type`: warn, timeout, untimeout, kick, ban or unban
- `targetId` and `moderatorId`: Discord ids. The target may never have used this bot, or may be banned before
  ever joining.
- `reason`
- `durationSeconds` and `expiresAt`, for timeouts. Seconds, because 28 days in milliseconds doesn't fit an
  Int.
- `dmSent`

The mod log channel is `Setup.modLogChannelId`. TriBridge doesn't read or write any of this.
