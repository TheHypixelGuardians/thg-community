import { IntentsBitField } from 'discord.js';
import { Client } from 'discordx';

export const bot = new Client({
  // To use only guild command
  botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

  // Discord intents
  intents: [IntentsBitField.Flags.Guilds],

  // Debug logs are disabled in silent mode
  silent: false,
});
