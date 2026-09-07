import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  GuildMember,
  Interaction,
  ModalSubmitInteraction,
} from 'discord.js';
import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { isAdmin } from './adminRoles.js';
import {
  clearDraft,
  customId,
  DURATION_CHOICES,
  getDraft,
  mainView,
  parseCustomId,
  profileView,
  scopeView,
} from './adminPanel.js';
import { announceEnded, announceStarted } from './disguise.js';
import { parseDuration } from './duration.js';
import {
  armExpiry,
  getState,
  setDirection,
  setExcludedChannels,
  setTestChannels,
  setTesters,
  start,
  stop,
} from './globalProfile.js';
import { getLink } from './linkedAccounts.js';
import { resolveMember } from './linkRole.js';

type PanelInteraction = ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction;

/**
 * The admin panel's component dispatcher.
 *
 * Deliberately dispatched from `interactionCreate` rather than through discordx's
 * component decorators: the panel mixes buttons, user selects, channel selects
 * and a modal under one custom-id space, and every click has to re-check that
 * the person clicking is still an admin and still the person who opened it. One
 * dispatcher with those three guards at the top is what makes that impossible to
 * forget when a new button is added.
 */
export async function handleAdminPanelInteraction(interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) {
    return false;
  }

  const parsed = parseCustomId(interaction.customId);
  if (!parsed) return false;

  const panel = interaction as PanelInteraction;

  if (!panel.guildId) {
    await panel.reply({
      content: '❌ The admin panel only works in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // Re-checked on every click, not just when the panel was opened — an admin
  // role can be taken away while the panel sits there.
  if (!(await isAdmin(panel.member as GuildMember))) {
    await panel.reply({
      content: '❌ You do not have permission to use the admin panel.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (panel.user.id !== parsed.invokerId) {
    await panel.reply({
      content: '❌ Only the admin who opened this panel can use it.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  try {
    if (parsed.view === 'main') await handleMain(panel, parsed.action, parsed.invokerId);
    else if (parsed.view === 'profile')
      await handleProfile(panel, parsed.action, parsed.invokerId);
    else if (parsed.view === 'scope') await handleScope(panel, parsed.action, parsed.invokerId);
  } catch (error) {
    console.error('Admin panel interaction failed:', error);

    if (!panel.replied && !panel.deferred) {
      await panel
        .reply({
          content: '❌ Something went wrong handling that. Check the logs.',
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => undefined);
    }
  }

  return true;
}

async function handleMain(
  interaction: PanelInteraction,
  action: string,
  invokerId: string
): Promise<void> {
  const guildId = interaction.guildId as string;

  if (action === 'profile') {
    await update(interaction, await profileView(guildId, invokerId));
    return;
  }

  if (action === 'stop') {
    const previous = await stop(guildId);
    await update(interaction, await mainView(guildId, invokerId));

    // The button is disabled when nothing is running, but a panel left open from
    // an earlier effect can still send this.
    if (previous.target) {
      await announceEnded(guildId, previous, `<@${invokerId}> stopped it`);
    }
    return;
  }

  if (action === 'refresh') {
    await update(interaction, await mainView(guildId, invokerId));
  }
}

async function handleProfile(
  interaction: PanelInteraction,
  action: string,
  invokerId: string
): Promise<void> {
  const guildId = interaction.guildId as string;

  if (action === 'target' && interaction.isUserSelectMenu()) {
    getDraft(invokerId).targetId = interaction.values[0];
    await update(interaction, await profileView(guildId, invokerId));
    return;
  }

  if (action === 'duration' && interaction.isStringSelectMenu()) {
    const value = interaction.values[0];
    if (value === 'custom') {
      await showCustomDurationModal(interaction, invokerId);
      return;
    }

    const choice = DURATION_CHOICES.find((option) => option.value === value);
    if (choice && choice.ms !== undefined) {
      getDraft(invokerId).duration = { value: choice.value, ms: choice.ms };
    }

    await update(interaction, await profileView(guildId, invokerId));
    return;
  }

  if (action === 'customDuration' && interaction.isModalSubmit()) {
    const parsed = parseDuration(interaction.fields.getTextInputValue('duration'));
    if (!parsed.ok) {
      await interaction.reply({
        content:
          '❌ I could not read that as a duration. Try `90m`, `2h30m`, `3d`, or `forever`.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    getDraft(invokerId).duration = { value: 'custom', ms: parsed.ms };

    // A modal opened from a component can edit the message it came from; one
    // opened any other way has nothing to edit.
    const view = await profileView(guildId, invokerId);
    if (interaction.isFromMessage()) await interaction.update(view);
    else await interaction.reply({ ...view, flags: MessageFlags.Ephemeral });
    return;
  }

  // Read back off the stored state rather than off the button that was clicked:
  // a panel left open shows whatever was true when it was drawn, and clicking a
  // stale one should not flip the switch to what it already is.
  if (action === 'toggleMinecraft' || action === 'toggleDiscord') {
    const key = action === 'toggleMinecraft' ? 'disguiseToMinecraft' : 'disguiseToDiscord';
    const state = await getState(guildId);
    await setDirection(guildId, key, !state[key]);
    await update(interaction, await profileView(guildId, invokerId));
    return;
  }

  if (action === 'startTest') {
    await startEffect(interaction, 'test', invokerId);
    return;
  }

  if (action === 'startLive') {
    await startEffect(interaction, 'live', invokerId);
    return;
  }

  if (action === 'scope') {
    await update(interaction, await scopeView(guildId, invokerId));
    return;
  }

  if (action === 'back') {
    await update(interaction, await mainView(guildId, invokerId));
  }
}

async function handleScope(
  interaction: PanelInteraction,
  action: string,
  invokerId: string
): Promise<void> {
  const guildId = interaction.guildId as string;

  if (action === 'back') {
    await update(interaction, await profileView(guildId, invokerId));
    return;
  }

  if (!interaction.isAnySelectMenu()) return;

  // The select menus hand back the whole selection, so each one is written
  // through wholesale rather than diffed.
  if (action === 'testers') await setTesters(guildId, interaction.values);
  else if (action === 'testChannels') await setTestChannels(guildId, interaction.values);
  else if (action === 'excludedChannels') await setExcludedChannels(guildId, interaction.values);
  else return;

  await update(interaction, await scopeView(guildId, invokerId));
}

/**
 * Begins a global profile change from the panel's draft.
 */
async function startEffect(
  interaction: PanelInteraction,
  mode: 'test' | 'live',
  invokerId: string
): Promise<void> {
  const guildId = interaction.guildId as string;
  const draft = getDraft(invokerId);

  if (!draft.targetId) {
    await interaction.reply({
      content: '❌ Pick who everybody should look like first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!draft.duration) {
    await interaction.reply({
      content: '❌ Pick how long it should run first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await resolveMember(guildId, draft.targetId);
  if (!member) {
    await interaction.reply({
      content: '❌ That member is no longer in this server, so I cannot copy their profile.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Snapshotted here rather than looked up per message: the gate runs on every
  // message in the server and must not make API calls.
  const link = await getLink(member.id);
  const state = await start(guildId, {
    target: {
      userId: member.id,
      name: member.displayName,
      avatarURL: member.displayAvatarURL({ size: 256 }),
      mcName: link?.name ?? null,
      mcUuid: link?.uuid ?? null,
    },
    durationMs: draft.duration.ms,
    startedById: invokerId,
    mode,
  });

  await armExpiry(guildId, (previous) => announceEnded(guildId, previous, 'the time ran out'));
  clearDraft(invokerId);

  await update(interaction, await mainView(guildId, invokerId));
  await announceStarted(guildId, state, invokerId);
}

function showCustomDurationModal(
  interaction: PanelInteraction,
  invokerId: string
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(customId('profile', 'customDuration', invokerId))
    .setTitle('Custom duration')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('duration')
          .setLabel('How long should it run?')
          .setPlaceholder('90m, 2h30m, 3d — or "forever"')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(32)
          .setRequired(true)
      )
    );

  return (interaction as ButtonInteraction).showModal(modal);
}

/**
 * Redraws the panel in place. Modal submits that did not come from a message
 * have nothing to edit, so they get a fresh ephemeral panel instead.
 */
async function update(
  interaction: PanelInteraction,
  view: Awaited<ReturnType<typeof mainView>>
): Promise<void> {
  if (interaction.isModalSubmit() && !interaction.isFromMessage()) {
    await interaction.reply({ ...view, flags: MessageFlags.Ephemeral });
    return;
  }

  await (interaction as ButtonInteraction).update(view);
}
