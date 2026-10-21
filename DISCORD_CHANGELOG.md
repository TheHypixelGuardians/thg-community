# Discord changelog

Short copy-pasteable notes for the THG announcement channel. Second person, one line per change.
Each `##` section must stay under 2000 characters.

## Unreleased

- `/help` links our new privacy policy. Open a Support ticket to report a problem or ask for your data to be removed.
- You can open a ticket with staff from the ticket panel: support, a guild application or a report.
- Staff can now warn, time out, kick and ban through the bot. If that happens to you, you get a DM with the reason.

- Staff can now configure the bot's channels and admin roles from one panel with `/setup`.

- You can look up a SkyBlock profile with `/skyblock <username>` (level, skills, purse, bank, and guild).
- You can look up SkyBlock networth with `/networth <username>` (richest profile, Hypixel API).
- `/skyblock` and `/networth` no longer time out when the bot is busy talking to the database.
- Leave out the username on `/skyblock` or `/networth` to look up your own linked account.
- Commands like `/help` no longer error after responding (they were accidentally running twice).
- `/help` no longer shows an empty Miscellaneous category.
- If a command fails a lot, you now get the error message again after a minute instead of never.

### Account linking

- `/link` binds your Minecraft account to your Discord account on the community bot.
- `/link` proves the account is yours: enter your Minecraft name, join `verify.zvapor.xyz` to get a code, then click **Enter code** and type it in.
- `/unlink` removes it again. Staff can look links up with `/whois` and `/links`.
- The bridge bot has its own, separate `/link`. If you were already linked, your link was copied over to it.

### Feature requests

- `/request` opens a short form to suggest something. Your request is posted with a number, and staff mark it
  accepted, denied, planned or duplicate as it moves along.

### For staff

- `/setrank` stores a member's guild rank on their link; `/whois` and `/links` show it.
- `/adminrole` sets which roles count as staff — the same list is used by the bridge bot.
- `/adminpanel` and `/auditchannel` stay on the bridge bot.
- `/pingdiamond` moved to the community bot.

