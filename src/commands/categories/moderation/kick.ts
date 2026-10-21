import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { REASON_MAX, runModeration } from '../../../utils/moderation.js';

@Discord()
@Category('Moderation')
export class Kick {
  @Slash({
    description: 'Kick a member from the server',
    defaultMemberPermissions: PermissionFlagsBits.KickMembers,
  })
  async kick(
    @SlashOption({
      name: 'user',
      description: 'The member to kick',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'reason',
      description: 'Why (shown to the member)',
      type: ApplicationCommandOptionType.String,
      required: false,
      maxLength: REASON_MAX,
    })
    reason: string | null,
    interaction: CommandInteraction
  ): Promise<void> {
    await runModeration(interaction, 'kick', user, reason?.trim() || null);
  }
}
