# Discord changelog

Short copy-pasteable notes for the THG announcement channel. Second person, one line per change.
Each `##` section must stay under 2000 characters.

## Unreleased

- Commands like `/help` no longer error after responding (they were accidentally running twice).
- `/help` no longer shows an empty Miscellaneous category.

### Account linking

- `/link <username>` binds your Minecraft account to your Discord account. Once linked, your messages in the
  bridge channel show your Minecraft head and name, and guild chat sees your Minecraft name.
- `/unlink` removes it again. Staff can look links up with `/whois` and `/links`.
- Linking moved here from the bridge bot — if you had already linked, you do not need to do it again.

### Feature requests

- `/request` opens a short form to suggest something. Your request is posted with a number, and staff mark it
  accepted, denied, planned or duplicate as it moves along.

### For staff

- `/adminrole` sets which roles count as staff — the same list is used by the bridge bot.
- `/adminpanel` and `/auditchannel` stay on the bridge bot, and are gated by that same list.

