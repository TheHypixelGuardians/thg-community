import type { GuildBasedChannel, GuildMember } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

/** What the bot needs to post its embeds in a channel. */
export const POST_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, name: 'View Channel' },
  { flag: PermissionFlagsBits.SendMessages, name: 'Send Messages' },
  { flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links' },
];

/**
 * The permissions the bot is missing to post in a channel, by display name.
 * Checked when a channel is configured rather than when the first post fails,
 * because that failure would land in a log nobody is watching yet.
 *
 * @param channel - The channel to check.
 * @param me - The bot's own member in that server.
 * @returns Empty when the bot can post there.
 */
export function missingPostPermissions(
  channel: GuildBasedChannel,
  me: GuildMember | null | undefined
): string[] {
  const permissions = me ? channel.permissionsFor(me) : null;
  return POST_PERMISSIONS.filter((permission) => !permissions?.has(permission.flag)).map(
    (permission) => permission.name
  );
}
