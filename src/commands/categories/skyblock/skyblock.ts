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
import { t } from '../../../utils/localization.js';
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
      return t('commands.skyblock.noKey');
    case 'rate-limit':
      return t('commands.skyblock.rateLimit');
    case 'invalid-key':
      return t('commands.skyblock.invalidKey');
    case 'no-profiles':
      return t('commands.skyblock.noProfiles', { username: username ?? '?' });
    default:
      return t('commands.skyblock.apiError');
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

    const hidden = t('commands.skyblock.hidden');
    const normal = t('commands.skyblock.normal');

    let profile: Awaited<ReturnType<typeof lookupProfile>>;
    try {
      profile = await lookupProfile(username);
    } catch {
      await interaction.editReply(t('commands.skyblock.mojangError'));
      return;
    }

    if (!profile) {
      await interaction.editReply(t('commands.skyblock.noPlayer', { username }));
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
      .setTitle(t('commands.skyblock.title', { username: profile.name }))
      .setColor(0x55ff55)
      .setThumbnail(minecraftHeadUrl(profile.uuid))
      .addFields(
        {
          name: t('commands.skyblock.profile'),
          value: cuteName,
          inline: true,
        },
        {
          name: t('commands.skyblock.mode'),
          value: mode,
          inline: true,
        },
        {
          name: t('commands.skyblock.level'),
          value: String(sbLevel),
          inline: true,
        },
        {
          name: t('commands.skyblock.skillAverage'),
          value: average != null ? average.toFixed(2) : hidden,
          inline: true,
        },
        {
          name: t('commands.skyblock.purse'),
          value: purse ?? hidden,
          inline: true,
        },
        {
          name: t('commands.skyblock.bank'),
          value: bank ?? hidden,
          inline: true,
        }
      )
      .setTimestamp();

    if (guildName) {
      embed.addFields({
        name: t('commands.skyblock.guild'),
        value: guildName,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
}
