import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { CASE_STYLE, type CaseType, casesFor, formatDuration } from '../../../utils/moderation.js';

const SHOWN = 25;

@Discord()
@Category('Moderation')
export class Cases {
  @Slash({
    description: "A member's moderation history",
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  })
  async cases(
    @SlashOption({
      name: 'user',
      description: 'The member (or a user id)',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    interaction: CommandInteraction
  ): Promise<void> {
    if (
      !interaction.inCachedGuild() ||
      !interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)
    ) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cases = await casesFor(interaction.guildId, user.id, SHOWN);
    if (cases.length === 0) {
      await interaction.editReply(`✅ <@${user.id}> has no cases.`);
      return;
    }

    const lines = cases.map((c) => {
      const style = CASE_STYLE[c.type as CaseType] ?? CASE_STYLE.warn;
      const when = `<t:${Math.floor(c.createdAt.getTime() / 1000)}:R>`;
      const duration = c.durationSeconds ? ` (${formatDuration(c.durationSeconds * 1000)})` : '';
      const reason = (c.reason || 'no reason').slice(0, 80);
      return `**#${c.id}** ${style.emoji} ${style.label}${duration} · ${when} · by <@${c.moderatorId}>\n> ${reason}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`📒 Cases for ${user.username}`)
      .setDescription(lines.join('\n').slice(0, 4096))
      .setFooter({
        text: cases.length === SHOWN ? `The latest ${SHOWN} cases` : `${cases.length} case(s)`,
      })
      .setColor(0x5865f2);

    await interaction.editReply({ embeds: [embed] });
  }
}
