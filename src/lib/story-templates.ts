import {
  dateKey,
  formatDuration,
  WEEKDAY_KANJI,
  warekiDate,
  type PracticeLog,
} from "./panggung";

/**
 * Story templates (1080×1920, 9:16) — ala Strava story share, tapi washi:
 * perangko 切手, patung 地蔵, lemari 押入れ, dan tategaki 父と暮らせば.
 * Semua ilustrasi digambar manual di canvas (gaya sumi hand-drawn, sedikit
 * getar acak supaya terasa cetak tangan — tiap render unik seperti kayu blok).
 * Client-only: dijalankan setelah klik, tidak pernah saat SSR.
 */

const W = 1080;
const H = 1920;
const M = 96; // margin kiri/kanan
const CONTENT_W = W - M * 2;

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
        "地蔵日誌父と暮らせば押入切手稽古参郵便継続は力なり昭和令和年月日時古の一日"
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
  { id: "kitte", name: "Perangko", kanji: "切手", hint: "perangko 稽古 + cap pos Jizo" },
  { id: "jizo", name: "Patung Jizō", kanji: "地蔵", hint: "sketsa sumi di lapangan" },
  { id: "oshiire", name: "Oshiire", kanji: "押入", hint: "noren & fusuma backstage" },
  { id: "chichi", name: "Chichi to Kuraseba", kanji: "父", hint: "父と暮らせば tategaki" },
];

export interface StoryData {
  actorName: string;
  title: string;
  dayKey: string; // "YYYY-MM-DD"
  notes: string;
  durationText: string | null; // "1,5 jam" | null
}

export function storyDataFromLog(log: PracticeLog): StoryData {
  return {
    actorName: log.actorName,
    title: log.title,
    dayKey: dateKey(log.date),
    notes: log.notes.trim(),
    durationText:
      log.durationMin !== null ? formatDuration(log.durationMin) : null,
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
    notes:
      "SFX hujan masuk terlalu pagi; tarik tempo jeda sebelum dialog penutup.",
    durationText: "1,5 jam",
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

/* ---------- elemen bersama ---------- */

function paintWashi(ctx: CanvasRenderingContext2D, C: Palette): void {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 1300; i++) {
    ctx.fillStyle = `rgba(70, 58, 34, ${(0.015 + Math.random() * 0.02).toFixed(3)})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
  }
}

function drawHeader(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.ink;
  ctx.font = `400 42px ${C.mincho}`;
  sp(ctx, "6px");
  ctx.fillText("地蔵日誌", M, 128);
  sp(ctx, "0px");

  ctx.fillStyle = C.muted;
  ctx.font = `500 18px ${C.gothic}`;
  sp(ctx, "8px");
  ctx.fillText("CATATAN PROSES JIZO", M + 2, 168);
  sp(ctx, "0px");

  const weekday = WEEKDAY_KANJI[new Date(`${d.dayKey}T00:00:00`).getDay()];
  ctx.textAlign = "right";
  ctx.fillStyle = C.seal;
  ctx.font = `400 40px ${C.mincho}`;
  ctx.fillText(weekday, W - M, 126);

  ctx.fillStyle = C.muted;
  ctx.font = `400 21px ${C.mincho}`;
  ctx.fillText(warekiDate(d.dayKey), W - M, 166);
  ctx.textAlign = "left";

  // garis ganda tebal-tipis, cetakan Showa
  ctx.fillStyle = C.seal;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(M, 200, CONTENT_W, 3);
  ctx.globalAlpha = 0.4;
  ctx.fillRect(M, 208, CONTENT_W, 1);
  ctx.globalAlpha = 1;
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

function drawFooter(ctx: CanvasRenderingContext2D, C: Palette): void {
  ctx.fillStyle = C.ink;
  ctx.globalAlpha = 0.85;
  ctx.font = `400 27px ${C.mincho}`;
  sp(ctx, "6px");
  ctx.fillText("継続は力なり", M, 1846);
  sp(ctx, "0px");
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.muted;
  ctx.font = `400 16px ${C.gothic}`;
  ctx.fillText("Keizoku wa chikara nari", M, 1880);
  drawHanko(ctx, C, W - M - 36, 1846, 74, ["地", "蔵"]);
}

/** Blok info entri di bagian bawah (semua templat). */
function drawEntryBlock(
  ctx: CanvasRenderingContext2D,
  C: Palette,
  d: StoryData,
  x: number,
  y0: number,
  maxW: number
): void {
  ctx.textAlign = "left";
  ctx.fillStyle = C.ink;
  ctx.font = `700 36px ${C.gothic}`;
  ctx.fillText(wrapKeep(ctx, d.actorName, maxW)[0] ?? "", x, y0);

  const weekday = WEEKDAY_KANJI[new Date(`${d.dayKey}T00:00:00`).getDay()];
  const shortDate = new Date(`${d.dayKey}T00:00:00`).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  ctx.font = `400 26px ${C.gothic}`;
  ctx.fillStyle = C.muted;
  const meta = `${weekday} · ${shortDate}`;
  ctx.fillText(meta, x, y0 + 52);
  if (d.durationText) {
    ctx.fillStyle = C.seal;
    ctx.font = `700 26px ${C.gothic}`;
    ctx.fillText(`· ${d.durationText}`, x + ctx.measureText(meta).width + 14, y0 + 52);
  }

  ctx.fillStyle = C.ink;
  ctx.font = `400 46px ${C.mincho}`;
  const titleLines = wrapText(ctx, d.title, maxW, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, x, y0 + 130 + i * 62));

  if (d.notes) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 27px ${C.gothic}`;
    const notesY = y0 + 130 + titleLines.length * 62 + 22;
    wrapText(ctx, d.notes, maxW, 3).forEach((line, i) =>
      ctx.fillText(line, x, notesY + i * 40)
    );
  }
}

function wrapKeep(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  return wrapText(ctx, text, maxW, 1);
}

/** Braket sudut 【 】 di sekeliling area blok entri. */
function drawBrackets(
  ctx: CanvasRenderingContext2D,
  C: Palette,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const l = 42;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.55;
  const corners: [number, number, number, number][] = [
    [x, y + l, x, y, x + l, y],
    [x + w - l, y, x + w, y, x + w, y + l],
    [x + w, y + h - l, x + w, y + h, x + w - l, y + h],
    [x + l, y + h, x, y + h, x, y + h - l],
  ];
  for (const [x1, y1, x2, y2, x3, y3] of corners) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/* ---------- patung Jizo (sketsa sumi penuh) ---------- */

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

/** Patung Jizo versi duduk kecil (dalam oshiire). */
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

/* ---------- TEMPLAT 1: 切手 (perangko) ---------- */

function paintKitte(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  const SX = 150;
  const SY = 340;
  const SW = 780;
  const SH = 880;

  // kertas perangko + lubang perforasi
  ctx.fillStyle = C.paper;
  ctx.fillRect(SX, SY, SW, SH);
  ctx.fillStyle = C.bg;
  const holeR = 20;
  const step = 46;
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
  ctx.font = `400 26px ${C.mincho}`;
  sp(ctx, "6px");
  ctx.fillText("地蔵郵便", SX + 72, SY + 92);
  sp(ctx, "0px");
  ctx.fillStyle = C.muted;
  ctx.font = `500 16px ${C.gothic}`;
  sp(ctx, "5px");
  ctx.textAlign = "right";
  ctx.fillText("JIZO POST", SX + SW - 72, SY + 88);
  ctx.textAlign = "left";
  sp(ctx, "0px");

  // nilai nominal di kiri-atas (jauh dari cap pos): durasi sbg mata uang,
  // tanpa durasi = 参 (hadir)
  ctx.fillStyle = C.seal;
  if (d.durationText) {
    const hours = parseHoursFromText(d.durationText);
    const hoursLabel =
      hours !== null
        ? String(parseFloat(hours.toFixed(2))).replace(".", ",")
        : "1";
    ctx.font = `400 62px ${C.mincho}`;
    ctx.fillText(hoursLabel, SX + 72, SY + 188);
    const hw = ctx.measureText(hoursLabel).width;
    ctx.font = `400 27px ${C.mincho}`;
    ctx.fillText("時間", SX + 72 + hw + 10, SY + 188);
  } else {
    ctx.font = `400 56px ${C.mincho}`;
    ctx.fillText("参", SX + 72, SY + 184);
  }

  // kanji utama perangko
  ctx.fillStyle = C.ink;
  ctx.font = `400 300px ${C.mincho}`;
  sp(ctx, "24px");
  ctx.fillText("稽", SX + 96, SY + 560);
  sp(ctx, "0px");
  ctx.fillStyle = C.muted;
  ctx.font = `400 24px ${C.gothic}`;
  ctx.fillText("keiko — latihan", SX + 102, SY + 612);

  // sketsa dada Jizo kecil di kanan bawah
  const jx = SX + SW - 190;
  const jy = SY + SH - 120;
  inkStroke(ctx, () => wobbleCircle(ctx, jx, jy - 70, 42, 1.5), C, { w: 4, fill: C.bg });
  inkStroke(
    ctx,
    () =>
      wobblePath(
        ctx,
        [
          [jx - 44, jy - 42],
          [jx + 44, jy - 42],
          [jx + 58, jy + 40],
          [jx - 58, jy + 40],
        ],
        2,
        true
      ),
    C,
    { w: 4.5, fill: C.bg }
  );
  inkStroke(
    ctx,
    () =>
      wobblePath(
        ctx,
        [
          [jx - 32, jy - 46],
          [jx + 32, jy - 46],
          [jx + 40, jy - 4],
          [jx - 40, jy - 4],
        ],
        1.5,
        true
      ),
    C,
    { w: 3, color: C.seal, alpha: 0.8 }
  );

  // tanggal di dalam perangko
  ctx.fillStyle = C.muted;
  ctx.font = `400 24px ${C.mincho}`;
  ctx.fillText(warekiDate(d.dayKey), SX + 72, SY + SH - 74);

  // ---- cap pos (postmark) menimpa sisi kanan perangko ----
  ctx.save();
  ctx.translate(SX + SW - 30, SY + 150);
  ctx.rotate(-0.2);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = C.seal;
  ctx.fillStyle = C.seal;
  ctx.lineCap = "round";
  // bilah pembunuh (killer bars)
  ctx.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(-370, -48 + i * 16);
    ctx.lineTo(-160, -48 + i * 16);
    ctx.stroke();
  }
  // lingkaran ganda
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 100, 0, Math.PI * 2);
  ctx.stroke();
  // isi cap
  ctx.textAlign = "center";
  ctx.font = `500 24px ${C.gothic}`;
  sp(ctx, "4px");
  ctx.fillText("JIZO", 0, -34);
  sp(ctx, "0px");
  const [y, m, day] = d.dayKey.split("-");
  ctx.font = `400 30px ${C.gothic}`;
  ctx.fillText(`${Number(y)}.${Number(m)}.${Number(day)}`, 0, 6);
  ctx.font = `400 20px ${C.mincho}`;
  ctx.fillText("地蔵日誌", 0, 44);
  ctx.textAlign = "left";
  ctx.restore();

  // blok entri
  drawEntryBlock(ctx, C, d, M, 1400, CONTENT_W);
}

/** Ambil angka jam dari "1,5 jam" / "45 mnt" / "2 jam 5 mnt" (untuk nominal). */
function parseHoursFromText(text: string): number | null {
  const jamMatch = text.match(/^([\d,\.]+)\s+jam/);
  if (jamMatch) {
    const n = Number(jamMatch[1].replace(",", "."));
    return Number.isNaN(n) ? null : n;
  }
  const mntMatch = text.match(/^(\d+)\s+mnt/);
  if (mntMatch) return Number(mntMatch[1]) / 60;
  return null;
}

/* ---------- TEMPLAT 2: 地蔵 (patung) ---------- */

function paintJizo(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  // tanah
  inkStroke(
    ctx,
    () => wobblePath(ctx, [[130, 1250], [520, 1244], [950, 1252]], 3),
    C,
    { w: 7, alpha: 0.85 }
  );
  drawGrass(ctx, C, 205, 1246, 26);
  drawGrass(ctx, C, 848, 1250, 22);
  drawBird(ctx, C, 770, 330, 26);
  drawBird(ctx, C, 845, 292, 19);

  drawJizoStatue(ctx, C, 540, 1236, 1);

  // aksen tategaki di tepi kanan
  ctx.save();
  ctx.fillStyle = C.ink;
  ctx.globalAlpha = 0.12;
  ctx.font = `400 44px ${C.mincho}`;
  ctx.textAlign = "center";
  "地蔵日誌".split("").forEach((ch, i) => ctx.fillText(ch, 1006, 420 + i * 66));
  ctx.restore();
  ctx.textAlign = "left";

  drawEntryBlock(ctx, C, d, M, 1400, CONTENT_W);
}

/* ---------- TEMPLAT 3: 押入れ (lemari) ---------- */

function paintOshiire(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  // noren 稽古の一日
  const panels = ["稽", "古", "の", "一", "日"];
  const nx = 150;
  const nw = 156;
  panels.forEach((ch, i) => {
    const px = nx + i * (nw + 6);
    const bottom = 432 + (i % 2 === 0 ? 0 : 8) + Math.random() * 4;
    ctx.fillStyle = C.closetDark;
    ctx.globalAlpha = 0.94;
    ctx.fillRect(px, 236, nw, bottom - 236);
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.bg;
    ctx.font = `400 62px ${C.mincho}`;
    ctx.textAlign = "center";
    ctx.fillText(ch, px + nw / 2, 372);
    ctx.textAlign = "left";
  });
  // batang noren
  inkStroke(ctx, () => wobblePath(ctx, [[128, 240], [952, 238]], 2), C, { w: 8 });

  // bingkai lemari
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 12;
  ctx.globalAlpha = 0.92;
  ctx.strokeRect(180, 500, 720, 730);
  ctx.globalAlpha = 1;

  // pintu kiri tertutup
  ctx.fillStyle = C.paperDark;
  ctx.fillRect(192, 512, 336, 706);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  ctx.strokeRect(192, 512, 336, 706);
  ctx.globalAlpha = 1;
  // hikite (pegangan) vermillion
  ctx.fillStyle = C.seal;
  ctx.beginPath();
  ctx.arc(496, 862, 17, 0, Math.PI * 2);
  ctx.fill();

  // interior terbuka (kanan)
  ctx.fillStyle = C.closetDark;
  ctx.fillRect(540, 512, 348, 706);
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = C.ink;
  ctx.fillRect(540, 512, 14, 706);
  ctx.restore();

  // sinar lembut dari bukaan
  ctx.save();
  ctx.strokeStyle = C.seal;
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.moveTo(560, 560);
  ctx.lineTo(300, 1290);
  ctx.stroke();
  ctx.lineWidth = 40;
  ctx.beginPath();
  ctx.moveTo(700, 600);
  ctx.lineTo(470, 1290);
  ctx.stroke();
  ctx.restore();

  // rak + tumpukan naskah
  inkStroke(ctx, () => wobblePath(ctx, [[552, 1096], [876, 1094]], 2), C, { w: 5 });
  const scripts: [number, number, number][] = [
    [600, 952, -0.07],
    [646, 946, 0.05],
    [622, 960, -0.02],
  ];
  for (const [sx, sy, rot] of scripts) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.fillStyle = "#fbf7ea";
    ctx.fillRect(0, 0, 118, 128);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.35;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(14, 18 * i + 6);
      ctx.lineTo(104, 18 * i + 6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // gulungan tategu 掛け軸
  ctx.fillStyle = C.paper;
  ctx.fillRect(742, 560, 120, 330);
  ctx.fillStyle = "#6b5a3f";
  ctx.fillRect(734, 548, 136, 14);
  ctx.fillRect(734, 880, 136, 14);
  ctx.fillStyle = C.ink;
  ctx.font = `400 56px ${C.mincho}`;
  ctx.textAlign = "center";
  "稽古".split("").forEach((ch, i) => ctx.fillText(ch, 802, 650 + i * 80));
  ctx.textAlign = "left";

  // jizo mini duduk di rak
  drawJizoMini(ctx, C, 850, 1088, 1);

  drawEntryBlock(ctx, C, d, M, 1400, CONTENT_W);
}

/* ---------- TEMPLAT 4: 父と暮らせば ---------- */

function paintChichi(ctx: CanvasRenderingContext2D, C: Palette, d: StoryData): void {
  // matahari pucat + awan bergaris ala Hiroshige
  ctx.save();
  ctx.fillStyle = C.seal;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.arc(238, 352, 122, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = C.seal;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(238, 352, 122, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  for (const [y, x1, x2] of [[492, 120, 760], [548, 300, 960], [604, 150, 820]] as [number, number, number][]) {
    inkStroke(
      ctx,
      () => wobblePath(ctx, [[x1, y], [x1 + (x2 - x1) * 0.4, y - 6], [x2, y + 2]], 3),
      C,
      { w: 3, color: C.muted, alpha: 0.4 }
    );
  }
  drawBird(ctx, C, 828, 302, 24);

  // tategaki utama 父と暮らせば
  ctx.fillStyle = C.ink;
  ctx.font = `400 158px ${C.mincho}`;
  ctx.textAlign = "center";
  "父と暮らせば".split("").forEach((ch, i) => ctx.fillText(ch, 836, 470 + i * 196));
  // kana kecil di sisi kiri kolom
  ctx.fillStyle = C.muted;
  ctx.font = `400 32px ${C.mincho}`;
  "ちちとくらせば".split("").forEach((ch, i) => ctx.fillText(ch, 700, 462 + i * 58));
  ctx.textAlign = "left";

  // kredit drama + latar era
  ctx.fillStyle = C.muted;
  ctx.font = `400 27px ${C.mincho}`;
  ctx.fillText("井上ひさし 作", 152, 700);
  ctx.font = `400 24px ${C.mincho}`;
  ctx.fillStyle = C.muted;
  ctx.globalAlpha = 0.85;
  ctx.fillText("昭和二十三年 · 1948", 152, 740);
  ctx.globalAlpha = 1;

  // blok entri dalam braket 【 】
  drawBrackets(ctx, C, 84, 1330, W - 168, 400);
  drawEntryBlock(ctx, C, d, M + 22, 1430, CONTENT_W - 60);
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
  drawHeader(ctx, C, data);
  (PAINTERS[templateId] ?? paintJizo)(ctx, C, data);
  drawFooter(ctx, C);
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
