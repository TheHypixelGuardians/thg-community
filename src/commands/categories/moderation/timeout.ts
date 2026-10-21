import { Category } from '@discordx/utilities';
import type { CommandInteraction, User } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { MAX_TIMEOUT_MS, REASON_MAX, runModeration } from '../../../utils/moderation.js';
import { parseDuration } from '../../../utils/util.js';

@Discord()
@Category('Moderation')
export class Timeout {
  @Slash({
    description: "Time a member out with Discord's timeout (up to 28 days)",
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
  })
  async timeout(
    @SlashOption({
      name: 'user',
      description: 'The member to time out',
      type: ApplicationCommandOptionType.User,
      required: true,
    })
    user: User,
    @SlashOption({
      name: 'duration',
      description: 'How long: a number and s, m, h or d (for example 30m, 12h, 7d)',
      type: ApplicationCommandOptionType.String,
      required: true,
      maxLength: 10,
    })
    duration: string,
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
    let durationMs: number;
    try {
      durationMs = parseDuration(duration.trim().toLowerCase());
    } catch {
      durationMs = 0;
    }
    if (durationMs < 1000 || durationMs > MAX_TIMEOUT_MS) {
      await interaction.reply({
        content: '❌ Give a duration like `30m`, `12h` or `7d`, between 1 second and 28 days.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await runModeration(interaction, 'timeout', user, reason?.trim() || null, { durationMs });
  }
}
