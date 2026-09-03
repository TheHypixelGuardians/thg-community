import { dirname, importx } from '@discordx/importer';
import { config } from 'dotenv';

import { bot } from './bot.js';
import { errorHandler, setupGlobalErrorHandlers } from './utils/errorHandler.js';
import { t } from './utils/localization.js';
import { closePrismaConnection } from './utils/userManager.js';

// Load environment variables from .env file
config();

async function run() {
  // Setup global error handlers
  setupGlobalErrorHandlers();

  // The following syntax should be used in the commonjs environment
  //
  // await importx(__dirname + "/{events,commands}/**/*.{ts,js}");

  // The following syntax should be used in the ECMAScript environment
  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`);

  // Let's start the bot
  if (!process.env.DISCORD_TOKEN) {
    throw Error('Could not find DISCORD_TOKEN in your environment');
  }

  // Log in with your bot token
  await bot.login(process.env.DISCORD_TOKEN);

  // Delete global commands on startup
  await bot.clearApplicationCommands(
    ...bot.guilds.cache.map((g) => g.id)
  );

  // Set the client for error reporting
  errorHandler.setClient(bot);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(t('bot.shutdown'));
    await closePrismaConnection();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log(t('bot.shutdown'));
    await closePrismaConnection();
    process.exit(0);
  });
}

void run();
