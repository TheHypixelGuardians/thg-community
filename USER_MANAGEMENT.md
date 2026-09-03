# User Management System

This document explains how the user management system works in the Checklist Bot.

## Overview

The bot automatically ensures that all users who execute commands are registered in the database. This happens transparently without any user intervention required.

## How It Works

### Automatic User Registration

1. **Event Handler Integration**: The user management is integrated into the main event handlers in `src/events/common.ts`
2. **Automatic Check**: Every time a user executes a command (via message or interaction), the system automatically checks if they exist in the database
3. **Automatic Creation**: If the user doesn't exist, a new database entry is created automatically
4. **Username Updates**: If the user exists but their username has changed, it's automatically updated

### Database Schema

The user management uses the existing `User` model in the Prisma schema:

```prisma
model User {
  id            String   @id @default(uuid())
  discordId     String   @unique
  username      String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  ideas         Idea[]
}
```

### Key Functions

#### `ensureUserExists(discordId: string, username: string)`

This is the main function that:

- Checks if a user exists in the database by Discord ID
- Creates a new user entry if they don't exist
- Updates the username if it has changed
- Returns the user object from the database

#### `getUserByDiscordId(discordId: string)`

A utility function to retrieve a user by their Discord ID.

## Implementation Details

### Event Handler Integration

The system is integrated into two main event handlers:

1. **Message Commands** (`messageCreate` event):

   ```typescript
   // Ensure user exists in database before executing command
   await ensureUserExists(message.author.id, message.author.username);
   ```

2. **Slash Commands** (`interactionCreate` event):

   ```typescript
   // Ensure user exists in database before executing interaction
   if (interaction.user) {
     await ensureUserExists(interaction.user.id, interaction.user.username);
   }
   ```

### Error Handling

- Database errors are logged to the console
- If user creation fails, the error is thrown and handled by the existing error handler
- The bot continues to function even if user registration fails

### Graceful Shutdown

The system includes proper cleanup of database connections when the bot shuts down:

```typescript
process.on("SIGINT", async () => {
  console.log("Shutting down bot...");
  await closePrismaConnection();
  process.exit(0);
});
```

## Benefits

1. **Automatic**: No manual intervention required
2. **Transparent**: Users don't need to know about the database
3. **Reliable**: All command users are guaranteed to be in the database
4. **Up-to-date**: Usernames are automatically updated when they change
5. **Efficient**: Only creates/updates when necessary

## Usage in Commands

Commands that need to interact with user data can now rely on the fact that users will always exist in the database. For example:

```typescript
// In any command, you can safely assume the user exists
const user = await ensureUserExists(
  interaction.user.id,
  interaction.user.username
);

// Use the database user ID for relationships
await prisma.idea.create({
  data: {
    title: title,
    description: idea,
    userId: user.id, // Use database ID, not Discord ID
  },
});
```

## Migration from Existing Code

The existing `profile.ts` command has been updated to use the new `ensureUserExists` function instead of duplicating the user creation logic. This ensures consistency across the codebase.
