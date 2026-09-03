import { Category } from '@discordx/utilities';
import type { CommandInteraction } from 'discord.js';
import { Discord, Slash } from 'discordx';

@Discord()
@Category('Utility')
export class Ping {
  @Slash({ description: "Ping the bot to check if it's online" })
  async ping(interaction: CommandInteraction): Promise<void> {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(`🏓 Pong! Latency is ${latency}ms.`);
  }
}
