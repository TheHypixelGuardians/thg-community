import type { ArgsOf } from 'discordx';
import { Discord, On, Once } from 'discordx';
import { bot } from '../bot';
import { errorHandler } from '../utils/errorHandler';
import { CommandInteraction } from 'discord.js';

@Discord()
export class Common {
  @On()
  async messageCreate([message]: ArgsOf<'messageCreate'>): Promise<void> {
    try {
      await bot.executeCommand(message);
    } catch (error) {
      const guildId = message.guildId !== null ? message.guildId : undefined;
      await errorHandler.handleError(error as Error, undefined, {
        command: 'message',
        userId: message.author.id,
        guildId: guildId as string | undefined,
        channelId: message.channelId,
      });
    }
  }

  @On()
  async interactionCreate([interaction]: ArgsOf<'interactionCreate'>): Promise<void> {
    try {
      await bot.executeInteraction(interaction);
    } catch (error) {
      await errorHandler.handleError(error as Error, interaction as CommandInteraction, {
        command: 'interaction',
        userId: interaction.user?.id,
        guildId: interaction.guildId || undefined,
        channelId: interaction.channelId,
      });
    }
  }

  @Once()
  async ready(): Promise<void> {
   // Make sure all guilds are cached
  await bot.guilds.fetch();

  // Synchronize applications commands with Discord
  void bot.initApplicationCommands();
  
  // await bot.application?.commands.set([]);

  // To clear all guild commands, uncomment this line,
  // This is useful when moving from guild commands to global commands
  // It must only be executed once
  //
  //  await bot.clearApplicationCommands(
  //    ...bot.guilds.cache.map((g) => g.id)
  //  );

  console.log(`Logged in as ${bot.user?.username}`);
  }
}
