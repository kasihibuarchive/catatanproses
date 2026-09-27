import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * URL database:
 *  - DATABASE_URL di-set → dipakai apa adanya (libsql:// utk Turso, file: utk SQLite).
 *  - Di Vercel tanpa DATABASE_URL → demo mode: SQLite di /tmp (data sementara,
 *    filesystem serverless bersifat ephemeral), tetap langsung jalan tanpa setup.
 *  - Lokal tanpa DATABASE_URL → file:./db/custom.db (sama dgn .env.example).
 */
function resolveUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return process.env.VERCEL
    ? "file:/tmp/catatanproses.db"
    : "file:./db/custom.db";
}

const url = resolveUrl();
const isLibsql = url.startsWith("libsql://");

function createDb(): PrismaClient {
  // Produksi (Vercel + Turso): URL libsql://... → driver adapter libSQL,
  // murni JS/WASM (tanpa binary engine native — aman untuk serverless).
  if (isLibsql) {
    return new PrismaClient({
      adapter: new PrismaLibSQL({
        url,
        authToken: process.env.DATABASE_AUTH_TOKEN,
      }),
    });
  }

  // Lokal/dev (atau demo Vercel): SQLite file via engine klasik.
  return new PrismaClient({
    datasourceUrl: url,
    log: ["query"],
  });
}

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * DDL dari prisma/schema.prisma (hasil `prisma migrate diff --from-empty`),
 * diberi IF NOT EXISTS agar idempotent. Dipakai oleh ensureSchema() di bawah.
 */
const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE TABLE IF NOT EXISTS "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "PracticeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "durationMin" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "imagePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "PracticeLog_date_idx" ON "PracticeLog"("date")`,
];

let schemaReady: Promise<void> | null = null;

/**
 * Bootstrap skema otomatis, sekali per proses (cold start):
 *  - Turso/libSQL → eksekusi DDL via @libsql/client (deployment tanpa langkah manual;
 *    `bun run db:remote-push` tidak lagi wajib).
 *  - SQLite file → eksekusi per-statement via $executeRawUnsafe (mis. demo Vercel
 *    dengan file:/tmp/... yang selalu kosong saat cold start).
 * Gagal tidak dikunci selamanya — promise di-reset agar cold start berikutnya retry.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      if (isLibsql) {
        const client = createClient({
          url,
          authToken: process.env.DATABASE_AUTH_TOKEN,
        });
        await client.executeMultiple(DDL_STATEMENTS.join(";\n") + ";");
        return;
      }

      for (const statement of DDL_STATEMENTS) {
        try {
          await db.$executeRawUnsafe(statement);
        } catch (error) {
          console.warn("ensureSchema statement gagal (diabaikan):", error);
        }
      }
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}
