import { Category } from '@discordx/utilities';
import type {
  ChannelSelectMenuInteraction,
  CommandInteraction,
  Guild,
  GuildMember,
  MessageComponentInteraction,
  RoleSelectMenuInteraction,
} from 'discord.js';
import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { Discord, SelectMenuComponent, Slash } from 'discordx';
import { addRole, getRoles, isAdmin, removeRole } from '../../../utils/adminRoles.js';
import { missingPostPermissions } from '../../../utils/channelPermissions.js';
import { getRequestChannelId, setRequestChannelId } from '../../../utils/featureRequests.js';
import { getSetup, updateSetup } from '../../../utils/setup.js';

const IDS = {
  logChannel: 'setupLogChannel',
  requestChannel: 'setupRequestChannel',
  adminRoles: 'setupAdminRoles',
} as const;

// Discord's cap on a select menu's values.
const MAX_ADMIN_ROLES = 25;

/**
 * Who may open the panel, and change any setting on it including the admin
 * roles: a bot admin, or a server administrator. The second half is what lets
 * a fresh server configure its first admin role at all. The owner chose to let
 * any bot admin edit the admin role list, so a bot admin can make others
 * admins on both bots, the bridge's `/send` included.
 */
async function canConfigure(member: GuildMember | null, isAdministrator: boolean) {
  if (isAdministrator) return true;
  return member ? isAdmin(member) : false;
}

const mentionChannel = (id: string | null) => (id ? `<#${id}>` : '*not set*');

/**
 * Builds the panel from the stored configuration. Every select shows the
 * current value as its default, and allows zero values: emptying a select is
 * how a setting is cleared.
 *
 * @param notice - The outcome of the last change, shown under the settings.
 */
async function renderPanel(guild: Guild, notice?: string): Promise<ContainerBuilder> {
  const setup = await getSetup(guild.id);
  const requestChannelId = await getRequestChannelId(guild.id);
  const adminRoleIds = await getRoles(guild.id);
  const logChannelId = setup.logChannelId || null;

  const summary = [
    '## ⚙️ Server setup',
    `**Log channel:** ${mentionChannel(logChannelId)}`,
    `**Feature request channel:** ${mentionChannel(requestChannelId)}`,
    `**Admin roles:** ${
      adminRoleIds.length > 0 ? adminRoleIds.map((id) => `<@&${id}>`).join(', ') : '*none*'
    }`,
  ].join('\n');

  const logSelect = new ChannelSelectMenuBuilder()
    .setCustomId(IDS.logChannel)
    .setPlaceholder('Log channel: links and warnings')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (logChannelId) logSelect.setDefaultChannels(logChannelId);

  const requestSelect = new ChannelSelectMenuBuilder()
    .setCustomId(IDS.requestChannel)
    .setPlaceholder('Feature request channel: where /request posts go')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (requestChannelId) requestSelect.setDefaultChannels(requestChannelId);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(summary))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Pick a value to change a setting, or clear the selection to turn it off.'
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(logSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(requestSelect)
    );

  const adminSelect = new RoleSelectMenuBuilder()
    .setCustomId(IDS.adminRoles)
    .setPlaceholder('Admin roles: who counts as bot-admin in both bots')
    .setMinValues(0)
    .setMaxValues(MAX_ADMIN_ROLES);
  if (adminRoleIds.length > 0) adminSelect.setDefaultRoles(...adminRoleIds);
  container.addActionRowComponents(
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(adminSelect)
  );

  if (notice) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(notice));
  }

  return container;
}

@Discord()
@Category('Management')
export class Setup {
  @Slash({
    name: 'setup',
    description: "Configure this bot's channels and roles for this server",
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
  })
  async setup(interaction: CommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: '❌ This command only works in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const isAdministrator = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
    // Checked here as well as through defaultMemberPermissions: a server
    // administrator can override that in Discord's command settings.
    if (!(await canConfigure(interaction.member, isAdministrator))) {
      await interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const panel = await renderPanel(interaction.guild);
    await interaction.editReply({ components: [panel], flags: MessageFlags.IsComponentsV2 });
  }

  @SelectMenuComponent({ id: IDS.logChannel })
  async logChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, async (guild) => {
      const channel = interaction.channels.first();
      if (!channel) {
        await updateSetup(guild.id, { logChannelId: null });
        return '✅ Log channel cleared. Logs fall back to `LOG_CHANNEL_ID`, if it is set.';
      }

      const resolved = guild.channels.cache.get(channel.id);
      const missing = resolved ? missingPostPermissions(resolved, guild.members.me) : ['access'];
      if (missing.length > 0) {
        return `❌ I cannot post in <#${channel.id}> — missing **${missing.join('**, **')}**.`;
      }

      await updateSetup(guild.id, { logChannelId: channel.id });
      return `✅ Logs will now be posted to <#${channel.id}>.`;
    });
  }

  @SelectMenuComponent({ id: IDS.requestChannel })
  async requestChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, async (guild) => {
      const channel = interaction.channels.first();
      if (!channel) {
        await setRequestChannelId(guild.id, null);
        return '✅ Feature request channel cleared. `/request` is off until one is set.';
      }

      const resolved = guild.channels.cache.get(channel.id);
      const missing = resolved ? missingPostPermissions(resolved, guild.members.me) : ['access'];
      if (missing.length > 0) {
        return `❌ I cannot post in <#${channel.id}> — missing **${missing.join('**, **')}**.`;
      }

      await setRequestChannelId(guild.id, channel.id);
      return `✅ Feature requests will now be posted to <#${channel.id}>.`;
    });
  }

  @SelectMenuComponent({ id: IDS.adminRoles })
  async adminRoles(interaction: RoleSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, async (guild) => {
      const selected = new Set(interaction.roles.keys());
      const current = new Set(await getRoles(guild.id));
      for (const roleId of selected) {
        if (!current.has(roleId)) await addRole(guild.id, roleId);
      }
      for (const roleId of current) {
        if (!selected.has(roleId)) await removeRole(guild.id, roleId);
      }

      return selected.size > 0
        ? `✅ Admin roles updated (**${selected.size}**). TriBridge picks the change up within 15 seconds.`
        : '⚠️ The admin role list is now empty: nobody counts as bot-admin until a role is added.';
    });
  }

  /**
   * Shared shape of every select handler: re-check who is clicking (the
   * panel is ephemeral, but a permission can be revoked while it is open),
   * acknowledge before the database work, run the change, then redraw the
   * panel with its outcome.
   */
  private async apply(
    interaction: MessageComponentInteraction,
    change: (guild: Guild) => Promise<string>
  ): Promise<void> {
    if (!interaction.inCachedGuild()) return;

    const isAdministrator = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
    if (!(await canConfigure(interaction.member, isAdministrator))) {
      await interaction.reply({
        content: '❌ You do not have permission to change these settings.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const notice = await change(interaction.guild);
    const panel = await renderPanel(interaction.guild, notice);
    await interaction.editReply({ components: [panel] });
  }
}
