import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { REASON_MAX, runModeration } from '../../../utils/moderation.js';

@Discord()
@Category('Moderation')
export class Unban {
  @Slash({
    description: 'Lift a ban',
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  })
  async unban(
    @SlashOption({
      name: 'user',
      description: 'The banned user (paste their user id)',
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
    await runModeration(interaction, 'unban', user, reason?.trim() || null);
  }
}
