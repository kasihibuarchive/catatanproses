import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createDb(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";

  // Produksi (Vercel + Turso): URL libsql://... → driver adapter libSQL,
  // murni JS/WASM (tanpa binary engine native — aman untuk serverless).
  if (url.startsWith("libsql://")) {
    return new PrismaClient({
      adapter: new PrismaLibSQL({
        url,
        authToken: process.env.DATABASE_AUTH_TOKEN,
      }),
    });
  }

  // Lokal/dev: SQLite file biasa via engine klasik.
  return new PrismaClient({
    log: ["query"],
  });
}

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
