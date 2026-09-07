import type { GuildTextBasedChannel, Message } from 'discord.js';
import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { bot } from '../bot.js';
import { isBridgeChannel } from '../utils/bridgeChannels.js';
import { auditDisguise, canRepostIn, repostAs, shouldSkip } from '../utils/disguise.js';
import { errorHandler } from '../utils/errorHandler.js';
import { appliesTo, getTarget } from '../utils/globalProfile.js';
import { ensureUserExists } from '../utils/userManager.js';

// `@SimpleCommand` messages are left alone: the repost deletes the original, so
// the command's own reply would point at a message that no longer exists.
const SIMPLE_COMMAND_PREFIX = '!';

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
      await this.applyGlobalProfile(message);
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

  /**
   * Reposts a message under the global profile change's target identity.
   *
   * Deliberately does nothing in a channel TriBridge owns. The bridge channel is
   * reposted by TriBridge itself, and two bots deleting the same message would
   * race; an officer channel is worse, because the officer relay drops anything
   * a bot authored, so a webhook repost there would lose the message with no
   * error anywhere.
   */
  private async applyGlobalProfile(message: Message): Promise<void> {
    // Webhook reposts are authored by a bot, so this guard is also what stops
    // the repost loop.
    if (message.author.bot) return;
    if (!message.guildId || !message.inGuild()) return;
    if (message.content.startsWith(SIMPLE_COMMAND_PREFIX)) return;

    // Cheapest first: the effect gate is a cached read, so a server with nothing
    // running does no database work at all on the message path.
    if (!(await appliesTo(message.guildId, message.author.id, message.channel.id))) return;
    if (await isBridgeChannel(message.guildId, message.channel.id)) return;
    if (shouldSkip(message)) return;
    if (!canRepostIn(message.channel as GuildTextBasedChannel)) return;

    const target = await getTarget(message.guildId);
    if (!target) return;

    const result = await repostAs(message, target);
    if (!result.ok) return;

    await auditDisguise(message, target, result.url);
  }
}
