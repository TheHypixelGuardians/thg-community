import { EmbedBuilder } from 'discord.js';
import type { FeatureRequest } from '../generated/prisma/client.js';
import { prisma } from './prisma.js';
import { getSetup, updateSetup } from './setup.js';
import { ensureUserExists } from './userManager.js';

export type RequestStatus = 'pending' | 'planned' | 'accepted' | 'denied' | 'duplicate';

export const STATUS_COLORS: Record<RequestStatus, number> = {
  pending: 0x5865f2,
  planned: 0xf1c40f,
  accepted: 0x2ecc71,
  denied: 0xe74c3c,
  duplicate: 0x95a5a6,
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: '⏳ Pending',
  planned: '📌 Planned',
  accepted: '✅ Accepted',
  denied: '❌ Denied',
  duplicate: '🔁 Duplicate',
};

/**
 * @returns The channel `/request` submissions are posted to, or null.
 */
export async function getRequestChannelId(guildId: string): Promise<string | null> {
  const setup = await getSetup(guildId);
  return setup.requestChannelId || null;
}

export async function setRequestChannelId(
  guildId: string,
  channelId: string | null
): Promise<void> {
  await updateSetup(guildId, { requestChannelId: channelId });
}

/**
 * Stores a submission and hands back its record, including the number members
 * will see.
 *
 * The record is persisted *before* the caller posts it: two concurrent submits
 * must not share a number, which is why the id is a database sequence rather
 * than a counter the bot reads and writes back across an await. A failed send
 * only burns a number, which is harmless.
 */
export async function createRequest(submission: {
  guildId: string;
  discordId: string;
  username: string;
  title: string;
  description: string;
}): Promise<FeatureRequest> {
  const user = await ensureUserExists(submission.discordId, submission.username);

  return prisma.featureRequest.create({
    data: {
      guildId: submission.guildId,
      userId: user.id,
      title: submission.title,
      description: submission.description,
    },
  });
}

/**
 * Records where a request ended up once it has been posted.
 */
export async function attachMessage(
  id: number,
  channelId: string,
  messageId: string
): Promise<void> {
  await prisma.featureRequest.update({
    where: { id },
    data: { channelId, messageId },
  });
}

export async function getRequest(id: number): Promise<FeatureRequest | null> {
  return prisma.featureRequest.findUnique({ where: { id } });
}

/**
 * @returns The updated record, or null when there is no such request.
 */
export async function setStatus(
  id: number,
  status: RequestStatus,
  handledById: string
): Promise<FeatureRequest | null> {
  const existing = await prisma.featureRequest.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.featureRequest.update({
    where: { id },
    data: { status, handledById },
  });
}

/**
 * Renders a request record as its channel embed.
 *
 * Both the initial post and every status edit go through this, so the stored
 * record stays the single source of truth for what the message shows.
 *
 * @param authorId - Discord id of whoever submitted it.
 */
export function buildRequestEmbed(record: FeatureRequest, authorId: string): EmbedBuilder {
  const status = (record.status as RequestStatus) in STATUS_LABELS
    ? (record.status as RequestStatus)
    : 'pending';
  const quoted = record.description.split('\n').join('\n> ');

  return new EmbedBuilder()
    .setTitle(`💡 Request #${record.id} — ${record.title}`)
    .setDescription(`> ${quoted}`)
    .addFields(
      { name: 'Submitted by', value: `<@${authorId}>`, inline: true },
      { name: 'Status', value: STATUS_LABELS[status], inline: true }
    )
    .setColor(STATUS_COLORS[status])
    .setFooter({ text: `Request #${record.id}` })
    .setTimestamp(record.createdAt);
}

/**
 * The Discord id of whoever submitted a request. Stored by `User.id`, so it
 * takes a join to get back to the mention the embed shows.
 */
export async function getRequestAuthorId(record: FeatureRequest): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: record.userId },
    select: { discordId: true },
  });

  return user?.discordId ?? null;
}
