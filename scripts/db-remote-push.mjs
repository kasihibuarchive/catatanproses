// Push schema Prisma ke database Turso/libSQL remote.
// Pakai: DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." bun run db:remote-push
//
// Cara kerja: hasilkan DDL dari schema.prisma (prisma migrate diff --from-empty),
// lalu eksekusi ke database remote via @libsql/client. Idempotent untuk skenario
// pertama kali; untuk perubahan schema lanjutan, review dulu diff-nya.

import { createClient } from "@libsql/client";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url.startsWith("libsql://")) {
  console.error(
    "DATABASE_URL harus berupa URL Turso (libsql://...). " +
      "Untuk lokal, pakai: bun run db:push"
  );
  process.exit(1);
}

console.log("Menyiapkan DDL dari prisma/schema.prisma ...");

// Node-compatible: cari runner yang tersedia (bunx dulu, lalu npx).
function findRunner() {
  for (const cmd of ["bunx", "npx"]) {
    const probe = spawnSync(cmd, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return cmd;
  }
  return null;
}

const runner = findRunner();
if (!runner) {
  console.error("Tidak menemukan bunx/npx untuk menjalankan prisma CLI.");
  process.exit(1);
}

const proc = spawnSync(
  runner,
  [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8" }
);
const ddl =
  (proc.stdout ?? "")
    .replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS ")
    .replace(/CREATE UNIQUE INDEX /g, "CREATE UNIQUE INDEX IF NOT EXISTS ")
    .replace(/CREATE INDEX /g, "CREATE INDEX IF NOT EXISTS ");

if (proc.status !== 0 || !ddl.trim()) {
  console.error("Gagal membuat DDL:", proc.stderr.toString());
  process.exit(1);
}

console.log("Menghubungi", url.split("?")[0], "...");
const client = createClient({ url, authToken });

await client.executeMultiple(ddl);

const res = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
);
const tables = res.rows.map((r) => r.name).join(", ");
console.log("✅ Selesai. Tabel di database remote:", tables);
