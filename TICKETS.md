# Tickets

Members open a private channel with staff from a panel of buttons. Each ticket gets a number, a channel
called `ticket-0042`, a short form the member fills in first, and a transcript in the log when it closes.

## Setting it up

Run `/setup` and pick the **Tickets** page:

| Setting       | What it does                                                                               |
|---------------|--------------------------------------------------------------------------------------------|
| Panel channel | Where the panel with the ticket buttons is posted                                          |
| Category      | Where ticket channels are made. Members can't open tickets until this is set               |
| Staff role    | Sees every new ticket and can claim, close, reopen and add or remove members. Bot admins can always do all of that, with or without this role |
| Log channel   | Gets a line for every opened ticket and an entry with the transcript for every closed one. Falls back to the general log channel |

Then press **Post the panel**. Posting again replaces the old panel, so the channel only ever has one.

### What the bot needs

| Where              | Permissions                                                                           |
|--------------------|---------------------------------------------------------------------------------------|
| Server-wide        | **Manage Channels** and **Manage Roles**                                              |
| The category       | View Channel, Send Messages, Embed Links, Attach Files, Read Message History           |
| The log channel    | View Channel, Send Messages, Embed Links, Attach Files                                 |
| Developer Portal   | The **Message Content** intent, for transcripts (see below)                           |

`/setup` checks these when you pick the category or the log channel, and says what is missing.

The server-wide permissions are needed because a ticket channel gets its own permission overwrites instead of
syncing with the category. Inside the ticket, a permission the bot only had through the category would be
gone. Discord also only lets a bot that isn't an administrator grant overwrites for permissions it holds in the
server. **Manage Roles** is Discord's name for editing channel overwrites, which is what `/ticket add` and
`/ticket remove` do. The bot never gives anybody a role.

## Ticket types

The types are fixed in `src/utils/tickets.ts` (`TICKET_TYPES`):

| Type              | Questions                                                          |
|-------------------|--------------------------------------------------------------------|
| Support           | What do you need help with?                                        |
| Guild application | Minecraft name, SkyBlock level, why you want to join               |
| Report a member   | Who you are reporting, what happened                               |

A guild application checks the Minecraft name with Mojang and stores its exact spelling. A name that doesn't
exist is refused and no ticket is made. If Mojang doesn't answer, the name is kept as typed and marked
unchecked, so an outage never blocks applications. A member with a `/link` gets their name filled in.

A member can have **one open ticket per type**. Pressing the same button again points them to the one they
have.

## Inside a ticket

Only the member who opened the ticket, the staff role and the bot can see the channel, plus anyone with
Discord's **Administrator** permission, who sees every channel anyway. Bot admins without the staff role
can act on a ticket only if they can see it. The first message shows the form answers and two buttons:

- **Claim** marks the ticket as yours, and the message shows who holds it. Pressing it again unclaims.
  Claiming a ticket somebody else holds takes it over. Staff only.
- **Close** asks for an optional reason and closes the ticket. The member who opened it can close it too.

`/ticket add user` and `/ticket remove user` let staff bring another member in or take them out. The
member who opened the ticket can't be removed.

`/ticket close [reason]` does the same as the Close button.

## Closing

Closing happens in this order:

1. The close is recorded first. Two people pressing Close at once can't both run it: the second gets
   "already being closed".
2. The transcript is read from the channel.
3. The log entry is posted with the transcript attached, who opened, claimed and closed it, the reason and how
   long it was open.
4. The member who opened the ticket gets a DM with the reason. If their DMs are closed, nothing else changes.
5. The channel is deleted a few seconds later.

A failed transcript still closes the ticket. A ticket that can't be closed is worse than one logged without
its text.

A ticket channel deleted by hand, instead of with Close, closes its ticket without a transcript and logs
that. Otherwise the ticket would stay open forever and its member could never open another of that type.

### Transcripts and the Message Content intent

The transcript is a `.txt` file with every message, oldest first: the time, the author, the text, and links
to attachments.

Reading message text needs the **Message Content** intent switched on for the bot in the Developer Portal.
The bot does not request it at login and doesn't need to: message reads through the API follow the
portal setting, not the intents a bot connects with. With it off, other people's messages come back without
text. The transcript then says how many messages had no readable text, rather than listing blank lines.

## Reopening

Each close log entry has a **Reopen** button for staff. It works for 24 hours after the close, and only while
the member has no other open ticket of the same type. A reopened ticket gets a new channel with the same
number and the original answers, and the button is removed from the log entry. The earlier conversation stays
in the transcript on that entry.

## Data

One `Ticket` row per ticket:
- `id` is the number. It is a database sequence, so two tickets opened at once can't share one.
- `channelId` is set while the ticket is open and cleared on close.
- The form answers are stored as JSON.
- Member ids are Discord ids, not `User.id`: staff who claim or close a ticket may never have used a command
  of this bot.

The ticket settings live in the `Setup` row: `ticketChannelId`, `ticketCategoryId`, `ticketStaffRoleId`,
`ticketLogChannelId` and `ticketPanelMessageId`.

TriBridge doesn't read or write any of this.
