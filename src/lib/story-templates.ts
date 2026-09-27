import {
  dateKey,
  WEEKDAY_KANJI,
  warekiDate,
  type PracticeLog,
} from "./panggung";

/**
 * Story templates (1080×1920, 9:16) — ala Strava story share, tapi washi:
 * ILUSTRASI = main objek, mengisi kanvas penuh (perangko 切手 raksasa, patung
 * 地蔵 besar, lemari 押入れ, tategaki 父と暮らせば). Data entri hadir sebagai
 * OVERLAY semi-transparan di bawah — duduk DI ATAS gambar, bukan blok terpisah.
 * Semua ilustrasi digambar manual di canvas (gaya sumi hand-drawn, sedikit
 * getar acak supaya terasa cetak tangan — tiap render unik seperti kayu blok).
 * Client-only: dijalankan setelah klik, tidak pernah saat SSR.
 */

const W = 1080;
const H = 1920;

/* ---------- palette & fonts ---------- */

interface Palette {
  bg: string;
  ink: string;
  muted: string;
  seal: string;
  hairline: string;
  paper: string; // kertas perangko
  paperDark: string; // fusuma
  closetDark: string; // interior lemari
  mincho: string;
  gothic: string;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.body).getPropertyValue(name).trim();
  return raw || fallback;
}

async function ensureFonts(mincho: string, gothic: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(
        `400 170px ${mincho}`,
        "地蔵日誌父と暮らせば押入切手稽古の一日郵便参昭和年月日水金火継続は力なり井上ひさし作"
      ),
      document.fonts.load(`700 40px ${gothic}`, "September 2026 0123456789"),
      document.fonts.load(`400 26px ${gothic}`, "sesi orang jam •—·()"),
      document.fonts.load(`500 20px ${gothic}`, "CATATAN PROSES JIZO JIZO POST"),
    ]);
    await document.fonts.ready;
  } catch {
    // Gambar dengan font yang tersedia.
  }
}

type SpacingCtx = CanvasRenderingContext2D & { letterSpacing?: string };

function sp(ctx: CanvasRenderingContext2D, px: string): void {
  if ("letterSpacing" in ctx) (ctx as SpacingCtx).letterSpacing = px;
}

/* ---------- registry & data ---------- */

export interface StoryTemplateMeta {
  id: "kitte" | "jizo" | "oshiire" | "chichi";
  name: string;
  kanji: string;
  hint: string;
}

export const STORY_TEMPLATES: StoryTemplateMeta[] = [
  { id: "kitte", name: "Perangko", kanji: "切手", hint: "perangko 稽古 raksasa + cap pos Jizo" },
  { id: "jizo", name: "Patung Jizō", kanji: "地蔵", hint: "patung Jizō raksasa, sketsa sumi" },
  { id: "oshiire", name: "Oshiire", kanji: "押入", hint: "noren & lemari panggung terbuka" },
  { id: "chichi", name: "Chichi to Kuraseba", kanji: "父", hint: "父と暮らせば tategaki 昭和23年" },
];

export interface StoryData {
  actorName: string;
  title: string;
  dayKey: string; // "YYYY-MM-DD"
  notes: string;
}

export function storyDataFromLog(log: PracticeLog): StoryData {
  return {
    actorName: log.actorName,
    title: log.title,
    dayKey: dateKey(log.date),
    notes: log.notes.trim(),
  };
}

/** Contoh data untuk thumbnail pemilih templat (stabil & cepat). */
export function storySampleData(): StoryData {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    actorName: "Bana — divisi sound",
    title: "Latihan orkestrasi adegan 2",
    dayKey: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    notes: "SFX hujan masuk terlalu pagi; tarik tempo sebelum dialog penutup.",
  };
}

/* ---------- teks & goresan tangan ---------- */

/** Bungkus teks; kata panjang/CJK dipecah per karakter. Maks maxLines baris + elipsis. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur) {
      lines.push(cur);
      cur = "";
    }
  };
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxW) {
      cur = candidate;
      continue;
    }
    flush();
    if (ctx.measureText(word).width <= maxW) {
      cur = word;
      continue;
    }
    for (const ch of word) {
      const next = cur + ch;
      if (ctx.measureText(next).width > maxW && cur) {
        flush();
        cur = ch;
      } else {
        cur = next;
      }
    }
  }
  flush();
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function wrapKeep(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  return wrapText(ctx, text, maxW, 1);
}

type Pt = [number, number];

/** Polyline "hand-drawn": kuadratik mulus + getar acak kecil (goresan kuas). */
function wobblePath(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  jitter = 2.5,
  close = false
): void {
  const j = () => (Math.random() - 0.5) * jitter * 2;
  const p = pts.map(([x, y]) => [x + j(), y + j()] as Pt);
  ctx.beginPath();
  if (close) {
    const n = p.length;
    ctx.moveTo((p[0][0] + p[n - 1][0]) / 2, (p[0][1] + p[n - 1][1]) / 2);
    for (let i = 0; i < n; i++) {
      const c = p[i];
      const nx = p[(i + 1) % n];
      ctx.quadraticCurveTo(c[0], c[1], (c[0] + nx[0]) / 2, (c[1] + nx[1]) / 2);
    }
    ctx.closePath();
  } else {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) {
      const nx = p[i + 1];
      ctx.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + nx[0]) / 2, (p[i][1] + nx[1]) / 2);
    }
    const last = p[p.length - 1];
    ctx.lineTo(last[0], last[1]);
  }
}

/** Lingkaran wobbly (kepala, halo, cap pos). */
function wobbleCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  jitter = 2
): void {
  const pts: Pt[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  wobblePath(ctx, pts, jitter, true);
}

interface StrokeOpts {
  w?: number;
  color?: string;
  alpha?: number;
  fill?: string;
}

/** Goresan tinta: wajib round cap; opsional isi. */
function inkStroke(
  ctx: CanvasRenderingContext2D,
  paint: () => void,
  C: Palette,
  o: StrokeOpts = {}
): void {
  ctx.save();
  ctx.strokeStyle = o.color ?? C.ink;
  ctx.lineWidth = o.w ?? 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = o.alpha ?? 0.9;
  paint(); // bangun path-nya BARU setelah gaya di-set
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

/** Burung camar jauh (dua lengkung kecil, gaya ukiyo-e). */
function drawBird(ctx: CanvasRenderingContext2D, C: Palette, x: number, y: number, s: number): void {
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.quadraticCurveTo(x - s / 2, y - s * 0.9, x, y);
      ctx.quadraticCurveTo(x + s / 2, y - s * 0.9, x + s, y);
    },
    C,
    { w: 3.5, alpha: 0.65 }
  );
}

/** Rumpun rumput ala Hiroshige. */
function drawGrass(ctx: CanvasRenderingContext2D, C: Palette, x: number, y: number, s: number): void {
  for (const [dx, lean] of [[-s * 0.5, -0.6], [0, 0], [s * 0.5, 0.6]] as [number, number][]) {
    inkStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y);
        ctx.quadraticCurveTo(x + dx + lean * s, y - s * 0.8, x + dx + lean * s * 1.6, y - s * 1.3);
      },
      C,
      { w: 3.5, alpha: 0.7 }
    );
  }
}

/** Awan bergaris ala Hiroshige (3 goresan panjang melengkung). */
function drawClouds(ctx: CanvasRenderingContext2D, C: Palette, y0: number): void {
  for (const [dy, x1, x2] of [[0, 110, 640], [56, 320, 980], [112, 160, 780]] as [number, number, number][]) {
    inkStroke(
      ctx,
      () => wobblePath(ctx, [[x1, y0 + dy], [x1 + (x2 - x1) * 0.4, y0 + dy - 7], [x2, y0 + dy + 3]], 3),
      C,
      { w: 3, color: C.muted, alpha: 0.38 }
    );
  }
}

/** Matahari pucat (piringan vermillion transparan + lingkar tipis). */
function drawPaleSun(ctx: CanvasRenderingContext2D, C: Palette, x: number, y: number, r: number): void {
  ctx.save();
  ctx.fillStyle = C.seal;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = C.seal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function paintWashi(ctx: CanvasRenderingContext2D, C: Palette): void {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 1300; i++) {
    ctx.fillStyle = `rgba(70, 58, 34, ${(0.015 + Math.random() * 0.02).toFixed(3)})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
  }
}

function drawHanko(
  ctx: CanvasRenderingContext2D,
  C: Palette,
  x: number,
  y: number,
  size: number,
  chars: string[]
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.05);
  ctx.fillStyle = C.seal;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(-size / 2, -size / 2, size, size, size * 0.09);
  } else {
    ctx.rect(-size / 2, -size / 2, size, size);
  }
  ctx.fill();
  ctx.strokeStyle = "rgba(246, 242, 231, 0.4)";
  ctx.lineWidth = 1.5;
  const inset = size * 0.09;
  ctx.strokeRect(-size / 2 + inset, -size / 2 + inset, size - inset * 2, size - inset * 2);
  ctx.fillStyle = C.bg;
  ctx.font = `400 ${Math.round(size * 0.34)}px ${C.mincho}`;
  ctx.textAlign = "center";
  const n = chars.length;
  chars.forEach((ch, i) => {
    const offset = n === 1 ? size * 0.12 : (i - (n - 1) / 2) * size * 0.38 + size * 0.12;
    ctx.fillText(ch, 0, offset);
  });
  ctx.restore();
  ctx.textAlign = "left";
}

/* ---------- OVERLAY ala Strava (duduk di atas gambar) ---------- */

/**
 * Panel data semi-transparan di sepertiga bawah — mengenai gambar di
 * baliknya. Semua templat memakai panel yang sama (konsisten seperti
 * overlay Strava), jadi pembeda antar templat murni ilustrasinya.
 */
function drawOverlay(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  const PX = 48;
  const PY = 1382;
  const PW = 984;
  const PH = 452;
  const ix = PX + 44; // indent teks
  const iw = PW - 88; // lebar teks
  const nameMaxW = iw - 104; // sisakan ruang hanko kanan

  // panel wash + bingkai rambut
  ctx.fillStyle = "rgba(249, 245, 233, 0.92)";
  ctx.fillRect(PX, PY, PW, PH);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(PX + 0.5, PY + 0.5, PW - 1, PH - 1);
  ctx.globalAlpha = 1;

  // garis ganda tebal-tipis vermillion di atas panel
  ctx.fillStyle = C.seal;
  ctx.fillRect(PX, PY, PW, 4);
  ctx.globalAlpha = 0.45;
  ctx.fillRect(PX, PY + 8, PW, 1.5);
  ctx.globalAlpha = 1;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // nama
  ctx.fillStyle = C.ink;
  ctx.font = `700 38px ${C.gothic}`;
  ctx.fillText(wrapKeep(ctx, d.actorName, nameMaxW)[0] ?? "", ix, PY + 94);

  // hanko mini kanan-atas
  drawHanko(ctx, C, PX + PW - 80, PY + 90, 66, ["地", "蔵"]);

  // meta: weekday kanji + tanggal
  const weekday = WEEKDAY_KANJI[new Date(`${d.dayKey}T00:00:00`).getDay()];
  const shortDate = new Date(`${d.dayKey}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  ctx.font = `400 27px ${C.mincho}`;
  ctx.fillStyle = C.seal;
  ctx.fillText(weekday, ix, PY + 140);
  const wW = ctx.measureText(weekday).width;
  ctx.fillStyle = C.muted;
  ctx.font = `400 23px ${C.gothic}`;
  ctx.fillText(` · ${shortDate}`, ix + wW + 8, PY + 138);

  // judul (what was practised) — mincho besar, maks 2 baris
  ctx.fillStyle = C.ink;
  ctx.font = `400 50px ${C.mincho}`;
  const titleLines = wrapText(ctx, d.title, iw, 2);
  const titleBase = PY + 212;
  titleLines.forEach((line, i) => ctx.fillText(line, ix, titleBase + i * 62));

  // catatan — maks 2 baris
  if (d.notes) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 25px ${C.gothic}`;
    const notesY = titleBase + titleLines.length * 62 + 16;
    wrapText(ctx, d.notes, iw, 2).forEach((line, i) =>
      ctx.fillText(line, ix, notesY + i * 38)
    );
  }

  // baris bawah panel: pepatah kiri, merek kanan
  const bottomY = PY + PH - 34;
  ctx.fillStyle = C.ink;
  ctx.globalAlpha = 0.55;
  ctx.font = `400 22px ${C.mincho}`;
  sp(ctx, "4px");
  ctx.fillText("継続は力なり", ix, bottomY);
  sp(ctx, "0px");
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.muted;
  ctx.font = `500 14px ${C.gothic}`;
  sp(ctx, "6px");
  ctx.textAlign = "right";
  ctx.fillText("CATATAN PROSES JIZO", PX + PW - 44, bottomY);
  ctx.textAlign = "left";
  sp(ctx, "0px");
}

/* ---------- patung Jizo (sketsa sumi, bisa diskalakan) ---------- */

function drawJizoStatue(ctx: CanvasRenderingContext2D, C: Palette, cx: number, groundY: number, s: number): void {
  // halo ganda
  inkStroke(ctx, () => wobbleCircle(ctx, cx, groundY - 640 * s, 175 * s, 2), C, { w: 3, alpha: 0.45 });
  inkStroke(ctx, () => wobbleCircle(ctx, cx, groundY - 640 * s, 158 * s, 2), C, { w: 2, alpha: 0.3 });

  // kepala
  inkStroke(ctx, () => wobbleCircle(ctx, cx, groundY - 590 * s, 96 * s, 3), C, { w: 6, fill: C.bg });

  // wajah: mata bahagia tertutup + senyum + rona pipi
  const ey = groundY - 608 * s;
  for (const ex of [cx - 36 * s, cx + 36 * s]) {
    inkStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(ex, ey, 14 * s, Math.PI, 0, true);
      },
      C,
      { w: 5 }
    );
  }
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.arc(cx, groundY - 570 * s, 22 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    },
    C,
    { w: 5 }
  );
  ctx.save();
  ctx.fillStyle = C.seal;
  ctx.globalAlpha = 0.22;
  for (const bx of [cx - 62 * s, cx + 62 * s]) {
    ctx.beginPath();
    ctx.arc(bx, groundY - 566 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // jubah (trapesium bulat)
  inkStroke(
    ctx,
    () =>
      wobblePath(
        ctx,
        [
          [cx - 95 * s, groundY - 520 * s],
          [cx + 95 * s, groundY - 520 * s],
          [cx + 140 * s, groundY - 60 * s],
          [cx - 140 * s, groundY - 60 * s],
        ],
        4,
        true
      ),
    C,
    { w: 7, fill: C.paper }
  );
  // bukaan jubah tengah + kerah V
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx, groundY - 470 * s);
      ctx.lineTo(cx, groundY - 70 * s);
    },
    C,
    { w: 4, alpha: 0.45 }
  );
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(cx - 38 * s, groundY - 520 * s);
      ctx.lineTo(cx, groundY - 452 * s);
      ctx.lineTo(cx + 38 * s, groundY - 520 * s);
    },
    C,
    { w: 6 }
  );

  // tangan gassho: dua lingkaran kecil bertumpuk
  inkStroke(ctx, () => wobbleCircle(ctx, cx - 26 * s, groundY - 400 * s, 32 * s, 2), C, { w: 6, fill: C.bg });
  inkStroke(ctx, () => wobbleCircle(ctx, cx + 26 * s, groundY - 400 * s, 32 * s, 2), C, { w: 6, fill: C.bg });

  // slayer (yodarekake) dengan pola wajik vermillion
  inkStroke(
    ctx,
    () =>
      wobblePath(
        ctx,
        [
          [cx - 70 * s, groundY - 545 * s],
          [cx + 70 * s, groundY - 545 * s],
          [cx + 88 * s, groundY - 445 * s],
          [cx - 88 * s, groundY - 445 * s],
        ],
        3,
        true
      ),
    C,
    { w: 5, color: C.seal, alpha: 0.8 }
  );
  ctx.save();
  ctx.fillStyle = C.seal;
  ctx.globalAlpha = 0.75;
  for (const dx of [-46 * s, 0, 46 * s]) {
    ctx.save();
    ctx.translate(cx + dx, groundY - 474 * s);
    ctx.rotate(Math.PI / 4);
    const ds = 9 * s;
    ctx.fillRect(-ds, -ds, ds * 2, ds * 2);
    ctx.restore();
  }
  ctx.restore();

  // alas batu dua tingkat
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(cx, groundY - 34 * s, 172 * s, 30 * s, 0, 0, Math.PI * 2);
    },
    C,
    { w: 6, fill: C.paperDark }
  );
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.ellipse(cx, groundY - 4 * s, 215 * s, 34 * s, 0, 0, Math.PI * 2);
    },
    C,
    { w: 6, fill: C.paperDark }
  );
}

/** Patung Jizo versi duduk kecil (dalam oshiire / di atas rak). */
function drawJizoMini(ctx: CanvasRenderingContext2D, C: Palette, cx: number, baseY: number, s: number): void {
  inkStroke(ctx, () => wobbleCircle(ctx, cx, baseY - 120 * s, 34 * s, 1.5), C, { w: 4, fill: C.bg });
  for (const ex of [cx - 12 * s, cx + 12 * s]) {
    inkStroke(
      ctx,
      () => {
        ctx.beginPath();
        ctx.arc(ex, baseY - 126 * s, 5 * s, Math.PI, 0, true);
      },
      C,
      { w: 2.5 }
    );
  }
  inkStroke(
    ctx,
    () =>
      wobblePath(
        ctx,
        [
          [cx - 34 * s, baseY - 88 * s],
          [cx + 34 * s, baseY - 88 * s],
          [cx + 46 * s, baseY],
          [cx - 46 * s, baseY],
        ],
        2,
        true
      ),
    C,
    { w: 4, fill: C.paper }
  );
  inkStroke(
    ctx,
    () =>
      wobblePath(
        ctx,
        [
          [cx - 26 * s, baseY - 92 * s],
          [cx + 26 * s, baseY - 92 * s],
          [cx + 34 * s, baseY - 52 * s],
          [cx - 34 * s, baseY - 52 * s],
        ],
        1.5,
        true
      ),
    C,
    { w: 3, color: C.seal, alpha: 0.8 }
  );
}

/* ---------- TEMPLAT 1: 切手 — perangko raksasa sebagai main objek ---------- */

function paintKitte(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  const SX = 120;
  const SY = 205;
  const SW = 840;
  const SH = 1005;

  // kertas perangko
  ctx.fillStyle = C.paper;
  ctx.fillRect(SX, SY, SW, SH);

  // lubang perforasi: pukul lingkaran warna latar di keliling
  ctx.fillStyle = C.bg;
  const holeR = 15;
  const step = 42;
  for (let x = SX + step / 2; x < SX + SW; x += step) {
    ctx.beginPath();
    ctx.arc(x, SY, holeR, 0, Math.PI * 2);
    ctx.arc(x, SY + SH, holeR, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let y = SY + step / 2; y < SY + SH; y += step) {
    ctx.beginPath();
    ctx.arc(SX, y, holeR, 0, Math.PI * 2);
    ctx.arc(SX + SW, y, holeR, 0, Math.PI * 2);
    ctx.fill();
  }

  // bayangan cetak tipis di bawah perangko (felem offset)
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = C.ink;
  ctx.fillRect(SX + 10, SY + SH + 6, SW, 8);
  ctx.restore();

  // bingkai ganda dalam
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.75;
  ctx.strokeRect(SX + 30, SY + 30, SW - 60, SH - 60);
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.strokeRect(SX + 44, SY + 44, SW - 88, SH - 88);
  ctx.globalAlpha = 1;

  // kop dalam perangko
  ctx.fillStyle = C.ink;
  ctx.font = `400 27px ${C.mincho}`;
  sp(ctx, "6px");
  ctx.fillText("地蔵郵便", SX + 72, SY + 90);
  sp(ctx, "0px");
  ctx.fillStyle = C.muted;
  ctx.font = `500 14px ${C.gothic}`;
  sp(ctx, "5px");
  ctx.textAlign = "right";
  ctx.fillText("JIZO POST", SX + SW - 72, SY + 86);
  ctx.textAlign = "left";
  sp(ctx, "0px");

  // nominal: kanji hari dalam medali vermillion (nilai perangko)
  const weekday = WEEKDAY_KANJI[new Date(`${d.dayKey}T00:00:00`).getDay()];
  const mx = SX + 128;
  const my = SY + 226;
  ctx.fillStyle = C.seal;
  ctx.beginPath();
  ctx.arc(mx, my, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.paper;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(mx, my, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.paper;
  ctx.font = `400 52px ${C.mincho}`;
  ctx.textAlign = "center";
  ctx.fillText(weekday, mx, my + 19);
  ctx.textAlign = "left";

  // ILUSTRASI UTAMA: patung Jizo berdiri di lapangan, di dalam perangko
  const s = 0.6;
  const gcx = SX + SW / 2;
  const groundY = SY + SH - 140;
  drawJizoStatue(ctx, C, gcx, groundY, s);
  drawGrass(ctx, C, gcx - 200, groundY - 2, 30);
  drawGrass(ctx, C, gcx + 205, groundY + 4, 26);
  drawGrass(ctx, C, SX + 92, groundY + 6, 22);
  drawBird(ctx, C, SX + SW - 150, SY + 210, 20);

  // tanggal + 参 (hadir) di dalam perangko
  ctx.fillStyle = C.muted;
  ctx.font = `400 23px ${C.mincho}`;
  ctx.fillText(warekiDate(d.dayKey), SX + 72, SY + SH - 70);
  ctx.fillStyle = C.seal;
  ctx.globalAlpha = 0.85;
  ctx.font = `400 44px ${C.mincho}`;
  ctx.textAlign = "right";
  ctx.fillText("参", SX + SW - 72, SY + SH - 66);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;

  // ---- cap pos menimpa sisi kanan perangko ----
  ctx.save();
  ctx.translate(SX + SW - 30, SY + 280);
  ctx.rotate(-0.18);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = C.seal;
  ctx.fillStyle = C.seal;
  ctx.lineCap = "round";
  // bilah pembunuh (killer bars)
  ctx.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(-350, -48 + i * 16);
    ctx.lineTo(-150, -48 + i * 16);
    ctx.stroke();
  }
  // lingkaran ganda
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 112, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 95, 0, Math.PI * 2);
  ctx.stroke();
  // isi cap
  ctx.textAlign = "center";
  ctx.font = `500 22px ${C.gothic}`;
  sp(ctx, "4px");
  ctx.fillText("JIZO", 0, -32);
  sp(ctx, "0px");
  const [y, m, day] = d.dayKey.split("-");
  ctx.font = `400 29px ${C.gothic}`;
  ctx.fillText(`${Number(y)}.${Number(m)}.${Number(day)}`, 0, 6);
  ctx.font = `400 19px ${C.mincho}`;
  ctx.fillText("地蔵日誌", 0, 42);
  ctx.textAlign = "left";
  ctx.restore();

  // sempit antara perangko & overlay: tanda update
  ctx.fillStyle = C.muted;
  ctx.globalAlpha = 0.6;
  ctx.font = `400 23px ${C.mincho}`;
  sp(ctx, "10px");
  ctx.textAlign = "center";
  ctx.fillText("稽古切手 · 一筆参上", W / 2, 1306);
  ctx.textAlign = "left";
  sp(ctx, "0px");
  ctx.globalAlpha = 1;
}

/* ---------- TEMPLAT 2: 地蔵 — patung raksasa sebagai main objek ---------- */

function paintJizo(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  // langit
  drawPaleSun(ctx, C, 205, 285, 105);
  drawClouds(ctx, C, 470);
  drawBird(ctx, C, 790, 300, 26);
  drawBird(ctx, C, 862, 258, 19);

  // tanah + gema garis
  inkStroke(
    ctx,
    () => wobblePath(ctx, [[90, 1268], [420, 1262], [760, 1270], [990, 1264]], 3),
    C,
    { w: 7, alpha: 0.85 }
  );
  inkStroke(
    ctx,
    () => wobblePath(ctx, [[170, 1316], [560, 1310], [920, 1318]], 3),
    C,
    { w: 3, alpha: 0.3 }
  );
  drawGrass(ctx, C, 205, 1262, 34);
  drawGrass(ctx, C, 862, 1272, 30);
  drawGrass(ctx, C, 130, 1308, 24);
  drawGrass(ctx, C, 935, 1316, 22);

  // MAIN OBJEK: patung Jizō raksasa
  drawJizoStatue(ctx, C, 540, 1250, 1.42);

  // aksen tategaki di tepi kanan
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.globalAlpha = 0.12;
  ctx.font = `400 44px ${C.mincho}`;
  ctx.textAlign = "center";
  "地蔵日誌".split("").forEach((ch, i) => ctx.fillText(ch, 1012, 430 + i * 66));
  ctx.restore();
  ctx.textAlign = "left";
}

/* ---------- TEMPLAT 3: 押入れ — noren & lemari full-bleed ---------- */

function paintOshiire(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  // batang noren
  inkStroke(ctx, () => wobblePath(ctx, [[96, 148], [984, 144]], 2), C, { w: 9 });

  // noren 稽古の一日 — memenuhi lebar kanvas
  const panels = ["稽", "古", "の", "一", "日"];
  const nx = 96;
  const nw = 178;
  panels.forEach((ch, i) => {
    const px = nx + i * (nw + 4);
    const bottom = 486 + (i % 2 === 0 ? 0 : 12) + Math.random() * 5;
    ctx.fillStyle = C.closetDark;
    ctx.globalAlpha = 0.94;
    ctx.fillRect(px, 158, nw, bottom - 158);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg;
    ctx.font = `400 66px ${C.mincho}`;
    ctx.textAlign = "center";
    ctx.fillText(ch, px + nw / 2, 372 + (i % 2 === 0 ? 0 : 8));
    ctx.textAlign = "left";
  });

  // bingkai lemari besar
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 14;
  ctx.globalAlpha = 0.92;
  ctx.strokeRect(110, 520, 860, 780);
  ctx.globalAlpha = 1;

  // pintu kiri tertutup (fusuma) + pola wajik
  ctx.fillStyle = C.paperDark;
  ctx.fillRect(124, 534, 410, 752);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(124, 534, 410, 752);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.fillStyle = C.seal;
  ctx.globalAlpha = 0.4;
  for (const [rx, ry] of [[230, 700], [330, 700], [280, 830], [230, 960], [330, 960]] as [number, number][]) {
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-16, -16, 32, 32);
    ctx.restore();
  }
  ctx.restore();
  // hikite (pegangan) vermillion
  ctx.fillStyle = C.seal;
  ctx.beginPath();
  ctx.arc(502, 908, 16, 0, Math.PI * 2);
  ctx.fill();

  // interior terbuka (kanan)
  ctx.fillStyle = C.closetDark;
  ctx.fillRect(548, 534, 408, 752);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = C.ink;
  ctx.fillRect(548, 534, 14, 752);
  ctx.restore();

  // sinar lembut dari bukaan
  ctx.save();
  ctx.strokeStyle = C.seal;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(570, 580);
  ctx.lineTo(300, 1300);
  ctx.stroke();
  ctx.lineWidth = 42;
  ctx.beginPath();
  ctx.moveTo(720, 620);
  ctx.lineTo(480, 1300);
  ctx.stroke();
  ctx.restore();

  // rak + tumpukan naskah
  inkStroke(ctx, () => wobblePath(ctx, [[560, 1102], [944, 1098]], 2), C, { w: 5, color: C.bg, alpha: 0.8 });
  const scripts: [number, number, number][] = [
    [606, 950, -0.07],
    [652, 944, 0.05],
    [628, 958, -0.02],
  ];
  for (const [sx, sy, rot] of scripts) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.fillStyle = "#fbf7ea";
    ctx.fillRect(0, 0, 116, 126);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.35;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(14, 18 * i + 6);
      ctx.lineTo(102, 18 * i + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // gulungan tategu 掛け軸
  ctx.fillStyle = C.paper;
  ctx.fillRect(762, 566, 116, 330);
  ctx.fillStyle = "#6b5a3f";
  ctx.fillRect(754, 554, 132, 14);
  ctx.fillRect(754, 886, 132, 14);
  ctx.fillStyle = C.ink;
  ctx.font = `400 54px ${C.mincho}`;
  ctx.textAlign = "center";
  "稽古".split("").forEach((ch, i) => ctx.fillText(ch, 820, 656 + i * 80));
  ctx.textAlign = "left";

  // jizo mini duduk di rak
  drawJizoMini(ctx, C, 882, 1094, 0.9);

  // lantai: garis tatami
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 1330);
  ctx.lineTo(1000, 1326);
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(120, 1356);
  ctx.lineTo(960, 1352);
  ctx.stroke();
  ctx.restore();
}

/* ---------- TEMPLAT 4: 父と暮らせば — tategaki poster 昭和23年 ---------- */

function paintChichi(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  // matahari pucat + awan + burung
  drawPaleSun(ctx, C, 218, 330, 115);
  drawClouds(ctx, C, 520);
  drawBird(ctx, C, 430, 288, 24);

  // MAIN OBJEK: tategaki besar 父と暮らせば
  ctx.fillStyle = C.ink;
  ctx.font = `400 150px ${C.mincho}`;
  ctx.textAlign = "center";
  "父と暮らせば".split("").forEach((ch, i) => ctx.fillText(ch, 806, 300 + i * 186));
  // kana kecil di kolom samping
  ctx.fillStyle = C.muted;
  ctx.font = `400 30px ${C.mincho}`;
  "ちちとくらせば".split("").forEach((ch, i) => ctx.fillText(ch, 652, 288 + i * 55));
  ctx.textAlign = "left";

  // kredit drama + latar era
  ctx.fillStyle = C.muted;
  ctx.font = `400 28px ${C.mincho}`;
  ctx.fillText("井上ひさし 作", 116, 640);
  ctx.font = `400 25px ${C.mincho}`;
  ctx.globalAlpha = 0.85;
  ctx.fillText("昭和二十三年 · 1948", 116, 684);
  ctx.globalAlpha = 1;

  // lanskap yakeato (bekas terbakar) di bawah: tiang telepon & kabel
  const poles: [number, number][] = [[172, 1130], [500, 1118], [828, 1130]];
  for (const [px, py] of poles) {
    inkStroke(ctx, () => wobblePath(ctx, [[px, py], [px, 1368]], 2), C, { w: 7, alpha: 0.8 });
    inkStroke(ctx, () => wobblePath(ctx, [[px - 52, py + 26], [px + 52, py + 24]], 1.5), C, { w: 5, alpha: 0.8 });
    inkStroke(ctx, () => wobblePath(ctx, [[px - 44, py + 58], [px + 44, py + 56]], 1.5), C, { w: 4, alpha: 0.7 });
  }
  // kabel melengkung antar tiang
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(172, 1158);
      ctx.quadraticCurveTo(336, 1216, 500, 1146);
      ctx.quadraticCurveTo(664, 1204, 828, 1158);
    },
    C,
    { w: 2.5, alpha: 0.5 }
  );
  inkStroke(
    ctx,
    () => {
      ctx.beginPath();
      ctx.moveTo(172, 1190);
      ctx.quadraticCurveTo(336, 1250, 500, 1178);
      ctx.quadraticCurveTo(664, 1238, 828, 1190);
    },
    C,
    { w: 2, alpha: 0.4 }
  );

  // garis tanah + siluet atap hangus
  inkStroke(
    ctx,
    () => wobblePath(ctx, [[80, 1368], [400, 1362], [700, 1370], [1000, 1364]], 3),
    C,
    { w: 5, alpha: 0.7 }
  );
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.globalAlpha = 0.16;
  // puing/atap: segitiga dan kotak rendah
  ctx.beginPath();
  ctx.moveTo(96, 1366);
  ctx.lineTo(150, 1332);
  ctx.lineTo(204, 1366);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(250, 1340, 74, 26);
  ctx.beginPath();
  ctx.moveTo(700, 1366);
  ctx.lineTo(758, 1330);
  ctx.lineTo(816, 1366);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(880, 1344, 66, 22);
  ctx.restore();

  // abu beterbangan
  ctx.save();
  ctx.fillStyle = C.muted;
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.12 + Math.random() * 0.14;
    ctx.fillRect(120 + Math.random() * 840, 1150 + Math.random() * 200, 2.5, 2.5);
  }
  ctx.restore();
}

/* ---------- orkestrasi render ---------- */

async function preparePalette(): Promise<Palette> {
  const mincho = `${cssVar("--font-zen-mincho", '"Zen Old Mincho"')}, "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif`;
  const gothic = `${cssVar("--font-zen-gothic", '"Zen Kaku Gothic New"')}, "Hiragino Kaku Gothic ProN", sans-serif`;
  await ensureFonts(mincho, gothic);
  return {
    bg: cssVar("--background", "#f6f2e7"),
    ink: cssVar("--foreground", "#3b342b"),
    muted: cssVar("--muted-foreground", "#7a7263"),
    seal: cssVar("--seal", "#b8492f"),
    hairline: cssVar("--border", "#e6dfcb"),
    paper: "#fcf9f0",
    paperDark: "#ece4cd",
    closetDark: "#37322a",
    mincho,
    gothic,
  };
}

const PAINTERS: Record<
  string,
  (ctx: CanvasRenderingContext2D, C: Palette, d: StoryData) => void
> = {
  kitte: paintKitte,
  jizo: paintJizo,
  oshiire: paintOshiire,
  chichi: paintChichi,
};

export async function renderStoryCanvas(
  templateId: string,
  data: StoryData,
  scale = 1
): Promise<HTMLCanvasElement> {
  const C = await preparePalette();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  // willReadFrequently: rasterisasi CPU — ekspor satu-off lebih dapat diprediksi.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas tidak tersedia.");
  ctx.scale(scale, scale);
  ctx.textBaseline = "alphabetic";

  paintWashi(ctx, C);
  (PAINTERS[templateId] ?? paintJizo)(ctx, C, data); // GAMBAR = main objek
  drawOverlay(ctx, C, data); // data entri menimpa gambar, ala Strava
  return canvas;
}

export async function renderStoryBlob(
  templateId: string,
  data: StoryData,
  scale = 1
): Promise<Blob> {
  const canvas = await renderStoryCanvas(templateId, data, scale);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Gagal merender story.");
  return blob;
}

/** DataURL kecil untuk thumbnail pemilih templat. */
export async function renderStoryDataUrl(
  templateId: string,
  data: StoryData,
  scale = 0.1
): Promise<string> {
  const canvas = await renderStoryCanvas(templateId, data, scale);
  return canvas.toDataURL("image/png");
}
