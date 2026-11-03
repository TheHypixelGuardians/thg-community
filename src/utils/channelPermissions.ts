import type { GuildBasedChannel, GuildMember, PermissionsBitField } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';

/** What the bot needs to post its embeds in a channel. */
export const POST_PERMISSIONS = [
  { flag: PermissionFlagsBits.ViewChannel, name: 'View Channel' },
  { flag: PermissionFlagsBits.SendMessages, name: 'Send Messages' },
  { flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links' },
];

/**
 * The bot's permissions in a channel.
 *
 * For a channel picked in the interaction being handled (a channel option or select), Discord sends
 * them with the channel (`appPermissions`, discord.js 14.28): overwrites included, and correct even
 * when the bot's member is not cached. Pass `picked` only there. discord.js keeps `appPermissions`
 * on the cached channel after the interaction and never clears it, so on a channel looked up later
 * from a saved id it can be stale; those use `permissionsFor(me)`, which is also the fallback when
 * Discord sent none.
 *
 * @param channel - The channel to check.
 * @param me - The bot's own member in that server.
 * @param picked - True when `channel` came from the interaction being handled.
 * @returns Null when they cannot be worked out.
 */
export function botPermissionsIn(
  channel: GuildBasedChannel,
  me: GuildMember | null | undefined,
  picked = false
): Readonly<PermissionsBitField> | null {
  if (picked && channel.appPermissions) return channel.appPermissions;
  return me ? channel.permissionsFor(me) : null;
}

/**
 * The permissions the bot is missing to post in a channel, by display name.
 * Checked when a channel is configured rather than when the first post fails,
 * because that failure would land in a log nobody is watching yet.
 *
 * @param channel - The channel to check.
 * @param me - The bot's own member in that server.
 * @param picked - True when `channel` was picked in the interaction being handled; see
 *   {@link botPermissionsIn}.
 * @returns Empty when the bot can post there.
 */
export function missingPostPermissions(
  channel: GuildBasedChannel,
  me: GuildMember | null | undefined,
  picked = false
): string[] {
  const permissions = botPermissionsIn(channel, me, picked);
  return POST_PERMISSIONS.filter((permission) => !permissions?.has(permission.flag)).map(
    (permission) => permission.name
  );
}
