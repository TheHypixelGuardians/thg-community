import type { CommandInteraction, Guild, GuildMember, User } from 'discord.js';
import { EmbedBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { ModCase } from '../generated/prisma/client.js';
import { isAdmin } from './adminRoles.js';
import { logGlobal, sendToChannel } from './logChannel.js';
import { prisma } from './prisma.js';
import { getSetup } from './setup.js';

export type CaseType = 'warn' | 'timeout' | 'untimeout' | 'kick' | 'ban' | 'unban';

export const CASE_STYLE: Record<
  CaseType,
  { label: string; verb: string; emoji: string; color: number }
> = {
  warn: { label: 'Warn', verb: 'warned', emoji: '⚠️', color: 0xf1c40f },
  timeout: { label: 'Timeout', verb: 'timed out', emoji: '⏳', color: 0xe67e22 },
  untimeout: {
    label: 'Timeout removed',
    verb: 'took the timeout off',
    emoji: '⌛',
    color: 0x2ecc71,
  },
  kick: { label: 'Kick', verb: 'kicked', emoji: '👢', color: 0xe74c3c },
  ban: { label: 'Ban', verb: 'banned', emoji: '🔨', color: 0x992d22 },
  unban: { label: 'Unban', verb: 'unbanned', emoji: '🔓', color: 0x2ecc71 },
};

/**
 * The Discord permission each action needs. It is both the command's
 * `defaultMemberPermissions` and checked again when it runs, because a server
 * administrator can override the first in Discord's command settings.
 */
export const CASE_PERMISSION: Record<CaseType, bigint> = {
  warn: PermissionFlagsBits.ModerateMembers,
  timeout: PermissionFlagsBits.ModerateMembers,
  untimeout: PermissionFlagsBits.ModerateMembers,
  kick: PermissionFlagsBits.KickMembers,
  ban: PermissionFlagsBits.BanMembers,
  unban: PermissionFlagsBits.BanMembers,
};

/** Discord's longest timeout. */
export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

export const REASON_MAX = 500;

export function formatDuration(ms: number): string {
  const units: [number, string][] = [
    [24 * 60 * 60 * 1000, 'day'],
    [60 * 60 * 1000, 'hour'],
    [60 * 1000, 'minute'],
    [1000, 'second'],
  ];
  for (const [size, name] of units) {
    if (ms >= size && ms % size === 0) {
      const n = ms / size;
      return `${n} ${name}${n === 1 ? '' : 's'}`;
    }
  }
  return `${Math.round(ms / 1000)} seconds`;
}

/**
 * Why `moderator` may not act on `target`, or null when they may.
 *
 * The role checks are Discord's own hierarchy, applied to the moderator as
 * well as the bot: without the first half, anybody with Kick Members could
 * use the bot to kick someone above them, which Discord itself would refuse.
 * Bot admins are only actionable by server administrators, so a moderator
 * cannot remove the people who run both bots.
 *
 * @param target - The member, or null when the user is not in the server.
 */
export async function moderationRefusal(
  moderator: GuildMember,
  target: GuildMember | null,
  user: User,
  type: CaseType
): Promise<string | null> {
  const guild = moderator.guild;
  if (user.id === moderator.id) return '❌ You cannot do that to yourself.';
  if (user.id === guild.client.user.id) return '❌ I am not doing that to myself.';
  if (user.id === guild.ownerId) return '❌ Nobody can do that to the server owner.';

  if (!target) {
    return type === 'ban' || type === 'unban' ? null : `❌ <@${user.id}> is not in this server.`;
  }

  const isOwner = moderator.id === guild.ownerId;
  if (!isOwner && moderator.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    return `❌ <@${user.id}>'s top role is equal to or above yours.`;
  }

  if ((await isAdmin(target)) && !moderator.permissions.has(PermissionFlagsBits.Administrator)) {
    return `❌ <@${user.id}> is a bot admin. Only server administrators can do that to a bot admin.`;
  }

  const botCan =
    type === 'kick'
      ? target.kickable
      : type === 'ban'
        ? target.bannable
        : type === 'timeout' || type === 'untimeout'
          ? target.moderatable
          : true;
  if (!botCan) {
    return `❌ I cannot do that to <@${user.id}>: their top role is above mine, or I lack the permission.`;
  }

  return null;
}

/**
 * Tells a member what happened to them. Sent before a kick or ban, since it
 * can't reach them after, and after a warn or timeout. Closed DMs are normal,
 * so a failure is only recorded on the case.
 */
export async function notifyMember(
  user: User,
  guild: Guild,
  type: CaseType,
  reason: string | null,
  durationMs: number | null
): Promise<boolean> {
  const style = CASE_STYLE[type];
  const lines = [`**Server:** ${guild.name}`, `**Reason:** ${reason || '*none given*'}`];
  if (durationMs) lines.splice(1, 0, `**Duration:** ${formatDuration(durationMs)}`);

  try {
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${style.emoji} You were ${style.verb}`)
          .setDescription(lines.join('\n'))
          .setColor(style.color),
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export function buildCaseEmbed(modCase: ModCase): EmbedBuilder {
  const style = CASE_STYLE[modCase.type as CaseType] ?? CASE_STYLE.warn;
  const embed = new EmbedBuilder()
    .setTitle(`${style.emoji} Case #${modCase.id}: ${style.label}`)
    .addFields(
      { name: 'Member', value: `<@${modCase.targetId}> (${modCase.targetId})`, inline: true },
      { name: 'Moderator', value: `<@${modCase.moderatorId}>`, inline: true },
      { name: 'Reason', value: (modCase.reason || '*none given*').slice(0, 1024) }
    )
    .setColor(style.color)
    .setTimestamp(modCase.createdAt);

  if (modCase.durationSeconds) {
    embed.addFields({
      name: 'Duration',
      value: formatDuration(modCase.durationSeconds * 1000),
      inline: true,
    });
  }
  if (modCase.type !== 'unban' && modCase.type !== 'untimeout') {
    embed.addFields({ name: 'DM', value: modCase.dmSent ? 'Sent' : 'Failed', inline: true });
  }

  return embed;
}

/** Posts to the mod log channel, falling back to the general log channel. */
export async function logModeration(
  guildId: string,
  payload: Parameters<typeof sendToChannel>[1]
): Promise<void> {
  const setup = await getSetup(guildId).catch(() => null);
  if (setup?.modLogChannelId && (await sendToChannel(setup.modLogChannelId, payload))) return;
  await logGlobal(guildId, payload);
}

/** The audit log reason: who did it through the bot, and why. Discord caps it at 512. */
function auditReason(moderator: GuildMember, reason: string | null): string {
  return `${moderator.user.username}: ${reason || 'no reason given'}`.slice(0, 512);
}

/**
 * Runs one moderation action end to end: permission and hierarchy checks, the
 * DM, the Discord action, the case and the mod log.
 *
 * The case is written only after the Discord action succeeded, so the case
 * history never claims a ban that Discord refused.
 */
export async function runModeration(
  interaction: CommandInteraction,
  type: CaseType,
  user: User,
  reason: string | null,
  options: { durationMs?: number; deleteMessageSeconds?: number } = {}
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: '❌ This command only works in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!interaction.memberPermissions.has(CASE_PERMISSION[type])) {
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  const moderator = interaction.member;
  const target = await guild.members.fetch(user.id).catch(() => null);

  const refusal = await moderationRefusal(moderator, target, user, type);
  if (refusal) {
    await interaction.editReply(refusal);
    return;
  }

  const audit = auditReason(moderator, reason);
  const durationMs = options.durationMs ?? null;
  let dmSent = false;

  switch (type) {
    case 'warn':
      dmSent = await notifyMember(user, guild, type, reason, null);
      break;
    case 'timeout':
      await target?.timeout(durationMs, audit);
      dmSent = await notifyMember(user, guild, type, reason, durationMs);
      break;
    case 'untimeout':
      if (!target?.isCommunicationDisabled()) {
        await interaction.editReply(`⚠️ <@${user.id}> is not timed out.`);
        return;
      }
      await target.timeout(null, audit);
      break;
    case 'kick':
      dmSent = await notifyMember(user, guild, type, reason, null);
      await target?.kick(audit);
      break;
    case 'ban':
      if (target) dmSent = await notifyMember(user, guild, type, reason, null);
      await guild.bans.create(user.id, {
        reason: audit,
        deleteMessageSeconds: options.deleteMessageSeconds ?? 0,
      });
      break;
    case 'unban': {
      const ban = await guild.bans.fetch(user.id).catch(() => null);
      if (!ban) {
        await interaction.editReply(`⚠️ <@${user.id}> is not banned.`);
        return;
      }
      await guild.bans.remove(user.id, audit);
      break;
    }
  }

  const modCase = await prisma.modCase.create({
    data: {
      guildId: guild.id,
      type,
      targetId: user.id,
      moderatorId: moderator.id,
      reason,
      durationSeconds: durationMs ? Math.round(durationMs / 1000) : null,
      expiresAt: durationMs ? new Date(Date.now() + durationMs) : null,
      dmSent,
    },
  });

  await logModeration(guild.id, {
    embeds: [buildCaseEmbed(modCase)],
    allowedMentions: { parse: [] },
  });

  const style = CASE_STYLE[type];
  const dmNote =
    type === 'unban' || type === 'untimeout'
      ? ''
      : dmSent
        ? ' They were told by DM.'
        : " Their DMs are closed, so they weren't told.";
  await interaction.editReply(
    `${style.emoji} Case **#${modCase.id}**: ${style.verb} <@${user.id}>` +
      `${durationMs ? ` for ${formatDuration(durationMs)}` : ''}.${dmNote}`
  );
}

export async function casesFor(guildId: string, targetId: string, take = 25) {
  return prisma.modCase.findMany({
    where: { guildId, targetId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function caseById(guildId: string, id: number) {
  const modCase = await prisma.modCase.findUnique({ where: { id } });
  return modCase?.guildId === guildId ? modCase : null;
}

/**
 * Times a member out on the bot's own initiative, for automod, and records it
 * as a case with the bot as moderator. Skips quietly when the member is gone,
 * already timed out, a bot admin, or above the bot.
 *
 * @returns The case, or null when nothing was done.
 */
export async function automaticTimeout(
  guild: Guild,
  userId: string,
  durationMs: number,
  reason: string
): Promise<ModCase | null> {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member || member.user.bot || member.isCommunicationDisabled() || !member.moderatable) {
    return null;
  }
  if (member.permissions.has(PermissionFlagsBits.Administrator) || (await isAdmin(member))) {
    return null;
  }

  await member.timeout(durationMs, `Automod: ${reason}`.slice(0, 512));
  const dmSent = await notifyMember(member.user, guild, 'timeout', reason, durationMs);

  const modCase = await prisma.modCase.create({
    data: {
      guildId: guild.id,
      type: 'timeout',
      targetId: userId,
      moderatorId: guild.client.user.id,
      reason,
      durationSeconds: Math.round(durationMs / 1000),
      expiresAt: new Date(Date.now() + durationMs),
      dmSent,
    },
  });

  await logModeration(guild.id, {
    embeds: [buildCaseEmbed(modCase)],
    allowedMentions: { parse: [] },
  });
  return modCase;
}
