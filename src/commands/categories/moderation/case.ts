import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { buildCaseEmbed, caseById, logModeration, REASON_MAX } from '../../../utils/moderation.js';
import { prisma } from '../../../utils/prisma.js';

const idOption = {
  name: 'id',
  description: 'The case number',
  type: ApplicationCommandOptionType.Integer,
  required: true,
  minValue: 1,
} as const;

async function denied(interaction: CommandInteraction, message: string): Promise<void> {
  await interaction.reply({ content: `❌ ${message}`, flags: MessageFlags.Ephemeral });
}

/** Server administrators and bot admins, the people who may rewrite anybody's case. */
async function isCaseAdmin(member: GuildMember): Promise<boolean> {
  return member.permissions.has(PermissionFlagsBits.Administrator) || (await isAdmin(member));
}

@Discord()
@Category('Moderation')
@SlashGroup({
  name: 'case',
  description: 'Look up or correct one moderation case',
  defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
})
@SlashGroup('case')
export class Case {
  @Slash({ name: 'view', description: 'Show one case' })
  async view(@SlashOption(idOption) id: number, interaction: CommandInteraction): Promise<void> {
    if (
      !interaction.inCachedGuild() ||
      !interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)
    ) {
      await denied(interaction, 'You do not have permission to use this command.');
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const modCase = await caseById(interaction.guildId, id);
    if (!modCase) {
      await interaction.editReply(`❌ There is no case #${id}.`);
      return;
    }
    await interaction.editReply({ embeds: [buildCaseEmbed(modCase)] });
  }

  @Slash({ name: 'reason', description: "Change a case's reason (yours, or any as an admin)" })
  async reason(
    @SlashOption(idOption) id: number,
    @SlashOption({
      name: 'reason',
      description: 'The new reason',
      type: ApplicationCommandOptionType.String,
      required: true,
      maxLength: REASON_MAX,
    })
    reason: string,
    interaction: CommandInteraction
  ): Promise<void> {
    if (
      !interaction.inCachedGuild() ||
      !interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)
    ) {
      await denied(interaction, 'You do not have permission to use this command.');
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const modCase = await caseById(interaction.guildId, id);
    if (!modCase) {
      await interaction.editReply(`❌ There is no case #${id}.`);
      return;
    }
    if (modCase.moderatorId !== interaction.user.id && !(await isCaseAdmin(interaction.member))) {
      await interaction.editReply(
        '❌ Only the moderator who made a case, or an admin, can change it.'
      );
      return;
    }

    const updated = await prisma.modCase.update({
      where: { id: modCase.id },
      data: { reason: reason.trim() },
    });
    await logModeration(interaction.guildId, {
      content: `✏️ <@${interaction.user.id}> changed the reason of case **#${updated.id}**.`,
      embeds: [buildCaseEmbed(updated)],
      allowedMentions: { parse: [] },
    });
    await interaction.editReply(`✅ Case **#${updated.id}** updated.`);
  }

  @Slash({ name: 'delete', description: 'Delete a case from the history (admins only)' })
  async delete(@SlashOption(idOption) id: number, interaction: CommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild() || !(await isCaseAdmin(interaction.member))) {
      await denied(interaction, 'Only server administrators and bot admins can delete cases.');
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const modCase = await caseById(interaction.guildId, id);
    if (!modCase) {
      await interaction.editReply(`❌ There is no case #${id}.`);
      return;
    }

    // The log line keeps a record that the case existed, since the row is gone.
    await prisma.modCase.delete({ where: { id: modCase.id } });
    await logModeration(interaction.guildId, {
      content: `🗑️ <@${interaction.user.id}> deleted case **#${modCase.id}**.`,
      embeds: [buildCaseEmbed(modCase)],
      allowedMentions: { parse: [] },
    });
    await interaction.editReply(
      `✅ Case **#${modCase.id}** deleted. It does not undo the action itself: lift a ban with ` +
        '`/unban`, or a timeout with `/untimeout`.'
    );
  }
}
