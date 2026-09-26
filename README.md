# 地蔵日誌 — Catatan Proses Jizo

Log latihan teater bergaya Strava, dengan tampilan minimalis ala Jepang — kertas washi, tinta sumi, dan satu stempel merah.

Siapa pun yang membuka link bisa mencatat latihannya hari ini: apa yang dilatih, berapa lama, catatan, dan foto. Semua masuk ke feed yang tertata rapi per pekan dan per bulan.

## Fitur

- **Catat hari ini** — nama/divisi, durasi dalam jam (terima `1,5`), judul, catatan, foto
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

## Teknologi

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite

## Struktur singkat

```
src/app/page.tsx        # satu halaman: form + feed + aksi bulan
src/app/api/logs/       # REST: GET/POST, PATCH/DELETE per entri
src/lib/panggung.ts     # grup bulan/pekan, format durasi, CSV, teks rekap
src/lib/summary-image.ts# poster PNG bulanan (canvas)
scripts/gen-*.mjs       # generator ikon & OG image
```

---

継続は力なり — konsistensi adalah kekuatan.
