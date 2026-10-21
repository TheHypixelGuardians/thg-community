import { Category } from '@discordx/utilities';
import type { CommandInteraction, GuildMember, User } from 'discord.js';
import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { isAdmin } from '../../../utils/adminRoles.js';
import { removeLink } from '../../../utils/linkedAccounts.js';
import { applyLinkNickname } from '../../../utils/linkNickname.js';
import {
  applyLinkRole,
  describeFailure,
  type LinkRoleResult,
  resolveMember,
} from '../../../utils/linkRole.js';

@Discord()
@Category('Linking')
export class Unlink {
  @Slash({ description: 'Remove a Minecraft account link' })
  async unlink(
    @SlashOption({
      name: 'user',
      description: 'The user to unlink (admin only). Defaults to yourself.',
      type: ApplicationCommandOptionType.User,
      required: false,
    })
    user: User | null,
    interaction: CommandInteraction
  ): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: '❌ This command only works in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const target = user ?? interaction.user;
    const isSelf = target.id === interaction.user.id;

    if (!isSelf && !(await isAdmin(interaction.member as GuildMember))) {
      await interaction.reply({
        content: '❌ You do not have permission to unlink other users.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Taking the role back is a REST round trip, so defer rather than risk the
    // interaction expiring.
    await interaction.deferReply(isSelf ? { flags: MessageFlags.Ephemeral } : {});

    const removed = await removeLink(target.id);

    if (!removed) {
      await interaction.editReply(
        isSelf
          ? '⚠️ You do not have a linked Minecraft account.'
          : `⚠️ <@${target.id}> does not have a linked Minecraft account.`
      );
      return;
    }

    const member = isSelf
      ? (interaction.member as GuildMember | null)
      : await resolveMember(interaction.guildId, target.id);
    const roleResult: LinkRoleResult = member
      ? await applyLinkRole(member, 'remove')
      : { ok: false, reason: 'no-member' };
    // Only clears a nickname that is still the one /link gave; a failure here
    // is not worth a warning, since the old nickname is merely out of date.
    if (member) await applyLinkNickname(member, removed.name, 'remove');

    const failure = describeFailure(roleResult);
    const note = failure ? `\n> ⚠️ Could not take the link role back — ${failure}.` : '';

    await interaction.editReply(
      (isSelf
        ? `✅ Unlinked you from **${removed.name}**.\n` +
          '> Your messages will relay under your Discord name again.'
        : `✅ Unlinked <@${target.id}> from **${removed.name}**.`) + note
    );
  }
}
