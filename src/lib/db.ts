import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
  var paperBriefAdapter: PrismaLibSql | undefined;
}

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter =
  global.paperBriefAdapter ??
  new PrismaLibSql({
    url: databaseUrl,
  });

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
  global.paperBriefAdapter = adapter;
}
