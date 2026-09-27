// Push schema Prisma ke database Turso/libSQL remote.
// Pakai: DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." bun run db:remote-push
//
// Cara kerja: hasilkan DDL dari schema.prisma (prisma migrate diff --from-empty),
// lalu eksekusi ke database remote via @libsql/client. Idempotent untuk skenario
// pertama kali; untuk perubahan schema lanjutan, review dulu diff-nya.

import { createClient } from "@libsql/client";

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
const proc = Bun.spawnSync([
  "bunx",
  "prisma",
  "migrate",
  "diff",
  "--from-empty",
  "--to-schema-datamodel",
  "prisma/schema.prisma",
  "--script",
]);
const ddl = proc.stdout.toString();

if (proc.exitCode !== 0 || !ddl.trim()) {
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
