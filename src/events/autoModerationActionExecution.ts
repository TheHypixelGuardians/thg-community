import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { recordAutoModBlock } from '../utils/automod.js';

@Discord()
export class autoModerationActionExecution {
  /**
   * Every action Discord's AutoMod takes, from every rule in the server. Only
   * the repeat-offender timeout uses it; the rules themselves stay native.
   */
  @On()
  async autoModerationActionExecution([
    execution,
  ]: ArgsOf<'autoModerationActionExecution'>): Promise<void> {
    try {
      await recordAutoModBlock(execution);
    } catch (error) {
      console.error('AutoMod timeout failed:', error);
    }
  }
}
