import type { AutoModerationActionExecution, AutoModerationRule, Guild } from 'discord.js';
import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  DiscordAPIError,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
} from 'discord.js';
import { getRoles } from './adminRoles.js';
import { automaticTimeout, formatDuration } from './moderation.js';
import { getSetup, updateSetup } from './setup.js';

const TRIGGER_LABEL: Record<AutoModerationRuleTriggerType, string> = {
  [AutoModerationRuleTriggerType.Keyword]: 'Custom words',
  [AutoModerationRuleTriggerType.Spam]: 'Suspected spam',
  [AutoModerationRuleTriggerType.KeywordPreset]: 'Commonly flagged words',
  [AutoModerationRuleTriggerType.MentionSpam]: 'Mention spam',
  [AutoModerationRuleTriggerType.MemberProfile]: 'Member profile names',
};

const PRESET_LABEL: Record<AutoModerationRuleKeywordPresetType, string> = {
  [AutoModerationRuleKeywordPresetType.Profanity]: 'profanity',
  [AutoModerationRuleKeywordPresetType.SexualContent]: 'sexual content',
  [AutoModerationRuleKeywordPresetType.Slurs]: 'slurs',
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What a rule matches, without listing the words themselves. */
function describeTrigger(rule: AutoModerationRule): string {
  const meta = rule.triggerMetadata;
  const parts: string[] = [];
  if (meta.keywordFilter.length > 0) parts.push(plural(meta.keywordFilter.length, 'word'));
  if (meta.regexPatterns.length > 0) parts.push(plural(meta.regexPatterns.length, 'pattern'));
  if (meta.presets.length > 0) {
    parts.push(meta.presets.map((p) => PRESET_LABEL[p] ?? `preset ${p}`).join(', '));
  }
  if (meta.mentionTotalLimit !== null) parts.push(`over ${meta.mentionTotalLimit} mentions`);
  if (meta.mentionRaidProtectionEnabled) parts.push('raid protection');
  if (meta.allowList.length > 0) parts.push(`${plural(meta.allowList.length, 'word')} allowed`);

  const label = TRIGGER_LABEL[rule.triggerType] ?? `Trigger ${rule.triggerType}`;
  return parts.length > 0 ? `${label}: ${parts.join(', ')}` : label;
}

function describeActions(rule: AutoModerationRule): string {
  const actions = rule.actions.map((action) => {
    switch (action.type) {
      case AutoModerationActionType.BlockMessage:
        return 'block the message';
      case AutoModerationActionType.SendAlertMessage:
        return action.metadata.channelId ? `alert in <#${action.metadata.channelId}>` : 'alert';
      case AutoModerationActionType.Timeout:
        return action.metadata.durationSeconds
          ? `time out for ${formatDuration(action.metadata.durationSeconds * 1000)}`
          : 'time out';
      case AutoModerationActionType.BlockMemberInteraction:
        return 'block the member from interacting';
      default:
        return `action ${action.type}`;
    }
  });
  return actions.length > 0 ? actions.join(', ') : 'no actions';
}

/**
 * Lists the server's native AutoMod rules, as lines for the `/setup` AutoMod
 * page. It only reads: it shows what is already in place, so anything the bot
 * adds later can be built around it instead of duplicating it.
 *
 * Keyword lists are summarised as counts. The panel is ephemeral, but the
 * words in a slur filter are not worth echoing back.
 *
 * @returns The lines to show, or a reason the rules could not be read.
 */
export async function describeAutoModRules(
  guild: Guild
): Promise<{ lines: string[] } | { error: string }> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return { error: '❌ I need the **Manage Server** permission to read the AutoMod rules.' };
  }

  let rules: AutoModerationRule[];
  try {
    rules = [...(await guild.autoModerationRules.fetch()).values()];
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.MissingPermissions) {
      return { error: '❌ I need the **Manage Server** permission to read the AutoMod rules.' };
    }
    throw error;
  }

  if (rules.length === 0) return { lines: ['*This server has no AutoMod rules.*'] };

  rules.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name));
  return {
    lines: rules.map((rule) => {
      const exempt: string[] = [];
      if (rule.exemptRoles.size > 0) exempt.push(plural(rule.exemptRoles.size, 'role'));
      if (rule.exemptChannels.size > 0) exempt.push(plural(rule.exemptChannels.size, 'channel'));
      const by = rule.creatorId === guild.client.user.id ? ' · made by this bot' : '';

      return [
        `${rule.enabled ? '🟢' : '⚪'} **${rule.name}**${rule.enabled ? '' : ' (off)'}${by}`,
        `> ${describeTrigger(rule)}`,
        `> Then: ${describeActions(rule)}`,
        exempt.length > 0 ? `> Exempt: ${exempt.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }),
  };
}

const INVITE_RULE_NAME = 'Block Invite Links (THG Community bot)';

/**
 * Discord invites in any of their forms. AutoMod regexes are Rust-flavoured
 * and matched against the whole message.
 */
const INVITE_PATTERN = '(?i)(discord\\.gg|discord(app)?\\.com/invite|dsc\\.gg)/[a-z0-9-]+';

/** The bot's invite-link rule, or null when it is off or was deleted by hand. */
export async function getInviteRule(guild: Guild): Promise<AutoModerationRule | null> {
  const { automodInviteRuleId } = await getSetup(guild.id);
  if (!automodInviteRuleId) return null;
  return guild.autoModerationRules.fetch(automodInviteRuleId).catch(() => null);
}

/**
 * Creates the invite-link rule. It is a separate native rule made by the bot:
 * the server's own rules are never edited, so staff stay in charge of those in
 * Server Settings. Bot admins are exempt, and the mod log, when set, gets
 * Discord's alert for every blocked invite.
 */
export async function enableInviteRule(guild: Guild): Promise<AutoModerationRule> {
  const existing = await getInviteRule(guild);
  if (existing) return existing;

  const setup = await getSetup(guild.id);
  const exemptRoles = (await getRoles(guild.id)).filter((id) => guild.roles.cache.has(id));
  const rule = await guild.autoModerationRules.create({
    name: INVITE_RULE_NAME,
    eventType: AutoModerationRuleEventType.MessageSend,
    triggerType: AutoModerationRuleTriggerType.Keyword,
    triggerMetadata: { regexPatterns: [INVITE_PATTERN] },
    actions: [
      {
        type: AutoModerationActionType.BlockMessage,
        metadata: { customMessage: 'Invite links to other servers are not allowed here.' },
      },
      ...(setup.modLogChannelId
        ? [
            {
              type: AutoModerationActionType.SendAlertMessage,
              metadata: { channel: setup.modLogChannelId },
            },
          ]
        : []),
    ],
    enabled: true,
    exemptRoles: exemptRoles.slice(0, 20),
    reason: 'Invite links switched on in /setup',
  });

  await updateSetup(guild.id, { automodInviteRuleId: rule.id });
  return rule;
}

/** Deletes the invite-link rule. A rule already deleted by hand is fine. */
export async function disableInviteRule(guild: Guild): Promise<void> {
  const rule = await getInviteRule(guild);
  if (rule) await rule.delete('Invite links switched off in /setup');
  await updateSetup(guild.id, { automodInviteRuleId: null });
}

/**
 * When each member's messages were blocked, per server, in memory. A restart
 * forgets them, which only ever errs towards not timing someone out.
 */
const strikes = new Map<string, number[]>();

/**
 * Counts one AutoMod block, from any rule, and times the member out once they
 * reach the server's limit within its window.
 *
 * Only the block action is counted. A rule that blocks and alerts fires one
 * event per action, so counting every event would give two strikes for one
 * message.
 */
export async function recordAutoModBlock(execution: AutoModerationActionExecution): Promise<void> {
  if (execution.action.type !== AutoModerationActionType.BlockMessage) return;

  const { guild, userId } = execution;
  const setup = await getSetup(guild.id);
  if (!setup.automodTimeoutEnabled) return;

  const key = `${guild.id}:${userId}`;
  const now = Date.now();
  const windowMs = setup.automodTimeoutWindowMins * 60 * 1000;
  const recent = (strikes.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);

  if (recent.length < setup.automodTimeoutStrikes) {
    strikes.set(key, recent);
    // Members who stopped tripping AutoMod would otherwise stay in the map for good.
    if (strikes.size > 1000) {
      for (const [k, times] of strikes) {
        if (now - (times.at(-1) ?? 0) > 24 * 60 * 60 * 1000) strikes.delete(k);
      }
    }
    return;
  }

  // Reset before the await, so blocks arriving meanwhile start a new count
  // instead of triggering a second timeout.
  strikes.delete(key);
  await automaticTimeout(
    guild,
    userId,
    setup.automodTimeoutMins * 60 * 1000,
    `${recent.length} messages blocked by AutoMod within ${setup.automodTimeoutWindowMins} minutes`
  );
}
