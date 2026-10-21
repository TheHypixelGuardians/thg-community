import type { ArgsOf } from 'discordx';
import { Discord, On } from 'discordx';
import { prisma } from '../utils/prisma.js';
import { getTicketType, logTicket } from '../utils/tickets.js';

@Discord()
export class ChannelDelete {
  /**
   * A ticket channel deleted by hand, rather than with Close, would leave its
   * ticket open forever, and its opener unable to open another of that type.
   * It is closed here instead, without a transcript, since the messages are gone.
   */
  @On()
  async channelDelete([channel]: ArgsOf<'channelDelete'>): Promise<void> {
    if (channel.isDMBased()) return;

    try {
      const ticket = await prisma.ticket.findUnique({ where: { channelId: channel.id } });
      if (ticket?.status !== 'open') return;

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'closed',
          channelId: null,
          closeReason: 'Channel deleted by hand',
          closedAt: new Date(),
        },
      });

      const type = getTicketType(ticket.type);
      await logTicket(channel.guild.id, {
        content:
          `🗑️ The channel of ticket **#${ticket.id}** (${type?.label ?? ticket.type}, opened by ` +
          `<@${ticket.openerId}>) was deleted by hand, so the ticket was closed without a transcript.`,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.error('Could not close the ticket of a deleted channel:', error);
    }
  }
}
