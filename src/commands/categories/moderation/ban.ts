import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashChoice, SlashOption } from 'discordx';
import { REASON_MAX, runModeration } from '../../../utils/moderation.js';

@Discord()
@Category('Moderation')
export class Ban {
  @Slash({
    description: 'Ban a user, in the server or not',
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
  })
  async ban(
    @SlashOption({
      name: 'user',
      description: 'The user to ban (a member, or a user id)',
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
    @SlashChoice({ name: "Don't delete any", value: 0 })
    @SlashChoice({ name: 'Last hour', value: 3600 })
    @SlashChoice({ name: 'Last 24 hours', value: 86400 })
    @SlashChoice({ name: 'Last 7 days', value: 604800 })
    @SlashOption({
      name: 'delete_messages',
      description: 'Delete their recent messages',
      type: ApplicationCommandOptionType.Integer,
      required: false,
    })
    deleteMessageSeconds: number | null,
    interaction: CommandInteraction
  ): Promise<void> {
    await runModeration(interaction, 'ban', user, reason?.trim() || null, {
      deleteMessageSeconds: deleteMessageSeconds ?? 0,
    });
  }
}
