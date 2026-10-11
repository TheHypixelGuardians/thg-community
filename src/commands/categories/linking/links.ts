import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember } from 'discord.js';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { Discord, Slash } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { getAllLinks } from '../../../utils/linkedAccounts.js';

// Embed description limit.
const MAX_DESCRIPTION = 4096;

@Discord()
@Category('Linking')
export class Links {
  @Slash({ description: 'List every linked Minecraft account' })
  async links(interaction: CommandInteraction): Promise<void> {
    if (!(await isAdmin(interaction.member as GuildMember))) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();

    const links = await getAllLinks();

    if (links.length === 0) {
      await interaction.editReply('⚠️ No accounts are linked yet.');
      return;
    }

    links.sort((a, b) => a.name.localeCompare(b.name));

    let description = links.map((link) => `> **${link.name}** — <@${link.discordId}>`).join('\n');

    if (description.length > MAX_DESCRIPTION) {
      description = `${description.slice(0, MAX_DESCRIPTION - 3)}...`;
    }

    const embed = new EmbedBuilder()
      .setTitle('🔗 Linked Accounts')
      .setDescription(description)
      .setColor(0x5865f2)
      .setFooter({ text: `Total: ${links.length}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
