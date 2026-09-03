import { ActivityType } from 'discord.js';
import { Discord, Once } from 'discordx';
import { bot } from '../bot';
import { t } from '../utils/localization';

@Discord()
export class Ready {
  @Once()
  async ready(): Promise<void> {
    // Make sure all guilds are cached
    await bot.guilds.fetch();

    // Synchronize applications commands with Discord
    void bot.initApplicationCommands();

    // To clear all guild commands, uncomment this line,
    // This is useful when moving from guild commands to global commands
    // It must only be executed once
    //
    //  await bot.clearApplicationCommands(
    //    ...bot.guilds.cache.map((g) => g.id)
    //  );

    // Set the client status that rotates every minute with a status from an array of statuses
    const statuses = [
      { type: ActivityType.Playing, name: t('bot.status.nightmt', 'nl') },
      { type: ActivityType.Playing, name: t('bot.status.madeby', 'nl') },
      { type: ActivityType.Playing, name: t('bot.status.invite', 'nl') },
    ];
    setInterval(() => {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      bot.user?.setActivity(randomStatus.name, { type: randomStatus.type });
    }, 60000);

    console.log(`Logged in as ${bot.user?.username}`);
  }
}
