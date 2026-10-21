# Automod

Discord's own AutoMod does the blocking. The bot doesn't scan messages itself. Around the server's AutoMod
rules, it adds two things: its own rule for invite links, and a timeout for members AutoMod keeps blocking.
Everything is on the **AutoMod** page of `/setup`.

## The server's own rules

The page lists every AutoMod rule in the server: what it matches, what it does, and what is exempt. Keyword
lists show only as counts.

**The bot never edits these rules.** Staff keep changing them in **Server Settings > AutoMod**, and the page
shows the result after **Refresh**. A bot that rewrote rules staff had tuned by hand would undo their work
without telling anyone.

## Invite links

**Block invite links** creates one extra native rule, *Block Invite Links (THG Community bot)*. It blocks any
message with a `discord.gg/…`, `discord.com/invite/…`, `discordapp.com/invite/…` or `dsc.gg/…` link and tells
the member why.
- Bot admins are exempt. Add more exempt roles or channels to the rule in Server Settings.
- If the mod log is set, Discord also posts an alert there for every blocked invite.
- **Stop blocking invites** deletes the rule again. A rule deleted by hand in Server Settings is simply off.

Because it is a native rule, it keeps working while the bot is offline.

## Timeouts for repeat offenders

AutoMod on its own only blocks a message, so someone can keep trying. With **Turn timeouts on**, the bot counts
the messages AutoMod blocks for each member, from every rule including the server's own. When the count reaches
the limit within the window, the member gets a timeout:

| Setting                | Choices                      | Default    |
|------------------------|------------------------------|------------|
| Blocked messages       | 2, 3, 4, 5                   | 3          |
| Within                 | 5, 10, 30, 60 minutes        | 10 minutes |
| Timeout length         | 5 min, 10 min, 1 h, 6 h, 1 day | 10 minutes |

- The timeout is a normal moderation **case**: the bot is the moderator, the member gets a DM, and the case goes
  to the mod log. See [MODERATION.md](MODERATION.md).
- Bot admins, server administrators, bots and members already timed out are skipped, and so is anyone above the
  bot's role.
- Only the block counts. A rule that blocks and also alerts sends two events per message, and counting both
  would time members out at half the limit.
- The count is kept in memory, so a restart starts it again. That can only make a timeout come later, never
  sooner.

## What the bot needs

- **Manage Server**, to read and create AutoMod rules and to receive AutoMod's events.
- **Moderate Members**, for the timeout.
- The **AutoModerationExecution** intent. It is not privileged, so nothing needs switching on in the Developer
  Portal.

The bot adds the permissions to its own role at startup when it can (see the README).

## Data

These are on `Setup`:
- `automodInviteRuleId` is the id of the bot's invite rule while it is on.
- `automodTimeoutEnabled`, `automodTimeoutStrikes`, `automodTimeoutWindowMins` and `automodTimeoutMins` hold
  the timeout settings.

The old `automodEnabled`, `automodChannelId`, `automodRoleId` and the two exception lists were never read, and
the migration that added the new columns dropped them. TriBridge doesn't read or write any of this.
