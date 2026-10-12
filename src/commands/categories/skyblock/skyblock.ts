import { Category } from '@discordx/utilities';
import type { CommandInteraction } from 'discord.js';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import {
  formatUuidDashed,
  getGuildByPlayer,
  getSkyblockProfiles,
  type HypixelFailureCode,
  minecraftHeadUrl,
  pickSelectedProfile,
  type SkyblockMember,
  skillAverage,
  skyblockLevelFromExperience,
} from '../../../utils/hypixel.js';
import { lookupProfile } from '../../../utils/mojang.js';

function formatCoins(value: number | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.floor(value).toLocaleString('en-US');
}

function gameModeLabel(mode: string | undefined, normalLabel: string): string {
  if (!mode) return normalLabel;
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

function hypixelErrorMessage(code: HypixelFailureCode, username?: string): string {
  switch (code) {
    case 'no-key':
      return '❌ The Hypixel API key is not configured. Ask an admin to set `HYPIXEL_API_KEY`.';
    case 'rate-limit':
      return '⚠️ Hypixel rate limit. Please try again shortly.';
    case 'invalid-key':
      return '❌ The Hypixel API key is invalid. Ask an admin to check it.';
    case 'no-profiles':
      return `❌ **${username ?? '?'}** has no SkyBlock profiles.`;
    default:
      return '❌ Hypixel API is unreachable right now. Please try again shortly.';
  }
}

@Discord()
@Category('Skyblock')
export class Skyblock {
  @Slash({ description: "Look up a player's SkyBlock profile" })
  async skyblock(
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

    const hidden = 'Hidden (API settings)';
    const normal = 'Normal';

    let profile: Awaited<ReturnType<typeof lookupProfile>>;
    try {
      profile = await lookupProfile(username);
    } catch {
      await interaction.editReply('❌ Could not reach Mojang. Please try again shortly.');
      return;
    }

    if (!profile) {
      await interaction.editReply(`❌ No Minecraft account named \`${username}\` exists.`);
      return;
    }

    const profilesResult = await getSkyblockProfiles(profile.uuid);
    if (!profilesResult.ok) {
      await interaction.editReply(hypixelErrorMessage(profilesResult.code, profile.name));
      return;
    }

    const selected = pickSelectedProfile(profilesResult.data.profiles);
    const dashed = formatUuidDashed(profile.uuid);
    const undashed = profile.uuid.replace(/-/g, '').toLowerCase();
    const members = selected.members ?? {};
    const memberKey = Object.keys(members).find(
      (key) => key.replace(/-/g, '').toLowerCase() === undashed
    );
    const member: SkyblockMember | undefined =
      (memberKey ? members[memberKey] : undefined) ?? members[dashed] ?? members[profile.uuid];

    const purse = formatCoins(member?.currencies?.coin_purse);
    const bank = formatCoins(selected.banking?.balance);
    const average = skillAverage(member);
    const sbLevel = skyblockLevelFromExperience(member?.leveling?.experience ?? 0);
    const cuteName = selected.cute_name?.trim() || '?';
    const mode = gameModeLabel(selected.game_mode, normal);

    let guildName: string | null = null;
    const guildResult = await getGuildByPlayer(profile.uuid);
    if (guildResult.ok && guildResult.data.guild?.name) {
      guildName = String(guildResult.data.guild.name);
    }

    const embed = new EmbedBuilder()
      .setTitle(`SkyBlock — ${profile.name}`)
      .setColor(0x55ff55)
      .setThumbnail(minecraftHeadUrl(profile.uuid))
      .addFields(
        {
          name: 'Profile',
          value: cuteName,
          inline: true,
        },
        {
          name: 'Mode',
          value: mode,
          inline: true,
        },
        {
          name: 'SkyBlock level',
          value: String(sbLevel),
          inline: true,
        },
        {
          name: 'Skill average',
          value: average != null ? average.toFixed(2) : hidden,
          inline: true,
        },
        {
          name: 'Purse',
          value: purse ?? hidden,
          inline: true,
        },
        {
          name: 'Bank',
          value: bank ?? hidden,
          inline: true,
        }
      )
      .setTimestamp();

    if (guildName) {
      embed.addFields({
        name: 'Guild',
        value: guildName,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
}
