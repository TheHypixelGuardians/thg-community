import { Category } from '@discordx/utilities';
import type { CommandInteraction } from 'discord.js';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { minecraftHeadUrl } from '../../../utils/hypixel.js';
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
      return '❌ The Hypixel API key is not configured. Ask an admin to set `HYPIXEL_API_KEY`.';
    case 'invalid-key':
      return '❌ The Hypixel API key is invalid. Ask an admin to check it.';
    case 'rate-limit':
      return '⚠️ Hypixel rate limit. Please try again shortly.';
    case 'unknown-player':
      return `❌ No Minecraft account named \`${detail ?? '?'}\` exists.`;
    case 'mojang-error':
      return '❌ Could not reach Mojang. Please try again shortly.';
    case 'no-profiles':
      return `❌ **${detail ?? '?'}** has no SkyBlock profiles.`;
    case 'no-networth':
      return `❌ No networth found for **${detail ?? '?'}**.`;
    case 'cooldown': {
      const seconds = Math.max(1, Math.ceil((retryAfterMs ?? 15000) / 1000));
      return `⚠️ Slow down — try again in ${seconds}s.`;
    }
    case 'calc-error':
      return '❌ Could not calculate networth. Please try again shortly.';
    default:
      return '❌ Hypixel API is unreachable right now. Please try again shortly.';
  }
}

function buildEmbed(result: Extract<NetworthLookupResult, { ok: true }>): EmbedBuilder {
  const { player, best, profiles } = result;
  const apiOff = best.noInventory ? ' (API off)' : '';

  const embed = new EmbedBuilder()
    .setTitle(`Networth — ${player.name}`)
    .setColor(0xf1c40f)
    .setThumbnail(minecraftHeadUrl(player.uuid))
    .setDescription(
      [
        `> **Networth:** ${formatExact(best.networth)} coins${apiOff}`,
        `> **Unsoulbound:** ${formatExact(best.unsoulbound)} coins`,
        `> **Profile:** ${best.cuteName}${best.gameMode ? ` (${best.gameMode})` : ''}`,
      ].join('\n')
    )
    .addFields(
      {
        name: 'Purse',
        value: formatCoins(best.purse),
        inline: true,
      },
      {
        name: 'Bank',
        value: formatCoins(best.bank),
        inline: true,
      },
      {
        name: 'Personal bank',
        value: formatCoins(best.personalBank),
        inline: true,
      }
    )
    .setFooter({
      text: 'Calculated with skyhelper-networth · Hypixel API',
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
      name: 'Breakdown',
      value: breakdownLines.slice(0, 12).join('\n').slice(0, 1024),
    });
  }

  if (profiles.length > 1) {
    const others = profiles
      .slice(0, 8)
      .map((p) => `${p.cuteName} ${formatCoins(p.networth)}`)
      .join(' · ');
    embed.addFields({
      name: 'All profiles',
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
