import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getLink, setLink } from '../../../utils/linkedAccounts.js';
import { applyLinkRole, describeFailure } from '../../../utils/linkRole.js';
import { logGlobal } from '../../../utils/logChannel.js';
import { lookupProfile } from '../../../utils/mojang.js';

@Discord()
@Category('Linking')
export class Link {
  @Slash({ description: 'Bind your Minecraft account to your Discord account' })
  async link(
    @SlashOption({
      name: 'username',
      description: 'Your Minecraft username',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    username: string,
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

    // Resolve the canonical name and UUID first; the UUID is what keeps the
    // avatar working after a Minecraft name change.
    let profile: Awaited<ReturnType<typeof lookupProfile>>;
    try {
      profile = await lookupProfile(username);
    } catch (error) {
      console.error('Mojang lookup failed:', error);
      await interaction.editReply(
        '❌ Could not reach Mojang to verify that username. Please try again shortly.'
      );
      return;
    }

    if (!profile) {
      await interaction.editReply(`❌ No Minecraft account named \`${username}\` exists.`);
      return;
    }

    const previous = await getLink(interaction.user.id);
    const result = await setLink(interaction.user.id, interaction.user.username, profile);

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
        (previous ? ` (was **${previous.name}**).` : '.')
    );

    // The link stands either way — a role that cannot be granted is worth
    // telling an admin about, but not worth undoing the link over.
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
    }

    const relinked = previous ? `\n> Replaced your previous link to **${previous.name}**.` : '';

    await interaction.editReply(
      `✅ Linked you to **${profile.name}**.\n` +
        '> Your messages in the bridge channel will now show your Minecraft head and name.' +
        relinked
    );
  }
}
