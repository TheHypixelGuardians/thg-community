import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember, User } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { removeLink } from '../../../utils/linkedAccounts.js';

@Discord()
@Category('Linking')
export class Unlink {
  @Slash({ description: 'Remove a Minecraft account link' })
  async unlink(
    @SlashOption({
      name: 'user',
      description: 'The user to unlink (admin only). Defaults to yourself.',
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: User | null,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command only works in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = user ?? interaction.user;
    const isSelf = target.id === interaction.user.id;

    if (!isSelf && !(await isAdmin(interaction.member as GuildMember))) {
      await interaction.reply({
        content: '❌ You do not have permission to unlink other users.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // The database write can outlast Discord's three seconds.
    await interaction.deferReply(isSelf ? { flags: MessageFlags.Ephemeral } : {});

    const removed = await removeLink(target.id);

    if (!removed) {
      await interaction.editReply(
        isSelf
          ? '⚠️ You do not have a linked Minecraft account.'
          : `⚠️ <@${target.id}> does not have a linked Minecraft account.`
      );
      return;
    }

    await interaction.editReply(
      isSelf
        ? `✅ Unlinked you from **${removed.name}**.`
        : `✅ Unlinked <@${target.id}> from **${removed.name}**.`
    );
  }
}
