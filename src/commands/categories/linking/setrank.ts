import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember, User } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { getLink, setLinkRank } from '../../../utils/linkedAccounts.js';
import { logGlobal } from '../../../utils/logChannel.js';

// Room for any Hypixel guild rank name, which the game caps well below this.
const MAX_RANK_LENGTH = 32;

@Discord()
@Category('Linking')
export class SetRank {
  @Slash({ description: "Set or clear the guild rank stored on a member's link" })
  async setrank(
    @SlashOption({
      name: 'user',
      description: 'The linked member',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'rank',
      description: 'The rank to store. Leave out to clear it.',
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: MAX_RANK_LENGTH,
    })
    rank: string | null,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guildId || !(await isAdmin(interaction.member as GuildMember))) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const value = rank?.trim() || null;
    const previous = (await getLink(user.id))?.rank ?? null;
    if (!(await setLinkRank(user.id, value))) {
      await interaction.editReply(
        `⚠️ <@${user.id}> has no linked Minecraft account, so there is nothing to put a rank on.`
      );
      return;
    }

    await logGlobal(
      interaction.guildId,
      `🏷️ <@${interaction.user.id}> ${
        value
          ? `set the rank of <@${user.id}> to **${value}**`
          : `cleared the rank of <@${user.id}>`
      }${previous ? ` (was **${previous}**).` : '.'}`
    );

    await interaction.editReply(
      value
        ? `✅ Stored **${value}** as the rank of <@${user.id}>.\n> It is only a record: no role or nickname changes.`
        : `✅ Cleared the rank of <@${user.id}>.`
    );
  }
}
