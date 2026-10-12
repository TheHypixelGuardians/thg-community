import { Category } from '@discordx/utilities';
import type { CommandInteraction } from 'discord.js';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { minecraftHeadUrl } from '../../../utils/hypixel.js';
import { t } from '../../../utils/localization.js';
import {
  formatCoins,
  formatExact,
  lookupNetworth,
  type NetworthFailureCode,
  type NetworthLookupResult,
} from '../../../utils/networth.js';

const TYPE_ORDER = [
  'armor',
  'equipment',
  'wardrobe',
  'inventory',
  'enderchest',
  'storage',
  'accessories',
  'pets',
  'museum',
  'sacks',
  'personal_vault',
] as const;

function failureMessage(code: NetworthFailureCode, detail?: string, retryAfterMs?: number): string {
  switch (code) {
    case 'no-key':
      return t('commands.networth.noKey');
    case 'invalid-key':
      return t('commands.networth.invalidKey');
    case 'rate-limit':
      return t('commands.networth.rateLimit');
    case 'unknown-player':
      return t('commands.networth.noPlayer', { username: detail ?? '?' });
    case 'mojang-error':
      return t('commands.networth.mojangError');
    case 'no-profiles':
      return t('commands.networth.noProfiles', { username: detail ?? '?' });
    case 'no-networth':
      return t('commands.networth.noNetworth', { username: detail ?? '?' });
    case 'cooldown': {
      const seconds = Math.max(1, Math.ceil((retryAfterMs ?? 15000) / 1000));
      return t('commands.networth.cooldown', { seconds: String(seconds) });
    }
    case 'calc-error':
      return t('commands.networth.calcError');
    default:
      return t('commands.networth.apiError');
  }
}

function buildEmbed(result: Extract<NetworthLookupResult, { ok: true }>): EmbedBuilder {
  const { player, best, profiles } = result;
  const apiOff = best.noInventory ? ` ${t('commands.networth.apiOff')}` : '';

  const embed = new EmbedBuilder()
    .setTitle(t('commands.networth.title', { username: player.name }))
    .setColor(0xf1c40f)
    .setThumbnail(minecraftHeadUrl(player.uuid))
    .setDescription(
      [
        `> **${t('commands.networth.networth')}:** ${formatExact(best.networth)} coins${apiOff}`,
        `> **${t('commands.networth.unsoulbound')}:** ${formatExact(best.unsoulbound)} coins`,
        `> **${t('commands.networth.profile')}:** ${best.cuteName}${
          best.gameMode ? ` (${best.gameMode})` : ''
        }`,
      ].join('\n')
    )
    .addFields(
      {
        name: t('commands.networth.purse'),
        value: formatCoins(best.purse),
        inline: true,
      },
      {
        name: t('commands.networth.bank'),
        value: formatCoins(best.bank),
        inline: true,
      },
      {
        name: t('commands.networth.personalBank'),
        value: formatCoins(best.personalBank),
        inline: true,
      }
    )
    .setFooter({
      text: t('commands.networth.footer'),
    })
    .setTimestamp();

  const breakdownLines: string[] = [];
  for (const key of TYPE_ORDER) {
    const entry = best.types[key];
    if (!entry || entry.total <= 0) continue;
    const label = key.replace(/_/g, ' ');
    breakdownLines.push(`**${label}:** ${formatCoins(entry.total)}`);
  }
  for (const [key, entry] of Object.entries(best.types)) {
    if ((TYPE_ORDER as readonly string[]).includes(key)) continue;
    if (!entry || entry.total <= 0) continue;
    breakdownLines.push(`**${key.replace(/_/g, ' ')}:** ${formatCoins(entry.total)}`);
  }
  if (breakdownLines.length > 0) {
    embed.addFields({
      name: t('commands.networth.breakdown'),
      value: breakdownLines.slice(0, 12).join('\n').slice(0, 1024),
    });
  }

  if (profiles.length > 1) {
    const others = profiles
      .slice(0, 8)
      .map((p) => `${p.cuteName} ${formatCoins(p.networth)}`)
      .join(' · ');
    embed.addFields({
      name: t('commands.networth.allProfiles'),
      value: others.slice(0, 1024),
    });
  }

  return embed;
}

@Discord()
@Category('Skyblock')
export class Networth {
  @Slash({ description: "Look up a player's SkyBlock networth" })
  async networth(
    @SlashOption({
      name: 'username',
      description: 'Minecraft username',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    username: string,
    interaction: CommandInteraction
  ): Promise<void> {
    // interactionCreate may already have deferred to beat Discord's 3s ack window.
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const result = await lookupNetworth(username, interaction.user.id);

    if (!result.ok) {
      await interaction.editReply(failureMessage(result.code, result.detail, result.retryAfterMs));
      return;
    }

    await interaction.editReply({ embeds: [buildEmbed(result)] });
  }
}
