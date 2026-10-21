// Load .env before any import below: utils/prisma.ts reads DATABASE_URL when it is imported
import 'dotenv/config';
import { dirname, importx } from '@discordx/importer';

import { bot } from './bot.js';
import { errorHandler, setupGlobalErrorHandlers } from './utils/errorHandler.js';
import { startVerificationServer } from './utils/linkVerification.js';
import { registerGracefulShutdown } from './utils/shutdown.js';

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

  // Handle graceful shutdown (client destroy, Prisma disconnect, exit)
  registerGracefulShutdown(bot);

  // The /link verification Minecraft server, when VERIFY_SERVER_* are set
  startVerificationServer();

  // Log in with your bot token
  await bot.login(process.env.DISCORD_TOKEN);

  // Set the client for error reporting
  errorHandler.setClient(bot);
}

// A failed start must exit non-zero, or a supervisor (Docker restart policy) never restarts the bot
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
