import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getLink, setLink } from '../../../utils/linkedAccounts.js';
import { applyLinkNickname, describeNicknameFailure } from '../../../utils/linkNickname.js';
import { applyLinkRole, describeFailure, resolveMember } from '../../../utils/linkRole.js';
import { redeemCode, verificationAddress } from '../../../utils/linkVerification.js';
import { logGlobal } from '../../../utils/logChannel.js';
import { lookupProfile, type MojangProfile } from '../../../utils/mojang.js';

@Discord()
@Category('Linking')
export class Link {
  @Slash({ description: 'Bind your Minecraft account to your Discord account' })
  async link(
    @SlashOption({
      name: 'code',
      description: 'The code the verification server gave you',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    code: string | null,
    @SlashOption({
      name: 'username',
      description: 'Your Minecraft username (only when verification is off)',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    username: string | null,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command only works in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const address = verificationAddress();
    let profile: MojangProfile | null;
    if (address) {
      if (!code) {
        await interaction.editReply(
          `🔐 To link, join \`${address}\` in Minecraft with the account you want to link.\n` +
            '> You are disconnected straight away with a six-digit code. Then run `/link code:<code>` here.\n' +
            '> The code expires after five minutes.'
        );
        return;
      }
      const redeemed = redeemCode(interaction.user.id, code);
      if (!redeemed.ok) {
        await interaction.editReply(
          redeemed.reason === 'rate_limited'
            ? '❌ Too many wrong codes. Wait ten minutes and try again.'
            : `❌ That code is wrong or has expired.\n> Join \`${address}\` again for a new one.`
        );
        return;
      }
      profile = { uuid: redeemed.uuid, name: redeemed.name };
    } else {
      if (!username) {
        await interaction.editReply(
          code
            ? '❌ Code verification is not set up on this bot. Use `/link username:<name>`.'
            : '❌ Give your Minecraft `username`.'
        );
        return;
      }
      profile = await resolveUnverified(interaction, username);
      if (!profile) return;
    }

    const previous = await getLink(interaction.user.id);
    const result = await setLink(interaction.user.id, interaction.user.username, profile, {
      takeOver: address !== null,
    });

    if (!result.ok) {
      await interaction.editReply(
        `⚠️ **${profile.name}** is already linked to <@${result.discordId}>.\n` +
          '> If that is wrong, ask an admin to run `/unlink` on that user.'
      );
      return;
    }

    await logGlobal(
      interaction.guildId,
      `🔗 <@${interaction.user.id}> linked to **${profile.name}**` +
        (previous ? ` (was **${previous.name}**)` : '') +
        (address ? ', verified' : '') +
        (result.tookOverFrom ? `, taking it over from <@${result.tookOverFrom}>.` : '.')
    );

    // Whoever held the account before a verified take-over no longer has a
    // link, so they lose what the link gave them. Best effort, like unlink.
    if (result.tookOverFrom) {
      const formerMember = await resolveMember(interaction.guildId, result.tookOverFrom);
      if (formerMember) {
        await applyLinkRole(formerMember, 'remove');
        await applyLinkNickname(formerMember, profile.name, 'remove');
      }
    }

    // The link stands either way — a role or nickname that cannot be set is
    // worth telling an admin about, but not worth undoing the link over.
    const member = interaction.member as GuildMember | null;
    if (member) {
      const roleResult = await applyLinkRole(member, 'add');
      const failure = describeFailure(roleResult);
      if (failure) {
        await logGlobal(
          interaction.guildId,
          `⚠️ Could not give the link role to <@${interaction.user.id}> — ${failure}.`
        );
      }

      const nicknameResult = await applyLinkNickname(member, profile.name, 'add');
      const nicknameFailure = describeNicknameFailure(nicknameResult);
      if (nicknameFailure) {
        await logGlobal(
          interaction.guildId,
          `⚠️ Could not change the nickname of <@${interaction.user.id}> — ${nicknameFailure}.`
        );
      }
    }

    const relinked = previous ? `\n> Replaced your previous link to **${previous.name}**.` : '';

    await interaction.editReply(`✅ Linked you to **${profile.name}**.${relinked}`);
  }
}

/**
 * The account for `/link username:` when verification is off: taken on trust,
 * as Mojang spells it.
 *
 * @returns The profile, or null when a reply has already been sent.
 */
async function resolveUnverified(
  interaction: CommandInteraction,
  username: string
): Promise<MojangProfile | null> {
  // The UUID is what keeps the avatar working after a Minecraft name change.
  let profile: MojangProfile | null;
  try {
    profile = await lookupProfile(username);
  } catch (error) {
    console.error('Mojang lookup failed:', error);
    await interaction.editReply(
      '❌ Could not reach Mojang to verify that username. Please try again shortly.'
    );
    return null;
  }

  if (!profile) {
    await interaction.editReply(`❌ No Minecraft account named \`${username}\` exists.`);
    return null;
  }
  return profile;
}
