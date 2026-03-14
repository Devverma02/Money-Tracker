import "@/lib/env/server";
import { serverEnv } from "@/lib/env/server";
import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
  var prismaGlobalUrl: string | undefined;
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: {
      db: {
        url: serverEnv.DATABASE_URL,
      },
    },
  });
}

const currentDatabaseUrl = serverEnv.DATABASE_URL;

if (
  globalThis.prismaGlobal &&
  globalThis.prismaGlobalUrl &&
  globalThis.prismaGlobalUrl !== currentDatabaseUrl
) {
  void globalThis.prismaGlobal.$disconnect();
  globalThis.prismaGlobal = undefined;
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
  globalThis.prismaGlobalUrl = currentDatabaseUrl;
}
