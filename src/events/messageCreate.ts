import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { bot } from '../bot';
import { errorHandler } from '../utils/errorHandler';
import { ensureUserExists } from '../utils/userManager';

@Discord()
export class MessageCreate {
  @On()
  async messageCreate([message]: ArgsOf<'messageCreate'>): Promise<void> {
    try {
      // Ensure user exists in database before executing command
      if (!message.author.bot) {
        await ensureUserExists(message.author.id, message.author.username);
      }

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
}
