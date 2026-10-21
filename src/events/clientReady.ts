import { ActivityType } from 'discord.js';
import { Discord, Once } from 'discordx';
import { bot } from '../bot.js';
import { ensureBotRolePermissions } from '../utils/botRole.js';
import { prisma } from '../utils/prisma.js';
import { refreshUsernames } from '../utils/userManager.js';

@Discord()
export class clientReady {
  @Once()
  async clientReady(): Promise<void> {
    // Warm Prisma before any slash command can hit ensureUserExists — the first
    // query otherwise blocks the event loop long enough to expire Discord's 3s
    // interaction ack window (10062).
    try {
      await prisma.$connect();
    } catch (error) {
      console.error('Prisma connect failed on ready:', error);
    }

    // Make sure all guilds are cached
    await bot.guilds.fetch();

    // Guild commands are in use: remove stale global commands so they don't show up twice.
    // Awaited so it finishes before guild registration starts; a failure must not block it.
    if (bot.botGuilds.length > 0) {
      try {
        await bot.clearApplicationCommands();
      } catch (error) {
        console.error('Could not clear stale global commands:', error);
      }
    }

    // Synchronize application commands with Discord
    void bot.initApplicationCommands();

    // Set the client status that rotates every minute with a status from an array of statuses
    const statuses = [
      { type: ActivityType.Playing, name: 'THG Community' },
      { type: ActivityType.Playing, name: 'https://discord.gg/d7jktW3eQC' },
    ];
    setInterval(() => {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      bot.user?.setActivity(randomStatus.name, { type: randomStatus.type });
    }, 60000);

    // "Discord bot logged" is the line the panel's Node.js egg waits for before
    // it marks the server as running; reword it and the panel hangs on "starting".
    console.log(`Discord bot logged in as ${bot.user?.username}`);

    // Stored names go stale when members rename, and rows from the legacy
    // import start as the bare Discord id. Not awaited: it is one REST call
    // per member, and nothing depends on it.
    refreshUsernames()
      .then((updated) => console.log(`Username refresh: ${updated} updated.`))
      .catch((error) => console.error('Username refresh failed:', error));

    // Not awaited either: a server where the role can't be edited only logs it.
    for (const guild of bot.guilds.cache.values()) {
      ensureBotRolePermissions(guild).catch((error) =>
        console.error(`Could not update my role in ${guild.name}:`, error)
      );
    }
  }
}
