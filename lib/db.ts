import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

/**
 * Local dev: SQLite file from DATABASE_URL.
 * Vercel: set TURSO_DATABASE_URL (libsql://…) and TURSO_AUTH_TOKEN and Prisma talks to Turso through
 * the libSQL driver adapter. Serverless functions have no persistent disk, so SQLite files can't be used there.
 */
function create(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    const adapter = new PrismaLibSQL({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient();
}

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? create();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
