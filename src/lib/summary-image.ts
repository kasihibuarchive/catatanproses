import {
  formatDuration,
  monthActorCount,
  monthPhotoCount,
  monthSessionCount,
  type MonthGroup,
} from "./panggung";

/**
 * Render the month recap as a washi-paper PNG (1080 wide, 4:5-ish poster).
 * Uses the same fonts and color tokens as the page, resolved at runtime.
 * Client-only — runs after a click, never during SSR.
 */

const WIDTH = 1080;
const MARGIN = 96;
const CONTENT_W = WIDTH - MARGIN * 2;
const MIN_HEIGHT = 1080;
const ROW_H = 46;
const BASE_WEEK_GAP = 26;
const BASE_FOOTER_GAP = 64;

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.body).getPropertyValue(name).trim();
  return raw || fallback;
}

/** Ask the browser to finish loading the faces we will draw with. */
async function ensureFonts(mincho: string, gothic: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`400 72px ${mincho}`, "稽古日誌月継続は力なり"),
      document.fonts.load(`400 30px ${mincho}`, "稽古"),
      document.fonts.load(`700 40px ${gothic}`, "September 2026 0123456789"),
      document.fonts.load(`400 26px ${gothic}`, "sesi orang jam foto •—·"),
      document.fonts.load(`500 22px ${gothic}`, "LOG LATIHAN TEATER"),
    ]);
    await document.fonts.ready;
  } catch {
    // Draw with whatever is already available.
  }
}

function clampText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxW) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

type SpacingCtx = CanvasRenderingContext2D & { letterSpacing?: string };

export async function renderMonthSummaryBlob(month: MonthGroup): Promise<Blob> {
  const mincho = `${cssVar("--font-zen-mincho", '"Zen Old Mincho"')}, "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif`;
  const gothic = `${cssVar("--font-zen-gothic", '"Zen Kaku Gothic New"')}, "Hiragino Kaku Gothic ProN", sans-serif`;
  const ink = cssVar("--foreground", "#3b342b");
  const muted = cssVar("--muted-foreground", "#7a7263");
  const seal = cssVar("--seal", "#b8492f");
  const bg = cssVar("--background", "#f6f2e7");
  const hairline = cssVar("--border", "#e6dfcb");

  await ensureFonts(mincho, gothic);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia.");

  /* ---------- data ---------- */

  const sessions = monthSessionCount(month);
  const people = monthActorCount(month);
  const photos = monthPhotoCount(month);
  const statsLine = `${sessions} sesi · ${formatDuration(month.totalMin)}${
    people > 1 ? ` · ${people} orang` : ""
  }${photos > 0 ? ` · ${photos} foto` : ""}`;

  interface Row {
    kind: "week" | "person";
    left: string;
    right: string;
  }
  const rows: Row[] = [];
  for (const week of month.weeks) {
    rows.push({
      kind: "week",
      left: week.range,
      right: `${week.logs.length} sesi · ${formatDuration(week.totalMin)}`,
    });
    const byActor = new Map<string, { name: string; min: number }>();
    for (const log of week.logs) {
      const key = log.actorName.trim().toLowerCase();
      const entry = byActor.get(key);
      if (entry) entry.min += log.durationMin;
      else byActor.set(key, { name: log.actorName.trim(), min: log.durationMin });
    }
    for (const a of [...byActor.values()].sort((x, y) => y.min - x.min)) {
      rows.push({ kind: "person", left: a.name, right: formatDuration(a.min) });
    }
  }

  /* ---------- layout (fixed baselines, flexible breathing room) ---------- */

  const TITLE_Y = 150;
  const EYEBROW_Y = TITLE_Y + 38;
  const MONTH_Y = EYEBROW_Y + 56;
  const RULE_Y = MONTH_Y + 36;
  const STATS_Y = RULE_Y + 46;
  const ROWS_Y = STATS_Y + 44;

  /** Height without the MIN_HEIGHT floor — used to distribute spare space. */
  const rawHeight = (weekGap: number, footerGap: number): number => {
    const content = rows.reduce(
      (h, r) => h + ROW_H + (r.kind === "week" ? weekGap : 0),
      0
    );
    const footerTop = ROWS_Y + content + footerGap;
    return footerTop + 96 + 110;
  };

  // Stretch the whitespace on short months so the poster never looks top-heavy.
  const weeksN = rows.filter((r) => r.kind === "week").length || 1;
  let weekGap = BASE_WEEK_GAP;
  let footerGap = BASE_FOOTER_GAP;
  const natural = rawHeight(weekGap, footerGap);
  if (natural < MIN_HEIGHT) {
    const extra = MIN_HEIGHT - natural;
    const perWeek = Math.min(90, Math.floor((extra * 0.7) / weeksN));
    weekGap += perWeek;
    footerGap += Math.min(260, extra - perWeek * weeksN);
  }

  const content = rows.reduce(
    (h, r) => h + ROW_H + (r.kind === "week" ? weekGap : 0),
    0
  );
  const footerTop = ROWS_Y + content + footerGap;
  const height = Math.max(MIN_HEIGHT, rawHeight(weekGap, footerGap));

  canvas.width = WIDTH;
  canvas.height = height;

  /* ---------- paint ---------- */

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, height);

  // faint handmade-paper grain
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(70, 58, 34, ${(0.02 + Math.random() * 0.02).toFixed(3)})`;
    ctx.fillRect(Math.random() * WIDTH, Math.random() * height, 1.5, 1.5);
  }

  // hairline frame
  ctx.strokeStyle = hairline;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, WIDTH - 80, height - 80);

  // title kanji + month numeral
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = `400 72px ${mincho}`;
  ctx.fillText("稽古日誌", MARGIN, TITLE_Y);

  ctx.fillStyle = seal;
  ctx.font = `400 56px ${mincho}`;
  ctx.textAlign = "right";
  ctx.fillText(`${Number(month.key.split("-")[1])}月`, WIDTH - MARGIN, TITLE_Y);
  ctx.textAlign = "left";

  // latin eyebrow
  ctx.fillStyle = muted;
  ctx.font = `500 22px ${gothic}`;
  if ("letterSpacing" in ctx) (ctx as SpacingCtx).letterSpacing = "10px";
  ctx.fillText("LOG LATIHAN TEATER", MARGIN + 2, EYEBROW_Y);
  if ("letterSpacing" in ctx) (ctx as SpacingCtx).letterSpacing = "0px";

  // month label
  ctx.fillStyle = ink;
  ctx.font = `700 40px ${gothic}`;
  ctx.fillText(month.label, MARGIN, MONTH_Y);

  // vermillion thick-thin double rule, Showa print style
  ctx.fillStyle = seal;
  ctx.fillRect(MARGIN, RULE_Y, CONTENT_W, 3);
  ctx.globalAlpha = 0.55;
  ctx.fillRect(MARGIN, RULE_Y + 7, CONTENT_W, 1);
  ctx.globalAlpha = 1;

  // stats
  ctx.fillStyle = muted;
  ctx.font = `400 27px ${gothic}`;
  ctx.fillText(statsLine, MARGIN, STATS_Y);

  // ledger rows
  let y = ROWS_Y;
  for (const row of rows) {
    if (row.kind === "week") {
      y += weekGap;
      ctx.font = `700 26px ${gothic}`;
      ctx.fillStyle = ink;
      ctx.fillText(clampText(ctx, row.left, CONTENT_W - 280), MARGIN, y);
      ctx.font = `400 24px ${gothic}`;
      ctx.fillStyle = muted;
      ctx.textAlign = "right";
      ctx.fillText(row.right, WIDTH - MARGIN, y);
      ctx.textAlign = "left";
      ctx.strokeStyle = hairline;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y + 16);
      ctx.lineTo(WIDTH - MARGIN, y + 16);
      ctx.stroke();
    } else {
      ctx.fillStyle = seal;
      ctx.beginPath();
      ctx.arc(MARGIN + 6, y - 9, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `400 26px ${gothic}`;
      ctx.fillStyle = ink;
      ctx.fillText(clampText(ctx, row.left, CONTENT_W - 220), MARGIN + 26, y);
      ctx.font = `400 24px ${gothic}`;
      ctx.fillStyle = muted;
      ctx.textAlign = "right";
      ctx.fillText(row.right, WIDTH - MARGIN, y);
      ctx.textAlign = "left";
    }
    y += ROW_H;
  }

  // footer proverb + hanko seal
  ctx.fillStyle = ink;
  ctx.font = `400 30px ${mincho}`;
  if ("letterSpacing" in ctx) (ctx as SpacingCtx).letterSpacing = "6px";
  ctx.fillText("継続は力なり", MARGIN, footerTop);
  if ("letterSpacing" in ctx) (ctx as SpacingCtx).letterSpacing = "0px";

  ctx.fillStyle = muted;
  ctx.font = `400 18px ${gothic}`;
  ctx.fillText("Keizoku wa chikara nari — konsistensi adalah kekuatan.", MARGIN, footerTop + 34);

  ctx.save();
  ctx.translate(WIDTH - MARGIN - 46, footerTop - 14);
  ctx.rotate(-0.05);
  ctx.fillStyle = seal;
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(-46, -46, 92, 92, 8);
    ctx.fill();
  } else {
    ctx.fillRect(-46, -46, 92, 92);
  }
  ctx.strokeStyle = "rgba(246, 242, 231, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-38, -38, 76, 76);
  ctx.fillStyle = bg;
  ctx.font = `400 30px ${mincho}`;
  ctx.textAlign = "center";
  ctx.fillText("稽", 0, -6);
  ctx.fillText("古", 0, 28);
  ctx.textAlign = "left";
  ctx.restore();

  /* ---------- export ---------- */

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Gagal merender gambar.");
  console.debug("[summary-image]", month.key, `${(blob.size / 1024).toFixed(0)} KB`);
  return blob;
}
