import type { Guild } from 'discord.js';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { logGlobal } from './logChannel.js';

/**
 * Every server-wide permission a feature of this bot relies on:
 * - posting and transcripts: View Channel, Send Messages, Embed Links, Attach Files, Read Message History
 * - tickets: Manage Channels, Manage Roles (channel overwrites, see TICKETS.md)
 * - moderation: Moderate, Kick and Ban Members, Manage Messages
 * - the `/setup` AutoMod page: Manage Server
 */
export const REQUIRED_PERMISSIONS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.BanMembers,
];

/**
 * Adds any of {@link REQUIRED_PERMISSIONS} that the bot's own role (the one
 * Discord made when it was invited) lacks, so the bot keeps working if it
 * loses the other role that gives it its permissions today. It only adds:
 * a permission the role already has, or one outside the list, is left alone.
 *
 * Discord only lets the bot edit its own role while it holds Manage Roles
 * through another role placed above it, so on a server without that this logs
 * what is missing and changes nothing.
 *
 * @returns The names of the permissions added.
 */
export async function ensureBotRolePermissions(guild: Guild): Promise<string[]> {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const role = me.roles.botRole;
  if (!role) return [];

  const missing = role.permissions.missing(REQUIRED_PERMISSIONS);
  if (missing.length === 0) return [];

  // discord.js's `role.editable` is always false for a managed role, but
  // Discord does allow editing a managed role's permissions.
  const canEdit =
    me.permissions.has(PermissionFlagsBits.ManageRoles) &&
    me.roles.highest.comparePositionTo(role) > 0;
  if (!canEdit) {
    console.warn(
      `[${guild.name}] My role ${role.name} is missing ${missing.join(', ')}, and I can't edit it.`
    );
    return [];
  }

  await role.setPermissions(
    new PermissionsBitField(role.permissions).add(missing),
    'Adding the permissions this bot needs to its own role'
  );
  console.log(`[${guild.name}] Added ${missing.join(', ')} to my role ${role.name}.`);
  await logGlobal(guild.id, {
    content: `🔧 Added **${missing.join('**, **')}** to my own role <@&${role.id}>.`,
    allowedMentions: { parse: [] },
  });
  return missing;
}
