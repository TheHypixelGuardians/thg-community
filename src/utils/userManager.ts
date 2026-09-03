import { PrismaClient, type User } from '../generated/prisma';

const prisma = new PrismaClient();

export interface UserData {
  discordId: string;
  username: string;
  language?: string;
}

/**
 * Ensures a user exists in the database. If the user doesn't exist, creates a new entry.
 * @param discordId - The Discord user ID
 * @param username - The Discord username
 * @returns The user object from the database
 */
export async function ensureUserExists(discordId: string, username: string): Promise<User> {
  try {
    // Try to find existing user
    let user = await prisma.user.findUnique({
      where: { discordId },
    });

    if (!user) {
      // Create new user if they don't exist
      user = await prisma.user.create({
        data: {
          discordId,
          username,
        },
      });
      console.log(`Created new user: ${username} (${discordId})`);
    } else {
      // Update username if it has changed
      if (user.username !== username) {
        user = await prisma.user.update({
          where: { discordId },
          data: {
            username,
            updatedAt: new Date(),
          },
        });
        console.log(`Updated username for user: ${username} (${discordId})`);
      }
    }

    return user;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw error;
  }
}

/**
 * Gets a user from the database by Discord ID
 * @param discordId - The Discord user ID
 * @returns The user object or null if not found
 */
export async function getUserByDiscordId(discordId: string): Promise<User | null> {
  try {
    return await prisma.user.findUnique({
      where: { discordId },
    });
  } catch (error) {
    console.error('Error getting user by Discord ID:', error);
    throw error;
  }
}

/**
 * Updates a user's language preference
 * @param discordId - The Discord user ID
 * @param language - The language code to set
 * @returns The updated user object
 */
export async function updateUserLanguage(discordId: string, language: string): Promise<User> {
  try {
    return await prisma.user.update({
      where: { discordId },
      data: {
        language,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error updating user language:', error);
    throw error;
  }
}

/**
 * Closes the Prisma client connection
 */
export async function closePrismaConnection(): Promise<void> {
  await prisma.$disconnect();
}
