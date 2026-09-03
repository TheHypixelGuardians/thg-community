// This command shows the working of the database and the prisma client

import { Category } from '@discordx/utilities';
import type { AutocompleteInteraction, CommandInteraction, GuildMember } from 'discord.js';
import { ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { PrismaClient } from '../../../generated/prisma/index.js';

const prisma = new PrismaClient();

@Discord()
@Category('Utility')
export class Profile {
  @Slash({ description: 'View or create your profile' })
  async profile(
    @SlashOption({
      autocomplete: (interaction: AutocompleteInteraction) => {
        const focusedOption = interaction.options.getFocused(true);
        const choices = [
          { name: 'view', value: 'view' },
          { name: 'update', value: 'update' },
        ];
        const filtered = choices.filter((choice) =>
          choice.name.startsWith(focusedOption.value.toLowerCase())
        );
        interaction.respond(filtered.map((choice) => ({ name: choice.name, value: choice.value })));
      },
      name: 'action',
      description: 'What to do with your profile',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    action: 'view' | 'update',
    interaction: CommandInteraction
  ): Promise<void> {
    const member = interaction.member as GuildMember;
    const discordId = member.user.id;
    const username = member.user.username;

    try {
      if (action === 'view') {
        // Find or create user profile
        let user = await prisma.user.findUnique({
          where: { discordId },
        });

        if (!user) {
          // Create new user profile
          user = await prisma.user.create({
            data: {
              discordId,
              username,
            },
          });
        }

        const embed = new EmbedBuilder()
          .setTitle('👤 User Profile')
          .setColor('#0099ff')
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: 'Discord ID', value: user.discordId, inline: true },
            { name: 'Username', value: user.username, inline: true },
            { name: 'Profile Created', value: user.createdAt.toLocaleDateString(), inline: true },
            { name: 'Last Updated', value: user.updatedAt.toLocaleDateString(), inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } else if (action === 'update') {
        // Update or create user profile
        const user = await prisma.user.upsert({
          where: { discordId },
          update: {
            username,
            updatedAt: new Date(),
          },
          create: {
            discordId,
            username,
          },
        });

        const embed = new EmbedBuilder()
          .setTitle('✅ Profile Updated')
          .setColor('#00ff00')
          .setDescription(`Successfully updated profile for **${user.username}**`)
          .addFields(
            { name: 'Discord ID', value: user.discordId, inline: true },
            { name: 'Username', value: user.username, inline: true },
            { name: 'Last Updated', value: user.updatedAt.toLocaleDateString(), inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Database error:', error);
      await interaction.reply('❌ An error occurred while accessing the database.');
    }
  }
}
