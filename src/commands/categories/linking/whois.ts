import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember, User } from 'discord.js';
import { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { getLink, getLinkByName } from '../../../utils/linkedAccounts.js';
import { headURL } from '../../../utils/mojang.js';

@Discord()
@Category('Linking')
export class Whois {
  @Slash({ description: 'Look up an account link by Discord user or Minecraft username' })
  async whois(
    @SlashOption({
      name: 'user',
      description: 'The Discord user to look up',
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: User | null,
    @SlashOption({
      name: 'username',
      description: 'The Minecraft username to look up',
      type: ApplicationCommandOptionType.String,
      required: false,
    })
    username: string | null,
    interaction: CommandInteraction
  ): Promise<void> {
    // Same data `/links` exposes in bulk, so it takes the same gate.
    if (!(await isAdmin(interaction.member as GuildMember))) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if ((user && username) || (!user && !username)) {
      await interaction.reply({
        content: '❌ Provide exactly one of `user` or `username`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const link = user ? await getLink(user.id) : await getLinkByName(username as string);

    if (!link) {
      await interaction.editReply(
        user
          ? `⚠️ <@${user.id}> has no linked Minecraft account.`
          : `⚠️ **${username}** is not linked to any Discord user.`
      );
      return;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: link.name, iconURL: headURL(link.uuid) })
      .setDescription(
        `> **Discord:** <@${link.discordId}>\n` +
          `> **Minecraft:** ${link.name}\n` +
          `> **UUID:** \`${link.uuid}\``
      )
      .setColor(0x5865f2)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
