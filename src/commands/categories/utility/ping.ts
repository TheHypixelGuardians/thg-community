import { Category } from '@discordx/utilities';
import type { CommandInteraction } from 'discord.js';
import { Discord, Slash } from 'discordx';

@Discord()
@Category('Utility')
export class Ping {
  @Slash({ description: "Ping the bot to check if it's online" })
  async ping(interaction: CommandInteraction): Promise<void> {
    const response = await interaction.reply({ content: 'Pinging...', withResponse: true });
    const sent = response.resource?.message?.createdTimestamp ?? Date.now();
    const latency = sent - interaction.createdTimestamp;

    await interaction.editReply(`🏓 Pong! Latency is ${latency}ms.`);
  }
}
