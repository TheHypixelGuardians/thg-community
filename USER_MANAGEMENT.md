# User management

The bot keeps a `User` row for every member who uses it, without the member doing anything.

## How it works

1. A member runs a slash command, presses a component or submits a modal.
2. A member on the shared blacklist is refused first (see [SHARED_DATABASE.md](SHARED_DATABASE.md)), so a
   refused interaction creates no row. Otherwise, before anything else runs, the event handler calls
   `ensureUserExists(discordId, username)` from
   `src/utils/userManager.ts`. Bots are skipped (`!interaction.user.bot`): without that guard every bot that
   triggers an interaction would create a `User` row.
3. If no row has that `discordId`, one is created. If the row exists and the username changed, it is updated.
4. The command then runs and can assume the row exists.

The hook lives in `src/events/interactionCreate.ts`. A new way of running commands (prefix messages, say)
needs the same call, or members who only use that path are never registered. Sending a message does not
register anybody: the `messageCreate` handler that did so served prefix commands the bot never had, and was
removed. `/link` also calls it
itself (`setLink` in `utils/linkedAccounts.ts`), so a link can always be related to a row.

## Data

```prisma
model User {
  id        String   @id @default(uuid())
  discordId String   @unique
  username  String
  language  String   @default("nl")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  minecraftLink   MinecraftLink?
  featureRequests FeatureRequest[]
}
```

`discordId` is the key Discord gives us; `id` is the uuid to use for relations. Relate other tables to
`user.id`, never to the Discord id. TriBridge joins `MinecraftLink` to `User` this way too (see
[SHARED_DATABASE.md](SHARED_DATABASE.md)). `language` is never read: the bot is English-only.

## Helpers

- `ensureUserExists(discordId, username)` creates or updates the row and returns it.
- `getUserByDiscordId(discordId)` returns the row or `null`.

Both use the shared Prisma client from `src/utils/prisma.ts`.

## When it fails

A database error is logged and rethrown. In `interactionCreate` it lands in the same try/catch as the command,
so the error handler reports it and the member gets an ephemeral error reply instead of a command that silently
does nothing. The command does not run: running it for a member with no row would break the commands that rely
on the row.

`/skyblock` and `/networth` are acknowledged (`deferReply`) before `ensureUserExists`, because the first Prisma
query after a restart can take long enough to expire Discord's three-second acknowledgement window.
