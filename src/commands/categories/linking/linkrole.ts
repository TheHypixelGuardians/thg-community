import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember, Role } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashGroup, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { getLinkRoleId, setLinkRoleId } from '../../../utils/linkRole.js';
import { syncLinkRoles } from '../../../utils/syncLinkRoles.js';

/**
 * @returns True when the caller may run this command; replies with the refusal
 *   itself when they may not.
 */
async function gate(interaction: CommandInteraction): Promise<boolean> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command only works in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  if (!(await isAdmin(interaction.member as GuildMember))) {
    await interaction.reply({
      content: '❌ You do not have permission to use this command.',
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
}

@Discord()
@Category('Linking')
@SlashGroup({
  name: 'linkrole',
  description: 'Configure the role given to users who link a Minecraft account',
})
@SlashGroup('linkrole')
export class LinkRole {
  @Slash({
    name: 'show',
    description: 'Show the role given to users with a linked Minecraft account',
  })
  async show(interaction: CommandInteraction): Promise<void> {
    if (!(await gate(interaction))) return;

    const roleId = await getLinkRoleId(interaction.guildId as string);
    await interaction.reply(
      roleId
        ? `> Linked users are given <@&${roleId}>.`
        : '⚠️ No link role is configured yet.'
    );
  }

  @Slash({
    name: 'clear',
    description: 'Stop giving out a role on link. Does not take the role off anyone.',
  })
  async clear(interaction: CommandInteraction): Promise<void> {
    if (!(await gate(interaction))) return;

    const guildId = interaction.guildId as string;
    const previous = await getLinkRoleId(guildId);

    if (!previous) {
      await interaction.reply('⚠️ No link role is configured.');
      return;
    }

    await setLinkRoleId(guildId, null);
    await interaction.reply(
      '✅ Cleared the link role.\n' +
        `> <@&${previous}> is no longer given out or taken away, and members who ` +
        'already have it keep it.'
    );
  }

  @Slash({
    name: 'set',
    description: 'Set the role given to users with a linked Minecraft account',
  })
  async set(
    @SlashOption({
      name: 'role',
      description: 'The role to give linked users',
      type: ApplicationCommandOptionType.Role,
      required: true,
    })
    role: Role,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!(await gate(interaction))) return;

    const guildId = interaction.guildId as string;
    const me = interaction.guild?.members.me;

    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await interaction.reply('❌ I need the **Manage Roles** permission to hand out roles.');
      return;
    }

    if (role.managed) {
      await interaction.reply(
        `❌ **${role.name}** is managed by an integration, so it cannot be assigned.`
      );
      return;
    }

    if (role.comparePositionTo(me.roles.highest) >= 0) {
      await interaction.reply(
        `❌ **${role.name}** is ranked above my own highest role, so I cannot assign it.\n` +
          '> Move my role above it in **Server Settings → Roles** and try again.'
      );
      return;
    }

    const previous = await getLinkRoleId(guildId);
    await setLinkRoleId(guildId, role.id);

    // The stored links are the source of truth, so adopting a role means
    // backfilling it onto everybody who is already linked.
    await interaction.deferReply();
    const summary = await syncLinkRoles(guildId);

    const notes: string[] = [];
    if (previous && previous !== role.id) {
      notes.push(`Members still have the old <@&${previous}> — remove it yourself if unwanted.`);
    }
    if (summary.granted > 0) {
      notes.push(`Granted it to **${summary.granted}** already-linked member(s).`);
    }
    if (summary.missing > 0) {
      notes.push(`**${summary.missing}** linked user(s) are no longer in the server.`);
    }
    if (summary.failure) {
      notes.push(`⚠️ Could not update **${summary.failed}** member(s) — ${summary.failure}.`);
    }

    await interaction.editReply(
      `✅ Linked users will now be given <@&${role.id}>.` +
        notes.map((note) => `\n> ${note}`).join('')
    );
  }
}
