# 地蔵日誌 — Catatan Proses Jizo

Log latihan teater bergaya Strava, dengan tampilan minimalis ala Jepang — kertas washi, tinta sumi, dan satu stempel merah.

Siapa pun yang membuka link bisa mencatat latihannya hari ini: apa yang dilatih, berapa lama, catatan, dan foto. Semua masuk ke feed yang tertata rapi per pekan dan per bulan.

## Fitur

- **Catat hari ini** — nama/divisi, durasi dalam jam (terima `1,5`, boleh kosong), judul, catatan, foto
- **Templat story ala Strava** — 4 desain 9:16 (1080×1920) per entri, ilustrasi tangan:
  切手 perangko + cap pos, 地蔵 patung Jizō, 押入れ fusuma & noren, dan tategaki 父と暮らせば
- **Backdate** — catat ulang untuk kemarin atau hari lain
- **Pakai lagi** — ulang catatan terakhir sekali klik
- **Draf otomatis** — tulisan tersimpan lokal sampai berhasil terkirim
- **Feed per pekan & bulan** — re-sort instan tanpa reload
- **Bagikan** — salin teks rekap, unduh poster PNG dan CSV per bulan, link WhatsApp
- **Ubah & hapus** — edit inline, hapus dua-langkah
- **Offline-aware** — indikator offline + halaman fallback ala washi
- **PWA** — bisa dipasang, stempel 地蔵 sebagai ikon

## Menjalankan

```bash
bun install
cp .env.example .env
bunx prisma db push
bun run dev
```

Buka `http://localhost:3000`.

## Deploy ke Vercel

Next.js 16 → deploy paling mulus di Vercel (pembuat Next.js sendiri).

**Cara tercepat (mode demo, tanpa setup):**

1. Buka [vercel.com/new](https://vercel.com/new) → login pakai GitHub → import repo `catatanproses`.
2. Klik **Deploy** — selesai. Tanpa env apa pun, app langsung jalan
   (SQLite otomatis di `/tmp`, tabel dibuat otomatis).
3. Catatan: mode demo — data & foto hilang saat server reset.

**Data permanen (disarankan untuk dipakai sungguhan):**

1. **Database** — buat database gratis di [app.turso.tech](https://app.turso.tech)
   (login GitHub) → salin `DATABASE_URL` (`libsql://…`) dan buat token
   (`DATABASE_AUTH_TOKEN`) → isi keduanya di Vercel: Project → Settings →
   Environment Variables. Tabel dibuat otomatis saat request pertama.
2. **Foto** — di Vercel: **Storage → Create Database → Blob** → connect ke project
   (`BLOB_READ_WRITE_TOKEN` terisi otomatis).
3. Push/redeploy — app jalan dengan data permanen.

## Teknologi

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite

## Struktur singkat

```
src/app/page.tsx        # satu halaman: form + feed + aksi bulan
src/app/api/logs/       # REST: GET/POST, PATCH/DELETE per entri
src/lib/panggung.ts     # grup bulan/pekan, format durasi, CSV, teks rekap
src/lib/story-templates.ts # templat story 9:16 (canvas, gaya cetak tangan)
src/lib/summary-image.ts# poster PNG bulanan (canvas)
scripts/gen-*.mjs       # generator ikon & OG image
```

---

継続は力なり — konsistensi adalah kekuatan.
