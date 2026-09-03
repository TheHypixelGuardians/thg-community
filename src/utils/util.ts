import { type ColorResolvable, EmbedBuilder, type Message } from 'discord.js';
import type { Client } from 'discordx';

/**
 * Capitalises the first letter of each word in a string.
 * @param str - The string to be capitalised.
 * @returns The capitalised string.
 */
export const capitalise = (str: string): string => str.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Deletes a message after a specified delay if it's deletable.
 * @param message - The message to delete.
 * @param time - The delay before deletion, in milliseconds.
 */
export function deletableCheck(message: Message, time: number): void {
  setTimeout(() => {
    message.delete().catch((error) => console.error('Error deleting message:', error));
  }, time);
}

export enum ResponseType {
  Info = 0,
  Success = 1,
  Permission = 2,
  Error = 3,
}

export function responseEmbed(type: ResponseType, content: string) {
  let color: ColorResolvable;
  let title: string;
  switch (type) {
    case ResponseType.Info:
      title = '🔷 Info';
      color = 'Blue';
      break;
    case ResponseType.Success:
      title = '✅ Success';
      color = 'Green';
      break;
    case ResponseType.Permission:
      title = '⚠️ Insufficient Permissions';
      color = 'Yellow';
      break;
    case ResponseType.Error:
      title = '❌ Error';
      color = 'Red';
      break;
  }

  return [new EmbedBuilder().setTitle(title).setDescription(content).setColor(color).toJSON()];
}

export async function getCommandIds(client: Client): Promise<Record<string, string>> {
  if (!client.application) {
    throw new Error('Client application is not available');
  }

  const commandIds = new Map<string, string>();
  const isGuildOnly = client.botGuilds && client.botGuilds.length > 0;

  // Fetch global commands
  if (!isGuildOnly) {
    try {
      const globalCommands = await client.application.commands.fetch();
      for (const cmd of globalCommands.values()) {
        commandIds.set(cmd.name, cmd.id);
      }
    } catch (error) {
      console.warn('Could not fetch global commands:', error);
    }
  }

  // Fetch guild commands
  const guildPromises = Array.from(client.guilds.cache.values()).map(async (guild) => {
    try {
      const guildCommands = await guild.commands.fetch();
      for (const cmd of guildCommands.values()) {
        commandIds.set(cmd.name, cmd.id);
      }
    } catch (error) {
      console.warn(`Could not fetch commands for guild ${guild.name}:`, error);
    }
  });

  await Promise.allSettled(guildPromises);

  return Object.fromEntries(commandIds);
}

/**
 * Parses a duration string into milliseconds.
 * @param duration - The duration string to parse.
 * @returns The duration in milliseconds.
 * @throws An error if the duration format is invalid.
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid duration format');

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
  }

  throw new Error('Invalid duration format');
}