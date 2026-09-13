import type { Client, MessageCreateOptions } from 'discord.js';
import { bot } from '../bot.js';
import { getSetup } from './setup.js';

type Payload = string | MessageCreateOptions;

/**
 * Posts to a channel, swallowing every failure.
 *
 * Log lines always accompany work that has already happened, so a missing or
 * misconfigured log channel must never take that work down with it.
 *
 * @returns Whether the line landed.
 */
export async function sendToChannel(
  channelId: string | null | undefined,
  payload: Payload,
  client: Client = bot
): Promise<boolean> {
  if (!channelId) return false;

  const options = typeof payload === 'string' ? { content: payload } : payload;

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isSendable()) return false;

    await channel.send(options);
    return true;
  } catch (error) {
    console.error('Failed to send a log channel message:', error);
    return false;
  }
}

/**
 * Posts to the server's general log channel (`/setup`-configured `logChannelId`,
 * falling back to `LOG_CHANNEL_ID`).
 *
 * For anything that is not an error: account links, link-role sync, repost
 * warnings.
 */
export async function logGlobal(guildId: string, payload: Payload): Promise<boolean> {
  const setup = await getSetup(guildId).catch(() => null);
  const channelId = setup?.logChannelId || process.env.LOG_CHANNEL_ID || null;

  return sendToChannel(channelId, payload);
}
