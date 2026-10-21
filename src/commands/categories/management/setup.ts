import { Category } from '@discordx/utilities';
import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  CommandInteraction,
  Guild,
  GuildMember,
  MessageComponentInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import { ButtonComponent, Discord, SelectMenuComponent, Slash } from 'discordx';
import { addRole, getRoles, isAdmin, removeRole } from '../../../utils/adminRoles.js';
import { missingPostPermissions } from '../../../utils/channelPermissions.js';
import { getRequestChannelId, setRequestChannelId } from '../../../utils/featureRequests.js';
import { getSetup, updateSetup } from '../../../utils/setup.js';
import {
  buildTicketPanel,
  missingCategoryPermissions,
  missingLogPermissions,
  ticketConfig,
} from '../../../utils/tickets.js';

const IDS = {
  page: 'setupPage',
  logChannel: 'setupLogChannel',
  requestChannel: 'setupRequestChannel',
  adminRoles: 'setupAdminRoles',
  ticketPanelChannel: 'setupTicketPanelChannel',
  ticketCategory: 'setupTicketCategory',
  ticketStaffRole: 'setupTicketStaffRole',
  ticketLogChannel: 'setupTicketLogChannel',
  ticketPostPanel: 'setupTicketPostPanel',
  modLogChannel: 'setupModLogChannel',
} as const;

/**
 * The panel is split into pages because a Components V2 message holds at most
 * 40 components, and each module adds a handful of pickers.
 */
type Page = 'general' | 'tickets' | 'moderation';

const PAGES: { value: Page; label: string; description: string }[] = [
  { value: 'general', label: 'General', description: 'Log channel, feature requests, admin roles' },
  { value: 'tickets', label: 'Tickets', description: 'Ticket panel, category, staff role, log' },
  { value: 'moderation', label: 'Moderation', description: 'Where moderation cases are logged' },
];

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
 * Builds a page of the panel from the stored configuration. Every select shows
 * the current value as its default, and allows zero values: emptying a select
 * is how a setting is cleared.
 *
 * @param notice - The outcome of the last change, shown under the settings.
 */
async function renderPanel(guild: Guild, page: Page, notice?: string): Promise<ContainerBuilder> {
  const pageSelect = new StringSelectMenuBuilder()
    .setCustomId(IDS.page)
    .addOptions(PAGES.map((p) => ({ ...p, default: p.value === page })));

  const render = { general: renderGeneral, tickets: renderTickets, moderation: renderModeration };
  const container = await render[page](guild);
  container.spliceComponents(
    1,
    0,
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(pageSelect)
  );

  if (notice) {
    container
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(notice));
  }

  return container;
}

async function renderGeneral(guild: Guild): Promise<ContainerBuilder> {
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

  return container;
}

async function renderModeration(guild: Guild): Promise<ContainerBuilder> {
  const setup = await getSetup(guild.id);
  const modLogChannelId = setup.modLogChannelId || null;

  const summary = [
    '## 🔨 Moderation',
    `**Mod log channel:** ${mentionChannel(modLogChannelId)}${
      modLogChannelId ? '' : ' (falls back to the general log channel)'
    }`,
    'Moderation commands follow Discord permissions: Moderate Members for warns and timeouts, Kick ' +
      'Members for kicks, Ban Members for bans, Manage Messages for `/purge`.',
  ].join('\n');

  const logSelect = new ChannelSelectMenuBuilder()
    .setCustomId(IDS.modLogChannel)
    .setPlaceholder('Mod log: every case and purge')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (modLogChannelId) logSelect.setDefaultChannels(modLogChannelId);

  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(summary))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(logSelect)
    );
}

async function renderTickets(guild: Guild): Promise<ContainerBuilder> {
  const config = ticketConfig(await getSetup(guild.id));
  const panelLink =
    config.panelChannelId && config.panelMessageId
      ? `https://discord.com/channels/${guild.id}/${config.panelChannelId}/${config.panelMessageId}`
      : null;

  const summary = [
    '## 🎫 Tickets',
    `**Panel channel:** ${mentionChannel(config.panelChannelId)}${
      panelLink ? ` ([panel](${panelLink}))` : ' (no panel posted)'
    }`,
    `**Category:** ${config.categoryId ? `<#${config.categoryId}>` : '*not set*'}`,
    `**Staff role:** ${config.staffRoleId ? `<@&${config.staffRoleId}>` : '*not set* (bot admins only)'}`,
    `**Log channel:** ${mentionChannel(config.logChannelId)}${
      config.logChannelId ? '' : ' (falls back to the general log channel)'
    }`,
  ].join('\n');

  const panelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(IDS.ticketPanelChannel)
    .setPlaceholder('Panel channel: where members open tickets')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (config.panelChannelId) panelSelect.setDefaultChannels(config.panelChannelId);

  const categorySelect = new ChannelSelectMenuBuilder()
    .setCustomId(IDS.ticketCategory)
    .setPlaceholder('Category: where ticket channels are made')
    .setChannelTypes(ChannelType.GuildCategory)
    .setMinValues(0)
    .setMaxValues(1);
  if (config.categoryId) categorySelect.setDefaultChannels(config.categoryId);

  const staffSelect = new RoleSelectMenuBuilder()
    .setCustomId(IDS.ticketStaffRole)
    .setPlaceholder('Staff role: sees and handles every ticket')
    .setMinValues(0)
    .setMaxValues(1);
  if (config.staffRoleId) staffSelect.setDefaultRoles(config.staffRoleId);

  const logSelect = new ChannelSelectMenuBuilder()
    .setCustomId(IDS.ticketLogChannel)
    .setPlaceholder('Ticket log: openings, closes and transcripts')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (config.logChannelId) logSelect.setDefaultChannels(config.logChannelId);

  const postButton = new ButtonBuilder()
    .setCustomId(IDS.ticketPostPanel)
    .setLabel(config.panelMessageId ? 'Post the panel again' : 'Post the panel')
    .setEmoji('📌')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!config.panelChannelId);

  return new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(summary))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'Pick a value to change a setting, or clear the selection to turn it off. Members can only ' +
          'open tickets once the category is set and the panel is posted.'
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(panelSelect),
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(categorySelect)
    )
    .addActionRowComponents(
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(staffSelect)
    )
    .addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(logSelect)
    )
    .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(postButton));
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
    const panel = await renderPanel(interaction.guild, 'general');
    await interaction.editReply({ components: [panel], flags: MessageFlags.IsComponentsV2 });
  }

  @SelectMenuComponent({ id: IDS.logChannel })
  async logChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, 'general', async (guild) => {
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
    await this.apply(interaction, 'general', async (guild) => {
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
    await this.apply(interaction, 'general', async (guild) => {
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

  @SelectMenuComponent({ id: IDS.page })
  async page(interaction: StringSelectMenuInteraction): Promise<void> {
    const page = PAGES.find((p) => p.value === interaction.values[0])?.value ?? 'general';
    await this.apply(interaction, page, async () => undefined);
  }

  @SelectMenuComponent({ id: IDS.ticketPanelChannel })
  async ticketPanelChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, 'tickets', async (guild) => {
      const channel = interaction.channels.first();
      if (!channel) {
        await updateSetup(guild.id, { ticketChannelId: null, ticketPanelMessageId: null });
        return '✅ Ticket panel channel cleared. A panel already posted keeps working.';
      }

      const resolved = guild.channels.cache.get(channel.id);
      const missing = resolved ? missingPostPermissions(resolved, guild.members.me) : ['access'];
      if (missing.length > 0) {
        return `❌ I cannot post in <#${channel.id}> — missing **${missing.join('**, **')}**.`;
      }

      await updateSetup(guild.id, { ticketChannelId: channel.id });
      return `✅ The ticket panel goes in <#${channel.id}>. Press **Post the panel** to put it there.`;
    });
  }

  @SelectMenuComponent({ id: IDS.ticketCategory })
  async ticketCategory(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, 'tickets', async (guild) => {
      const channel = interaction.channels.first();
      if (!channel) {
        await updateSetup(guild.id, { ticketCategoryId: null });
        return '✅ Ticket category cleared. Members cannot open tickets until one is set.';
      }

      const resolved = guild.channels.cache.get(channel.id);
      const missing = resolved
        ? missingCategoryPermissions(resolved, guild.members.me)
        : ['access'];
      if (missing.length > 0) {
        return `❌ I cannot make ticket channels in <#${channel.id}> — missing **${missing.join('**, **')}**.`;
      }

      await updateSetup(guild.id, { ticketCategoryId: channel.id });
      return `✅ Ticket channels will be made in <#${channel.id}>.`;
    });
  }

  @SelectMenuComponent({ id: IDS.ticketStaffRole })
  async ticketStaffRole(interaction: RoleSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, 'tickets', async (guild) => {
      const role = interaction.roles.first();
      if (!role) {
        await updateSetup(guild.id, { ticketStaffRoleId: null });
        return '✅ Ticket staff role cleared. Only bot admins handle tickets now.';
      }
      // @everyone as staff would hand every member every ticket.
      if (role.id === guild.id) return '❌ @everyone cannot be the ticket staff role.';

      await updateSetup(guild.id, { ticketStaffRoleId: role.id });
      return `✅ <@&${role.id}> now sees and handles new tickets. Tickets already open keep their old access.`;
    });
  }

  @SelectMenuComponent({ id: IDS.ticketLogChannel })
  async ticketLogChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, 'tickets', async (guild) => {
      const channel = interaction.channels.first();
      if (!channel) {
        await updateSetup(guild.id, { ticketLogChannelId: null });
        return '✅ Ticket log channel cleared. Ticket logs go to the general log channel.';
      }

      const resolved = guild.channels.cache.get(channel.id);
      const missing = resolved ? missingLogPermissions(resolved, guild.members.me) : ['access'];
      if (missing.length > 0) {
        return `❌ I cannot post in <#${channel.id}> — missing **${missing.join('**, **')}**.`;
      }

      await updateSetup(guild.id, { ticketLogChannelId: channel.id });
      return `✅ Ticket logs and transcripts will be posted to <#${channel.id}>.`;
    });
  }

  @SelectMenuComponent({ id: IDS.modLogChannel })
  async modLogChannel(interaction: ChannelSelectMenuInteraction): Promise<void> {
    await this.apply(interaction, 'moderation', async (guild) => {
      const channel = interaction.channels.first();
      if (!channel) {
        await updateSetup(guild.id, { modLogChannelId: null });
        return '✅ Mod log channel cleared. Cases go to the general log channel.';
      }

      const resolved = guild.channels.cache.get(channel.id);
      const missing = resolved ? missingPostPermissions(resolved, guild.members.me) : ['access'];
      if (missing.length > 0) {
        return `❌ I cannot post in <#${channel.id}> — missing **${missing.join('**, **')}**.`;
      }

      await updateSetup(guild.id, { modLogChannelId: channel.id });
      return `✅ Moderation cases will be posted to <#${channel.id}>.`;
    });
  }

  /** Posts the panel, replacing the previous one so the channel only ever has one. */
  @ButtonComponent({ id: IDS.ticketPostPanel })
  async ticketPostPanel(interaction: ButtonInteraction): Promise<void> {
    await this.apply(interaction, 'tickets', async (guild) => {
      const config = ticketConfig(await getSetup(guild.id));
      if (!config.panelChannelId) return '❌ Pick a panel channel first.';

      const channel = guild.channels.cache.get(config.panelChannelId);
      if (!channel?.isSendable()) return `❌ I cannot post in <#${config.panelChannelId}>.`;

      const message = await channel.send(buildTicketPanel());
      if (config.panelMessageId) {
        await channel.messages.delete(config.panelMessageId).catch(() => undefined);
      }
      await updateSetup(guild.id, { ticketPanelMessageId: message.id });

      return config.categoryId
        ? `✅ Panel posted in <#${channel.id}>.`
        : `⚠️ Panel posted in <#${channel.id}>, but no category is set, so opening a ticket fails until one is.`;
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
    page: Page,
    change: (guild: Guild) => Promise<string | undefined>
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
    const panel = await renderPanel(interaction.guild, page, notice);
    await interaction.editReply({ components: [panel] });
  }
}
