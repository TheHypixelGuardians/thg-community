import { Category } from '@discordx/utilities';
import type { ButtonInteraction, CommandInteraction, ModalSubmitInteraction } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ButtonComponent, Discord, ModalComponent, Slash } from 'discordx';
import { getLink, setLink } from '../../../utils/linkedAccounts.js';
import { redeemCode, verificationAddress } from '../../../utils/linkVerification.js';
import { logGlobal } from '../../../utils/logChannel.js';
import { headURL, lookupProfile, type MojangProfile } from '../../../utils/mojang.js';

const IDS = {
  usernameModal: 'linkUsernameModal',
  usernameInput: 'linkUsername',
  enterCode: 'linkEnterCode',
  codeModal: 'linkCodeModal',
  codeInput: 'linkCode',
};

/** How long the "Enter code" button keeps working after the username step. */
const PENDING_TTL_MS = 15 * 60 * 1000;

/**
 * The account each member said they would link, between the username modal
 * and the code modal. In memory on purpose: a restart only means running
 * `/link` again, and a code is only ever valid for five minutes anyway.
 */
const pending = new Map<string, { profile: MojangProfile; expiresAt: number }>();

function takePending(discordId: string): MojangProfile | null {
  const entry = pending.get(discordId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    pending.delete(discordId);
    return null;
  }
  return entry.profile;
}

function instructionsEmbed(profile: MojangProfile, address: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('Blue')
    .setTitle('🔗 Link your Minecraft account')
    .setThumbnail(headURL(profile.uuid))
    .setDescription(
      [
        `Prove you own **${profile.name}**:`,
        '',
        `**1.** In Minecraft (Java Edition), add the server \`${address}\` and join it as **${profile.name}**.`,
        "**2.** You are disconnected straight away with a six-digit code. You don't load into a world.",
        '**3.** Click **Enter code** below and type the code in.',
      ].join('\n')
    )
    .setFooter({ text: 'A code expires after five minutes. Join again for a new one.' });
}

function successEmbed(profile: MojangProfile, previous: string | null): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('Green')
    .setTitle('✅ Linked')
    .setThumbnail(headURL(profile.uuid))
    .setDescription(
      `Your Discord account is now linked to **${profile.name}**.` +
        (previous && previous !== profile.name
          ? `\n> Replaced your previous link to **${previous}**.`
          : '')
    );
}

const errorEmbed = (text: string) => new EmbedBuilder().setColor('Red').setDescription(text);

@Discord()
@Category('Linking')
export class Link {
  @Slash({ description: 'Bind your Minecraft account to your Discord account' })
  async link(interaction: CommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command only works in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // showModal() must be the first response to the interaction.
    const usernameInput = new TextInputBuilder()
      .setCustomId(IDS.usernameInput)
      .setLabel('Minecraft username')
      .setPlaceholder('The Java Edition account to link')
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(16)
      .setRequired(true);

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(IDS.usernameModal)
        .setTitle('Link your Minecraft account')
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(usernameInput))
    );
  }

  @ModalComponent({ id: IDS.usernameModal })
  async usernameSubmitted(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const username = interaction.fields.getTextInputValue(IDS.usernameInput).trim();
    // The UUID is what keeps the avatar working after a Minecraft name change,
    // and what the verification code is matched against.
    let profile: MojangProfile | null;
    try {
      profile = await lookupProfile(username);
    } catch (error) {
      console.error('Mojang lookup failed:', error);
      await interaction.editReply({
        embeds: [errorEmbed('❌ Could not reach Mojang to look that name up. Try again shortly.')],
      });
      return;
    }
    if (!profile) {
      await interaction.editReply({
        embeds: [errorEmbed(`❌ No Minecraft account named \`${username}\` exists.`)],
      });
      return;
    }

    const address = verificationAddress();
    if (!address) {
      // Verification is off: the name is taken on trust, as before.
      const outcome = await completeLink(interaction, profile, false);
      await interaction.editReply({ embeds: [outcome] });
      return;
    }

    pending.set(interaction.user.id, { profile, expiresAt: Date.now() + PENDING_TTL_MS });
    await interaction.editReply({
      embeds: [instructionsEmbed(profile, address)],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(IDS.enterCode)
            .setLabel('Enter code')
            .setEmoji('🔑')
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });
  }

  @ButtonComponent({ id: IDS.enterCode })
  async enterCode(interaction: ButtonInteraction): Promise<void> {
    // The message is ephemeral, so only the member who ran /link can click it;
    // the pending entry is keyed on them all the same.
    if (!takePending(interaction.user.id)) {
      await interaction.reply({
        embeds: [errorEmbed('❌ This link request has expired. Run `/link` again.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const codeInput = new TextInputBuilder()
      .setCustomId(IDS.codeInput)
      .setLabel('Code')
      .setPlaceholder('The six-digit code from the verification server')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(7)
      .setRequired(true);

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(IDS.codeModal)
        .setTitle('Enter your link code')
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput))
    );
  }

  @ModalComponent({ id: IDS.codeModal })
  async codeSubmitted(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inCachedGuild() || !interaction.isFromMessage()) return;

    const profile = takePending(interaction.user.id);
    const address = verificationAddress();
    if (!profile || !address) {
      await interaction.update({
        embeds: [errorEmbed('❌ This link request has expired. Run `/link` again.')],
        components: [],
      });
      return;
    }

    const redeemed = redeemCode(
      interaction.user.id,
      interaction.fields.getTextInputValue(IDS.codeInput),
      profile.uuid
    );
    if (!redeemed.ok) {
      // A separate reply, so the instructions and the button stay usable.
      const text =
        redeemed.reason === 'rate_limited'
          ? '❌ Too many wrong codes. Wait ten minutes and try again.'
          : redeemed.reason === 'wrong_account'
            ? `❌ That code is for **${redeemed.name}**, not **${profile.name}**.\n> Join \`${address}\` as **${profile.name}**, or run \`/link\` again with the other name.`
            : `❌ That code is wrong or has expired.\n> Join \`${address}\` again for a new one.`;
      await interaction.reply({ embeds: [errorEmbed(text)], flags: MessageFlags.Ephemeral });
      return;
    }

    // Saving can take longer than Discord's three seconds.
    await interaction.deferUpdate();
    pending.delete(interaction.user.id);
    const outcome = await completeLink(
      interaction,
      { uuid: redeemed.uuid, name: redeemed.name },
      true
    );
    await interaction.editReply({ embeds: [outcome], components: [] });
  }
}

/**
 * Saves the link and logs it. Roles and nicknames are left to other bots: this
 * one only records who owns which account.
 *
 * A verified link takes the account over from an earlier claim; an unverified
 * one never does, or anyone could take a verified member's account by typing
 * its name.
 *
 * @returns The embed to show the member: success, or why it was refused.
 */
async function completeLink(
  interaction: ModalSubmitInteraction<'cached'>,
  profile: MojangProfile,
  verified: boolean
): Promise<EmbedBuilder> {
  const previous = await getLink(interaction.user.id);
  const result = await setLink(interaction.user.id, interaction.user.username, profile, {
    takeOver: verified,
  });

  if (!result.ok) {
    return errorEmbed(
      `⚠️ **${profile.name}** is already linked to <@${result.discordId}>.\n` +
        '> If that is wrong, ask an admin to run `/unlink` on that user.'
    );
  }

  await logGlobal(
    interaction.guildId,
    `🔗 <@${interaction.user.id}> linked to **${profile.name}**` +
      (previous ? ` (was **${previous.name}**)` : '') +
      (verified ? ', verified' : '') +
      (result.tookOverFrom ? `, taking it over from <@${result.tookOverFrom}>.` : '.')
  );

  return successEmbed(profile, previous?.name ?? null);
}
