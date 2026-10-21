import type { AutoModerationRule, Guild } from 'discord.js';
import {
  AutoModerationActionType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  DiscordAPIError,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
} from 'discord.js';
import { formatDuration } from './moderation.js';

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
