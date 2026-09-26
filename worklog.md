# Worklog — Log Latihan Teater "Panggung"

Aplikasi fullstack ala Strava untuk komunitas teater: siapa pun yang membuka link dapat mencatat latihan (nama, judul, tanggal, durasi, kategori, intensitas, mood, catatan, foto). Data tersimpan di SQLite lokal via Prisma, ditampilkan sebagai feed yang dikelompokkan per bulan & per pekan, dengan statistik (total sesi, total jam, streak, sesi bulan ini).

---
Task ID: 0
Agent: main (Z.ai Code)
Task: Analisis kebutuhan user, desain arsitektur, inisialisasi worklog.

Work Log:
- Membaca struktur project: Next.js 16 App Router, shadcn/ui lengkap, Prisma+SQLite (db/custom.db), sharp & zod & date-fns & sonner tersedia.
- Menyusun spesifikasi lengkap (skema DB, kontrak API, desain UI bertema teater gelap + aksen amber) untuk Task 1.

Stage Summary:
- Kontrak API yang disepakati untuk semua agent berikutnya:
  - GET  /api/logs  -> { logs: PracticeLog[] } urut date desc (runtime nodejs, force-dynamic)
  - POST /api/logs  -> multipart/form-data: actorName, title, date(YYYY-MM-DD), durationMin, category, intensity, mood, notes, image(File opsional, max 8MB, di-resize sharp max 1600px JPEG q80 -> public/uploads/{id}.jpg, imagePath=/uploads/{id}.jpg)
  - DELETE /api/logs/[id] -> hapus record + file gambarnya
- Skema PracticeLog: id, actorName, title, date, durationMin, category, intensity, mood, notes, imagePath, createdAt, updatedAt (@@index([date])).
- Desain: tema teater gelap (latar hitam hangat) dengan aksen amber/emas, tanpa indigo/biru; font display serif (Playfair) untuk judul; footer sticky.

---
Task ID: 1
Agent: full-stack-developer
Task: Membangun aplikasi "Panggung" end-to-end: database (Prisma/SQLite), API routes (/api/logs GET+POST, /api/logs/[id] DELETE), tema teater gelap, frontend lengkap (header, hero, stats, feed per bulan→pekan, footer) dan dialog "Catat Latihan" dengan upload foto.

Work Log:
- PART A — DB: menambahkan model PracticeLog ke prisma/schema.prisma (model User/Post & blok generator/datasource tetap), menjalankan `bun run db:push` (sukses, Prisma Client di-generate), membuat public/uploads/.gitkeep.
- PART B — API: membuat src/app/api/logs/route.ts (GET: semua log urut date desc→createdAt desc, force-dynamic, runtime nodejs; POST: multipart via req.formData(), validasi zod v4 — actorName 1..60, title 1..120, date regex YYYY-MM-DD + validitas kalender & parse LOCAL new Date(y,m-1,d), durationMin int 1..1440, kategori enum 8 nilai, intensity enum default "Sedang", mood max 8 default "🙂", notes max 2000 default ""; foto opsional: max 8MB + type image/*, sharp rotate()→resize 1600x1600 inside→jpeg q80, disimpan public/uploads/{randomUUID}.jpg, imagePath=/uploads/{id}.jpg; error 400/500 berbahasa Indonesia). Membuat src/app/api/logs/[id]/route.ts (DELETE: params Promise di-await, unlink file gambar best-effort dengan guard path /uploads/, 404 jika tidak ada).
- PART C — Tema: mengoverride :root globals.css ke palet teater gelap (background oklch(0.16 0.01 60), primary amber oklch(0.8 0.16 80), radius 0.75rem, chart & sidebar ikut di-warm-kan), menambah utilitas .custom-scroll (scrollbar tipis 8px thumb amber transparan); .dark blok dibiarkan; mapping --font-display ditambahkan di @theme inline. layout.tsx: menambah Playfair_Display (--font-playfair, 500–800), metadata "Panggung — Log Latihan Teater", lang="id", Toaster dari @/components/ui/sonner dengan richColors/position top-center/theme dark, suppressHydrationWarning tetap.
- PART D — Frontend: src/lib/panggung.ts (interface PracticeLog, konstanta 8 kategori dgn ikon lucide + kelas badge tanpa biru/indigo, INTENSITIES, MOODS, helper formatDuration "1,5 jam"/formatLogDuration "1 j 30 mnt", dateKey/parseDateKey anti timezone-shift, computeStreak, groupByMonthWeek → bulan (label "MMMM yyyy" locale id) → pekan (startOfWeek weekStartsOn:1, label "Pekan n · dd–dd MMM" / "dd MMM – dd MMM")). src/app/page.tsx ("use client"): fetch /api/logs + refresh(), skeleton 3 kartu saat loading, kartu error + "Coba Lagi", search & filter kategori, header sticky backdrop-blur dgn ikon Drama amber, hero dgn chip Tanpa login/Fotografis/Kolektif, spotlight radial amber di atas, StatsSection (Total Sesi/Total Latihan/Streak/Bulan Ini + kartu Aktivitas 7 Hari dgn bar chart bg-primary/bg-secondary, today ring), feed dikelompokkan bulan (header sticky top-16) → pekan (label + "X sesi · total Y mnt"), footer mt-auto + safe-area-inset. src/components/panggung/log-card.tsx: avatar inisial bg-primary, waktu relatif formatDistanceToNow locale id, dropdown Hapus → AlertDialog konfirmasi, badge kategori/durasi/intensitas + mood emoji, catatan line-clamp-4 + tombol Baca selengkapnya/Sembunyikan, foto → Dialog lightbox max-w-4xl.
- PART E — Form: src/components/panggung/log-form-dialog.tsx: Dialog sm:max-w-lg max-h-[85vh] custom-scroll; field Nama (prefill localStorage "panggung.actorName"), Judul, Tanggal (default/max hari ini), Durasi + toggle cepat 30/60/90/120/180, Kategori Select default "Akting", Intensitas 3 tombol (aktif bg-primary), Mood 5 tombol bulat (ring-2 ring-primary saat aktif), Catatan textarea, Foto: dropzone dashed → input file tersembunyi → downscale canvas (maks 1600px, JPEG 0.85) → preview + tombol X; validasi inline text-destructive, submit disabled jika wajib kosong, saat submit Loader2 "Menyimpan…", sukses → toast.success("Latihan tercatat! 🎭"), reset (nama disimpan kembali ke localStorage), refresh().
- Verifikasi: `bun run lint` → 0 error 0 warning; `tsc --noEmit` → 0 error di src/ (sisa error hanya di examples/ & skills/ yang tidak boleh disentuh). Uji browser headless (agent-browser): buka /, isi form, submit → toast muncul, dialog tertutup, stats ter-update (Total Latihan "1,5 jam"), feed menampilkan bulan "September 2026" → "Pekan 1 · 21–27 Sep" → kartu log; hapus via menu → AlertDialog → feed kembali kosong; tanpa error console.

Stage Summary:
- Hasil uji curl (semua lolos):
  - POST /api/logs multipart + foto (2400x1800 JPG) → HTTP 201 {"log":{...,"imagePath":"/uploads/08e8e533-….jpg"}}; sharp memproses ke 1600x1200 JPEG q80 (25.7KB → 11.5KB), file mendarat di public/uploads/.
  - POST tanpa foto → HTTP 201 dengan default intensity "Sedang", mood "🙂", notes "".
  - POST tidak valid → HTTP 400 {"error":"Nama aktor/kelompok wajib diisi."} / {"error":"Tanggal tidak valid."} (2026-02-31 ditolak) / {"error":"Kategori tidak valid."}.
  - GET /api/logs → HTTP 200 {"logs":[…]} urut date desc, createdAt desc.
  - DELETE /api/logs/{id} → HTTP 200 {"success":true} + file gambar ter-unlink dari public/uploads (terverifikasi); DELETE id palsu → HTTP 404 {"error":"Log tidak ditemukan."}.
- File dibuat/diubah: prisma/schema.prisma, src/app/api/logs/route.ts, src/app/api/logs/[id]/route.ts, src/app/globals.css, src/app/layout.tsx, src/app/page.tsx, src/lib/panggung.ts, src/components/panggung/log-card.tsx, src/components/panggung/log-form-dialog.tsx, src/components/panggung/stats-section.tsx, public/uploads/.gitkeep.
- DB bersih (data uji dihapus) — pengguna baru melihat empty state "Belum ada log latihan".
- Limitasi: tanggal disimpan midnight lokal server (aman untuk server & browser satu zona waktu; kontras TZ ekstrem bisa bergeser tampilan); foto disajikan via <img> statis dari /uploads (tidak ada CORS/optimasi Next Image); tidak ada auth sesuai spesifikasi ("Tanpa login").
