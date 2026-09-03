import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember } from 'discord.js';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';

@Discord()
@Category('Utility')
export class Info {
  @Slash({ description: 'Get information about a user' })
  async info(
    @SlashOption({
      name: 'user',
      description: 'The user to get info about',
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: GuildMember | null = null,
    interaction: CommandInteraction
  ): Promise<void> {
    const targetUser = user || (interaction.member as GuildMember);

    const embed = new EmbedBuilder()
      .setTitle('User Information')
      .setColor('#0099ff')
      .setThumbnail(targetUser.user.displayAvatarURL())
      .addFields(
        { name: 'Username', value: targetUser.user.tag, inline: true },
        { name: 'ID', value: targetUser.user.id, inline: true },
        {
          name: 'Joined Server',
          value: targetUser.joinedAt?.toLocaleDateString() || 'Unknown',
          inline: true,
        },
        {
          name: 'Account Created',
          value: targetUser.user.createdAt.toLocaleDateString(),
          inline: true,
        },
        { name: 'Roles', value: targetUser.roles.cache.size.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
