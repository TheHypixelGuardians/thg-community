import { Category } from '@discordx/utilities';
import type { CommandInteraction, Role } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { addRole, getRoles, removeRole } from '../../../utils/adminRoles.js';

/**
 * Gated on the real Discord **Administrator** permission rather than on the
 * bot-admin roles this command edits — otherwise a server with no admin roles
 * configured yet could never configure one.
 *
 * `defaultMemberPermissions` alone is not enough: a server administrator can
 * override it in Discord's own command permissions, and this list decides who
 * can impersonate everybody in the server from the admin panel.
 */
async function gate(interaction: CommandInteraction): Promise<boolean> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command only works in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ Only server administrators can change the admin role list.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}

@Discord()
@Category('Management')
@SlashGroup({
  name: 'adminrole',
  description: 'Configure the roles that count as bot-admin',
  defaultMemberPermissions: PermissionFlagsBits.Administrator,
})
@SlashGroup('adminrole')
export class AdminRole {
  @Slash({ name: 'add', description: 'Add a role to the admin role list' })
  async add(
    @SlashOption({
      name: 'role',
      description: 'The role to add',
      type: ApplicationCommandOptionType.Role,
      required: true,
    })
    role: Role,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!(await gate(interaction))) return;

    await interaction.deferReply();

    const added = await addRole(interaction.guildId as string, role.id);
    await interaction.editReply(
      added
        ? `✅ Added **${role.name}** to the admin role list.`
        : `⚠️ **${role.name}** is already in the admin role list.`
    );
  }

  @Slash({ name: 'remove', description: 'Remove a role from the admin role list' })
  async remove(
    @SlashOption({
      name: 'role',
      description: 'The role to remove',
      type: ApplicationCommandOptionType.Role,
      required: true,
    })
    role: Role,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!(await gate(interaction))) return;

    await interaction.deferReply();

    const removed = await removeRole(interaction.guildId as string, role.id);
    await interaction.editReply(
      removed
        ? `✅ Removed **${role.name}** from the admin role list.`
        : `⚠️ **${role.name}** is not in the admin role list.`
    );
  }

  @Slash({ name: 'show', description: 'List the roles that count as bot-admin' })
  async show(interaction: CommandInteraction): Promise<void> {
    if (!(await gate(interaction))) return;

    await interaction.deferReply();

    const roleIds = await getRoles(interaction.guildId as string);
    if (roleIds.length === 0) {
      await interaction.editReply(
        '⚠️ No admin roles are configured, so no bot-admin command can be used yet.'
      );
      return;
    }

    await interaction.editReply({
      content: `> Bot-admin roles: ${roleIds.map((id) => `<@&${id}>`).join(', ')}`,
      allowedMentions: { parse: [] },
    });
  }
}
