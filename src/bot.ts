import { IntentsBitField } from 'discord.js';
import { Client } from 'discordx';

export const bot = new Client({
  // To use only guild command
  botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

  // Discord intents. AutoModerationExecution is not privileged; it delivers
  // AutoMod's actions for the repeat-offender timeout in utils/automod.ts.
  intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.AutoModerationExecution],

  // Debug logs are disabled in silent mode
  silent: false,
});
