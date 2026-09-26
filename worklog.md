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

---
Task ID: 2 (redesign) + 3 (verify/cleanup)
Agent: main (Z.ai Code)
Task: Redesign sesuai feedback user — "terlalu lengkap, bikin simpel dan minimalis, gausah milih kategori dsb, desainnya terlalu AI".

Work Log:
- Menyederhanakan skema PracticeLog: hapus kolom category, intensity, mood (db:push sukses).
- Menyederhanakan API POST /api/logs: hanya actorName, title, durationMin, notes, image opsional; tanggal otomatis "hari ini" (server-side, local midnight).
- Menulis ulang src/app/page.tsx jadi satu file minimal: form inline di atas halaman (bukan dialog), ringkasan "N sesi · X jam total", feed dikelompokkan bulan → pekan (dengan total per grup), kartu log simpel (nama, tanggal, durasi, judul, catatan, foto, tombol hapus dua-langkah tanpa modal).
- Tema baru di globals.css: terang minimalis (putih, garis netral tipis, tombol hitam) — mengganti tema gelap amber; menghapus font Playfair, hero image AI, stats cards, chart, search, filter kategori, dialog, badge, mood, streak.
- Menghapus file: src/components/panggung/{log-card,log-form-dialog,stats-section}.tsx, public/hero-stage.jpg.
- Masalah dev server: pkill + nohup biasa tidak bertahan (dibunuh saat sesi bash berakhir); solusi yang bekerja: double-fork `(setsid bun run dev >> dev.log 2>&1 < /dev/null &)`.
- Verifikasi agent-browser (desktop 1280 & mobile 390): form + upload foto → toast "Latihan tercatat.", feed grouping September/Agustus + pekan benar, hapus dua-langkah bekerja, localStorage prefill nama bekerja, lint 0 masalah, tidak ada console error.
- Membersihkan semua data tes & file public/uploads/*.jpg.

Stage Summary:
- Aplikasi sekarang minimalis: form 5 field + foto, feed per bulan/pekan. DB bersih, siap dipakai user.
- Kontrak API final: GET /api/logs, POST /api/logs (multipart: actorName, title, durationMin, notes, image), DELETE /api/logs/[id].
- Catatan penting untuk agent berikutnya: JANGAN menambah kembali kompleksitas (kategori, dialog, chart, tema gelap) — user secara eksplisit meminta simpel & minimalis; pertahankan estetika terang yang bersih.

---
Task ID: cron-review-1
Agent: main (Z.ai Code, webDevReview cron)
Task: QA rutin + pengembangan lanjutan (tetap memegang prinsip: simpel & minimalis sesuai eksplisit user).

Work Log:
- QA awal: server hidup (restart via double-fork setsid), GET /api/logs 200, halaman render tanpa error console; smoke test kirim form via UI → toast + masuk feed (FEED-OK).
- Fitur baru — EDIT ENTRI:
  - API: PATCH /api/logs/[id] (JSON body parsial: actorName, title, durationMin, notes; zod .partial(); 400 pesan Indonesia, 404 jika id tidak ada, 500 di-catch). Validasi teruji curl: durasi 0 → "Durasi minimal 1 menit.", id palsu → "Log tidak ditemukan.", patch valid → 200.
  - UI: tombol teks "ubah" di tiap kartu → kartu berubah jadi form inline (nama, durasi, judul, catatan) dengan border lebih tegas, tombol "batal"/"simpan" gaya teks-link konsisten minimalis; sukses → state feed terupdate langsung + toast "Perubahan tersimpan."; batal tidak mengubah apa pun.
- Detail styling halus (tetap minimalis):
  - Label tanggal relatif: "Hari ini"/"Kemarin" pada kartu (fallback "26 Sep").
  - Angka durasi & ringkasan pakai tabular-nums.
  - Kartu punya transisi hover border halus; mode edit diberi border lebih gelap agar jelas.
  - Header kanan kini menampilkan tanggal lengkap hari ini (locale id: "Jumat, 26 September") menggantikan teks statis "hari ini".
- Verifikasi agent-browser: edit (ubah durasi 60→75 → tampil "1 jam 15 mnt", catatan terganti), batal OK, PATCH validation OK, mobile 390px rapi, lint 0 masalah, tanpa console error setelah reload.
- Bersihkan data tes: DB kosong lagi, public/uploads bersih.

Stage Summary:
- API final: GET /api/logs · POST /api/logs (multipart) · PATCH /api/logs/[id] (JSON parsial) · DELETE /api/logs/[id].
- Fitur aktif: catat hari ini (form inline 5 field + foto), feed bulan→pekan dengan total, ubah entri inline, hapus dua-langkah, prefill nama via localStorage, downscale foto di browser, toast sonner.
- Prinsip desain terkunci (jangan dilanggar agent berikutnya): light theme putih, teks-link kecil lowercase ("ubah", "hapus"), tanpa kategori/mood/intensitas/dialog/chart/tema gelap.
- Ide kandidat ronde berikutnya: ekspor ringkasan teks per pekan, kunci penghapusan per-nama (cocokkan nama untuk bisa hapus/ubah), meta viewport theme-color, PWA manifest ringan.
