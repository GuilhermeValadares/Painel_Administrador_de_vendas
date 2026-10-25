import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Uma conexão só, reaproveitada entre recargas do `next dev`.
const global = globalThis as unknown as { prisma?: PrismaClient };

export const db = (global.prisma ??= new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
}));
