import type { Client } from 'discord.js';
import { closePrismaConnection } from './prisma.js';

let shuttingDown = false;

/**
 * Registers the one SIGINT/SIGTERM path: destroy the Discord client, disconnect Prisma, then exit.
 * Nothing else may call `process.exit` on a signal, or the disconnect never runs.
 */
export function registerGracefulShutdown(client: Client): void {
  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down...`);
    try {
      await client.destroy();
    } catch (error) {
      console.error('Error destroying the client:', error);
    }
    try {
      await closePrismaConnection();
    } catch (error) {
      console.error('Error disconnecting Prisma:', error);
    }
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
