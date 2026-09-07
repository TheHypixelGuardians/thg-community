import type { GuildTextBasedChannel, TextChannel, Webhook } from 'discord.js';

export const WEBHOOK_NAME = 'THG Community Relay';

// Keyed by channel id. Cleared via clearRelayWebhook so a webhook deleted out
// from under us gets recreated instead of serving a dead entry forever.
const cache = new Map<string, Webhook>();

export interface WebhookTarget {
  channel: TextChannel;
  threadId: string | undefined;
}

/**
 * Works out which channel a message's webhook actually lives on.
 *
 * Webhooks only exist on real channels, never on threads, so a message in a
 * thread has to go through the parent's webhook with `threadId` set. The cache
 * therefore keys off the parent, and every thread under it shares one webhook.
 *
 * @returns null when there is no webhook-capable home — a thread whose parent
 *   we cannot see, for instance.
 */
export function resolveWebhookTarget(
  channel: GuildTextBasedChannel | null | undefined
): WebhookTarget | null {
  if (!channel) return null;

  if (!channel.isThread()) {
    return { channel: channel as TextChannel, threadId: undefined };
  }

  if (!channel.parent) return null;
  return { channel: channel.parent as TextChannel, threadId: channel.id };
}

/**
 * Fetches, or creates, the webhook used to repost messages under another
 * identity.
 *
 * @param channel - Must be a real channel, not a thread — pass
 *   {@link resolveWebhookTarget}'s `channel`.
 * @throws If the bot lacks **Manage Webhooks**.
 */
export async function getRelayWebhook(channel: TextChannel): Promise<Webhook> {
  const cached = cache.get(channel.id);
  if (cached) return cached;

  const webhooks = await channel.fetchWebhooks();
  const botId = channel.client.user?.id;

  // Only webhooks we own carry a token, and without a token we cannot send.
  let webhook: Webhook | undefined = webhooks.find(
    (wh) => wh.name === WEBHOOK_NAME && wh.owner?.id === botId && Boolean(wh.token)
  );

  if (!webhook) {
    webhook = await channel.createWebhook({
      name: WEBHOOK_NAME,
      reason: 'Used to repost messages under another identity.',
    });
  }

  cache.set(channel.id, webhook);
  return webhook;
}

/** Drops the cached webhook for a channel so the next call refetches it. */
export function clearRelayWebhook(channelId: string): void {
  cache.delete(channelId);
}
