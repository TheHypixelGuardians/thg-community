import type { MessageCreateOptions } from 'discord.js';
import { sendToChannel } from './logChannel.js';
import { getSetup, updateSetup } from './setup.js';

/**
 * The channel disguised messages and admin-panel actions are recorded in.
 *
 * Reposting deletes the original, so the real author is no longer visible on the
 * message — this channel is the only way back to who actually said it. TriBridge
 * reads the same column so its own bridge-leg entries land in the same place.
 *
 * @returns Null when nothing is configured.
 */
export async function getAuditChannelId(guildId: string): Promise<string | null> {
  const setup = await getSetup(guildId);
  return setup.auditChannelId || null;
}

/**
 * @param channelId - Pass null to stop recording.
 */
export async function setAuditChannelId(
  guildId: string,
  channelId: string | null
): Promise<void> {
  await updateSetup(guildId, { auditChannelId: channelId });
}

/**
 * Writes a line to the audit channel.
 *
 * Deliberately never throws and never reports failure to the caller: audit
 * entries accompany work that has already happened, and a misconfigured audit
 * channel must not take that work down with it.
 *
 * @returns Whether the line landed.
 */
export async function logAudit(
  guildId: string,
  payload: string | MessageCreateOptions
): Promise<boolean> {
  const channelId = await getAuditChannelId(guildId).catch(() => null);
  if (!channelId) return false;

  const options = typeof payload === 'string' ? { content: payload } : payload;

  // Audit lines quote member-supplied names, so nothing in them may ping.
  return sendToChannel(channelId, { allowedMentions: { parse: [] }, ...options });
}
