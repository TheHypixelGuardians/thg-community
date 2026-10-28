import { Category, type ICategory } from '@discordx/utilities';
import {
  type CommandInteraction,
  ContainerBuilder,
  type GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  type PermissionResolvable,
  PermissionsBitField,
  type SelectMenuComponentOptionData,
  SeparatorSpacingSize,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  TextDisplayBuilder,
} from 'discord.js';
import type { Client } from 'discordx';
import {
  type DApplicationCommand,
  Discord,
  MetadataStorage,
  SelectMenuComponent,
  Slash,
} from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { capitalise, deletableCheck, getCommandIds } from '../../../utils/util.js';

/** The privacy policy for both THG bots, linked from every help view. */
const PRIVACY_URL = 'https://thehypixelguardians.mintlify.site/privacy';

// Map categories to their emojis
const categoryEmojis: Record<string, string> = {
  utility: '⚙️',
  moderation: '🔨',
  fun: '🎉',
  information: '💡',
  linking: '🔗',
  requests: '📮',
  management: '🛠️',
  tickets: '🎫',
};

/** Private commands that /help never lists. */
const HIDDEN_COMMANDS = new Set(['pingdiamond']);

/** Commands only bot-admin roles may run (checked at runtime), listed only for them. */
const BOT_ADMIN_COMMANDS = new Set([
  'links',
  'whois',
  'setrank',
  'requestchannel',
  'requeststatus',
]);

/** What decides which commands someone sees: their server permissions and bot-admin role. */
interface Viewer {
  permissions: Readonly<PermissionsBitField> | null;
  botAdmin: boolean;
}

type HelpInteraction = CommandInteraction | StringSelectMenuInteraction;

async function viewerOf(interaction: HelpInteraction): Promise<Viewer> {
  return {
    permissions: interaction.memberPermissions,
    botAdmin: await isAdmin(interaction.member as GuildMember),
  };
}

/**
 * Whether /help lists a command for this viewer: not private, bot-admin commands only for
 * bot-admins, and the command's default member permissions met (Administrator passes; DMs only
 * show commands without any), like Discord's own command picker. Template candidate.
 */
function canSeeCommand(cmd: DApplicationCommand, viewer: Viewer): boolean {
  const name = cmd.name?.toLowerCase() ?? '';
  if (name === 'help' || HIDDEN_COMMANDS.has(name)) return false;
  if (BOT_ADMIN_COMMANDS.has(name) && !viewer.botAdmin) return false;

  const required = cmd.defaultMemberPermissions;
  if (required === undefined || required === null) return true;
  if (!viewer.permissions) return false;
  if (viewer.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return viewer.permissions.has(PermissionsBitField.resolve(required as PermissionResolvable));
}

/**
 * Get the emoji for a category, defaults to wrench
 */
function getCategoryEmoji(category: string): string {
  return categoryEmojis[category.toLowerCase()] || '🔧';
}

/**
 * Pull categories that have at least one command this viewer can see (excludes `/help` itself).
 */
function getCategoriesAsOptions(viewer: Viewer): SelectMenuComponentOptionData[] {
  const uniqueCategories = Array.from(
    new Set(
      MetadataStorage.instance.applicationCommands
        .filter(
          (cmd: DApplicationCommand & ICategory) => cmd.category && canSeeCommand(cmd, viewer)
        )
        .map((cmd: DApplicationCommand & ICategory) => cmd.category as string)
    )
  );

  return uniqueCategories.map((cat) => ({
    label: `${getCategoryEmoji(cat)} ${cat}`,
    value: `help-${cat.toLowerCase()}`,
  }));
}

/**
 * Build the formatted command list for a specific category
 */
async function buildCommandsList(
  category: string,
  client: Client,
  viewer: Viewer
): Promise<string> {
  // Filter commands by category, keeping only those this viewer can see
  const filteredCommands = MetadataStorage.instance.applicationCommands.filter(
    (cmd: DApplicationCommand & ICategory) =>
      cmd.category?.toLowerCase() === category.toLowerCase() && canSeeCommand(cmd, viewer)
  );

  if (filteredCommands.length === 0) {
    return '> *No commands in this category.*';
  }

  const commandIds = await getCommandIds(client);
  return filteredCommands
    .map((cmd) => {
      const commandId = commandIds[cmd.name];
      // Use Discord's command mention format if we have the ID, otherwise just capitalize
      const commandMention = commandId ? `</${cmd.name}:${commandId}>` : capitalise(cmd.name);
      return `> 🔹 **${commandMention}**\n> \u200b \u200b \u200b *${cmd.description}*`;
    })
    .join('\n');
}

/**
 * The main container builder - handles all three display modes based on what options are passed
 */
async function buildHelpContainer(
  client: Client,
  viewer: Viewer,
  options: {
    category?: string;
    selectMenu?: StringSelectMenuBuilder;
    showCategorySelector?: boolean;
  } = {}
): Promise<ContainerBuilder> {
  const { category, selectMenu, showCategorySelector } = options;

  // Every help view starts with this header
  const headerText = new TextDisplayBuilder().setContent(
    [
      `# 🚀 **${client.user?.username} Command Center**`,
      `> 👋 **Welcome to ${client.user?.username}'s command hub!**`,
    ].join('\n')
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(headerText)
    .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Large));

  if (showCategorySelector) {
    // Initial view - show category picker
    const selectText = new TextDisplayBuilder().setContent(
      [
        '## 📂 **Command Categories**',
        '',
        '> **Choose a category below to explore available commands**',
        '> Each category contains specialized commands for different features',
      ].join('\n')
    );

    container.addTextDisplayComponents(selectText);
    if (selectMenu) {
      container.addActionRowComponents((row) => row.addComponents(selectMenu));
    }
  } else if (category) {
    // Category view - show commands for the selected category
    const commandsList = await buildCommandsList(category, client, viewer);
    const commandsText = new TextDisplayBuilder().setContent(
      [
        `## ${getCategoryEmoji(category)} **${capitalise(category)} Commands**`,
        '',
        commandsList,
        '',
      ].join('\n')
    );

    container.addTextDisplayComponents(commandsText);

    // Add the dropdown back so users can switch categories
    if (selectMenu) {
      container
        .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents((row) => row.addComponents(selectMenu));
    }
  }

  container
    .addSeparatorComponents((separator) => separator.setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          '-# Missing a command? You only see the ones your permissions in this server allow.',
          `-# [Privacy policy](${PRIVACY_URL}) · Problems or data requests: open a Support ticket`,
        ].join('\n')
      )
    );

  return container;
}

/**
 * Handle the initial /help command
 */
async function handleHelp(
  interaction: CommandInteraction,
  client: Client,
  selectMenu: StringSelectMenuBuilder,
  viewer: Viewer
) {
  const cats = getCategoriesAsOptions(viewer);

  if (cats.length <= 1) {
    const first = cats[0];
    if (!first) {
      return;
    }

    const selectedCategory = first.value.replace(/^help-/, '').toLowerCase();
    const container = await buildHelpContainer(client, viewer, { category: selectedCategory });

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  } else {
    // Multiple categories
    const container = await buildHelpContainer(client, viewer, {
      selectMenu,
      showCategorySelector: true,
    });

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

/**
 * Handle when someone picks a category from the dropdown
 */
async function handleSelectMenu(
  interaction: StringSelectMenuInteraction,
  client: Client,
  selectMenu: StringSelectMenuBuilder,
  viewer: Viewer
) {
  // Only let the person who ran the command use the dropdown
  if (interaction.user.id !== interaction.message.interactionMetadata?.user.id) {
    const errorText = new TextDisplayBuilder().setContent(
      [
        '## ⛔ **Access Denied**',
        '',
        `> **${client.user?.username} - Help**`,
        '> 🚫 **Error:** Only the command executor can interact with this menu!',
        '',
        '*Run the command yourself to access the help menu*',
      ].join('\n')
    );

    const errorContainer = new ContainerBuilder().addTextDisplayComponents(errorText);
    await interaction.reply({
      components: [errorContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
    return;
  }

  const selectedValue = interaction.values?.[0];
  if (!selectedValue) {
    return deletableCheck(interaction.message, 0);
  }

  // Extract the category name from the dropdown value
  const selectedCategory = selectedValue.replace(/^help-/, '').toLowerCase();
  const container = await buildHelpContainer(client, viewer, {
    category: selectedCategory,
    selectMenu,
  });

  await interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });
}

@Discord()
@Category('Utility')
export class Help {
  constructor() {
    // Bind methods
    this.help = this.help.bind(this);
    this.handle = this.handle.bind(this);
  }

  /**
   * Create the dropdown menu with current categories (MetadataStorage is empty during constructor)
   */
  private createSelectMenu(viewer: Viewer): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder()
      .setCustomId('helpSelect')
      .setPlaceholder('🎯 Choose a command category...')
      .addOptions(...getCategoriesAsOptions(viewer));
  }

  /**
   * Main help command - shows either category picker or single category commands
   */
  @Slash({ description: 'Display list of commands.' })
  async help(interaction: CommandInteraction, client: Client) {
    if (!interaction.channel) {
      return;
    }

    const viewer = await viewerOf(interaction);
    const selectMenu = this.createSelectMenu(viewer);
    await handleHelp(interaction, client, selectMenu, viewer);
  }

  /**
   * Handles category selection from the dropdown
   */
  @SelectMenuComponent({ id: 'helpSelect' })
  async handle(interaction: StringSelectMenuInteraction, client: Client): Promise<void> {
    const viewer = await viewerOf(interaction);
    const selectMenu = this.createSelectMenu(viewer);
    await handleSelectMenu(interaction, client, selectMenu, viewer);
  }
}
