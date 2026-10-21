// Load .env before any import below: utils/prisma.ts reads DATABASE_URL when it is imported
import 'dotenv/config';
import { dirname, resolve } from '@discordx/importer';
import chokidar from 'chokidar';
import { DIService, MetadataStorage } from 'discordx';

import { bot } from './bot.js';
import { errorHandler } from './utils/errorHandler.js';
import { startVerificationServer } from './utils/linkVerification.js';
import { registerGracefulShutdown } from './utils/shutdown.js';

// The following syntax should be used in the commonjs environment
// const importPattern =  __dirname + "/{events,commands}/**/*.{ts,js}"

// The following syntax should be used in the ECMAScript environment
const importPattern = `${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`;

/**
 * Import files
 *
 * (This is a work around for imports, if it is possible to delete cache from ESM, let me know.)
 *
 * @param src glob pattern
 */
export async function LoadFiles(src: string): Promise<void> {
  const files = await resolve(src);
  await Promise.all(files.map((file) => import(`${file}?version=${Date.now().toString()}`)));
}

/**
 * Reload commands for discordx
 */
async function Reload() {
  console.log('> Reloading modules\n');

  // Remove events
  bot.removeEvents();

  // cleanup
  MetadataStorage.clear();
  DIService.engine.clearAllServices();

  // reload files
  await LoadFiles(importPattern);

  // rebuild
  await MetadataStorage.instance.build();
  await bot.initApplicationCommands();
  bot.initEvents();

  console.log('> Reload success\n');
}

/**
 * Initialize
 */
async function run() {
  // chokidar 4+ has no glob support: watch the folders and filter by extension
  const root = dirname(import.meta.url);
  const watcher = chokidar.watch([`${root}/events`, `${root}/commands`], {
    ignoreInitial: true,
    ignored: (path, stats) => !!stats?.isFile() && !/\.(ts|js)$/.test(path),
  });

  // Load commands
  await LoadFiles(importPattern);

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

  // Hot Module reload
  if (process.env.NODE_ENV !== 'production') {
    // Watch changed files using chikidar
    watcher.on('add', () => void Reload());
    watcher.on('change', () => void Reload());
    watcher.on('unlink', () => void Reload());
  }
}

void run();
