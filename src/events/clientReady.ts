import { ActivityType } from 'discord.js';
import { Discord, Once } from 'discordx';
import { bot } from '../bot.js';
import { getLinkRoleId } from '../utils/linkRole.js';
import { t } from '../utils/localization.js';
import { logGlobal } from '../utils/logChannel.js';
import { syncLinkRoles } from '../utils/syncLinkRoles.js';

@Discord()
export class clientReady {
  @Once()
  async clientReady(): Promise<void> {
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
      { type: ActivityType.Playing, name: t('bot.status.thgcommunity', 'en') },
      { type: ActivityType.Playing, name: t('bot.status.madeby', 'en') },
      { type: ActivityType.Playing, name: t('bot.status.invite', 'en') },
    ];
    setInterval(() => {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      bot.user?.setActivity(randomStatus.name, { type: randomStatus.type });
    }, 60000);

    console.log(`Logged in as ${bot.user?.username}`);

    for (const guildId of bot.guilds.cache.keys()) {
      await this.syncLinkRolesForGuild(guildId);
    }
  }

  /**
   * Brings the link role back in sync with the stored links on every startup.
   *
   * Catches up links made while the bot was down, members who rejoined and lost
   * their roles, and links that predate the feature entirely. The links are the
   * source of truth; the roles are derived from them.
   */
  private async syncLinkRolesForGuild(guildId: string): Promise<void> {
    try {
      if (!(await getLinkRoleId(guildId))) return;

      const summary = await syncLinkRoles(guildId);

      console.log(
        `Link role sync (${guildId}): ${summary.granted} granted, ` +
          `${summary.alreadyHad} already had it, ${summary.missing} no longer in the server, ` +
          `${summary.failed} failed.`
      );

      if (summary.granted > 0) {
        await logGlobal(
          guildId,
          `🔗 Gave the link role to **${summary.granted}** already-linked member(s) on startup.`
        );
      }

      if (summary.failure) {
        await logGlobal(
          guildId,
          `⚠️ Link role sync could not update **${summary.failed}** member(s) — ${summary.failure}.`
        );
      }
    } catch (error) {
      console.error(`Link role sync failed for ${guildId}:`, error);
    }
  }
}
