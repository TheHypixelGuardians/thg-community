import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/** Shared Prisma client — import this instead of constructing a new one. */
export const prisma = createPrismaClient();

/** Closes the shared Prisma client connection. */
export async function closePrismaConnection(): Promise<void> {
  await prisma.$disconnect();
}
