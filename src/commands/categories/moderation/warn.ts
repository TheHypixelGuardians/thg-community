import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { REASON_MAX, runModeration } from '../../../utils/moderation.js';

@Discord()
@Category('Moderation')
export class Warn {
  @Slash({
    description: 'Warn a member: recorded as a case and sent to them by DM',
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  })
  async warn(
    @SlashOption({
      name: 'user',
      description: 'The member to warn',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'reason',
      description: 'Why (shown to the member)',
      type: ApplicationCommandOptionType.String,
      required: true,
      maxLength: REASON_MAX,
    })
    reason: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await runModeration(interaction, 'warn', user, reason.trim());
  }
}
