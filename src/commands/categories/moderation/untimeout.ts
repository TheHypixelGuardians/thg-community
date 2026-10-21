import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { REASON_MAX, runModeration } from '../../../utils/moderation.js';

@Discord()
@Category('Moderation')
export class Untimeout {
  @Slash({
    description: "Take a member's timeout off early",
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  })
  async untimeout(
    @SlashOption({
      name: 'user',
      description: 'The member',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'reason',
      description: 'Why',
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: REASON_MAX,
    })
    reason: string | null,
    interaction: CommandInteraction
  ): Promise<void> {
    await runModeration(interaction, 'untimeout', user, reason?.trim() || null);
  }
}
