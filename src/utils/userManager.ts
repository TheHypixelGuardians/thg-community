import { bot } from '../bot.js';
import type { User } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';

/**
 * The member's current Discord username, fetched by id. Served from the
 * client's cache when the user is in it (always true for whoever triggered an
 * interaction), otherwise one REST call.
 *
 * @returns The username, or null when Discord does not know the id (a deleted
 *   account) or could not be reached.
 */
export async function fetchDiscordUsername(discordId: string): Promise<string | null> {
  try {
    return (await bot.users.fetch(discordId)).username;
  } catch {
    return null;
  }
}

/**
 * Ensures a user exists in the database, with their Discord username fetched
 * by id. Creates the row when missing and corrects a stale name otherwise.
 *
 * A name that cannot be fetched leaves an existing row's name alone; a new row
 * then starts with the Discord id as its name, which the startup refresh
 * replaces once Discord answers.
 *
 * @param discordId - The Discord user ID
 * @returns The user object from the database
 */
export async function ensureUserExists(discordId: string): Promise<User> {
  try {
    const username = await fetchDiscordUsername(discordId);
    let user = await prisma.user.findUnique({
      where: { discordId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          discordId,
          username: username ?? discordId,
        },
      });
      console.log(`Created new user: ${user.username} (${discordId})`);
    } else if (username && user.username !== username) {
      user = await prisma.user.update({
        where: { discordId },
        data: { username },
      });
      console.log(`Updated username for user: ${username} (${discordId})`);
    }

    return user;
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    throw error;
  }
}

/**
 * Re-fetches every stored user's Discord username by id and writes back the
 * ones that changed, including placeholder names (the Discord id) left by the
 * legacy import or a failed fetch. One user at a time: discord.js queues the
 * REST calls under Discord's rate limit, and nothing waits on this.
 *
 * @returns How many rows were updated.
 */
export async function refreshUsernames(): Promise<number> {
  const users = await prisma.user.findMany({ select: { discordId: true, username: true } });
  let updated = 0;
  for (const user of users) {
    const username = await fetchDiscordUsername(user.discordId);
    if (!username || username === user.username) continue;
    await prisma.user.update({ where: { discordId: user.discordId }, data: { username } });
    updated++;
  }
  return updated;
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
