import { endOfWeek, format, startOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale";

/** Mirror of the PracticeLog API JSON (dates arrive as ISO strings). */
export interface PracticeLog {
  id: string;
  actorName: string;
  title: string;
  date: string; // ISO
  durationMin: number | null; // legacy — durasi sudah dihapus dari aplikasi
  notes: string;
  imagePath: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export const ACTOR_NAME_STORAGE_KEY = "panggung.actorName";

/** Unsent form draft — so a reload never loses what was being typed. */
export const DRAFT_STORAGE_KEY = "panggung.draft";

export interface FormDraft {
  actorName: string;
  title: string;
  notes: string;
}

/** Extract "YYYY-MM-DD" from an ISO datetime string (timezone-shift safe). */
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Parse "YYYY-MM-DD" into a local-midnight Date (midnight, local time). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Strict "YYYY-MM-DD" -> local-midnight Date; null if the calendar date is invalid. */
export function parseLocalDate(key: string): Date | null {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== (m ?? 1) - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Feed order: date desc, then newest-created first. */
export function sortFeedLogs(logs: PracticeLog[]): PracticeLog[] {
  return [...logs].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface WeekGroup {
  key: string; // week start "yyyy-MM-dd"
  range: string; // "21–27 Sep"
  logs: PracticeLog[];
}

export interface MonthGroup {
  key: string; // "yyyy-MM"
  label: string; // "September 2026"
  weeks: WeekGroup[];
}

/** Group logs (already sorted date desc) into month → week buckets. */
export function groupByMonthWeek(logs: PracticeLog[]): MonthGroup[] {
  const months: MonthGroup[] = [];

  for (const log of logs) {
    const date = parseDateKey(dateKey(log.date));
    const monthKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

    let month = months[months.length - 1];
    if (!month || month.key !== monthKey) {
      month = { key: monthKey, label: monthKey, weeks: [] };
      months.push(month);
    }

    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
    const weekKey = toDateKey(weekStart);

    let week = month.weeks[month.weeks.length - 1];
    if (!week || week.key !== weekKey) {
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      const range = sameMonth
        ? `${format(weekStart, "dd")}–${format(weekEnd, "dd MMM", { locale: localeId })}`
        : `${format(weekStart, "dd MMM", { locale: localeId })} – ${format(weekEnd, "dd MMM", { locale: localeId })}`;
      week = { key: weekKey, range, logs: [] };
      month.weeks.push(week);
    }

    week.logs.push(log);
  }

  for (const month of months) {
    const [y, m] = month.key.split("-").map(Number);
    month.label = capitalize(
      format(new Date(y ?? 2025, (m ?? 1) - 1, 1), "MMMM yyyy", { locale: localeId })
    );
  }

  return months;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Weekday kanji (Sun..Sat) for the small date accents on each entry. */
export const WEEKDAY_KANJI = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** Japanese era date (和暦) — "令和8年9月27日" — for story/poster accents. */
export function warekiDate(isoDateKey: string): string {
  const [y, m, d] = isoDateKey.split("-").map(Number);
  if (!y || !m || !d) return "";
  const era =
    y >= 2019
      ? { name: "令和", n: y - 2018 }
      : y >= 1989
        ? { name: "平成", n: y - 1988 }
        : { name: "昭和", n: y - 1925 };
  return `${era.name}${era.n}年${m}月${d}日`;
}

export function monthSessionCount(month: MonthGroup): number {
  return month.weeks.reduce((n, w) => n + w.logs.length, 0);
}

export function monthActorCount(month: MonthGroup): number {
  return new Set(
    month.weeks.flatMap((w) => w.logs.map((l) => l.actorName.trim().toLowerCase()))
  ).size;
}

export function monthPhotoCount(month: MonthGroup): number {
  return month.weeks.reduce((n, w) => n + w.logs.filter((l) => l.imagePath).length, 0);
}

/** Plain-text recap of one month, ready to paste into a chat. */
export function buildMonthSummary(month: MonthGroup): string {
  const totalSessions = monthSessionCount(month);
  const actorCount = monthActorCount(month);
  const lines: string[] = [
    `Catatan Proses — ${month.label}`,
    `Total: ${totalSessions} sesi${
      actorCount > 1 ? ` · ${actorCount} orang` : ""
    }`,
  ];

  for (const week of month.weeks) {
    lines.push("");
    lines.push(`${week.range}: ${week.logs.length} sesi`);

    // Names within the week (case-insensitive grouping, feed order).
    const seen = new Set<string>();
    for (const log of week.logs) {
      const key = log.actorName.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`• ${log.actorName.trim()}`);
    }
  }

  return lines.join("\n");
}

/** Single-entry recap for quick sharing into a chat. */
export function buildEntrySummary(log: PracticeLog): string {
  const day = new Date(`${dateKey(log.date)}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const lines = [`${log.actorName} — ${day}`, log.title];
  if (log.notes.trim()) lines.push(log.notes.trim());
  return lines.join("\n");
}

/** CSV escape: quote everything, double inner quotes, neutralize formula injection. */
function csvCell(value: string): string {
  const text = /^[=+@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Minimal ledger CSV for one month (feed order). BOM is added at download time. */
export function buildMonthCsv(month: MonthGroup): string {
  const header = ["tanggal", "nama", "judul", "catatan", "foto"];
  const lines = [header.map(csvCell).join(",")];
  for (const week of month.weeks) {
    for (const log of week.logs) {
      lines.push(
        [
          dateKey(log.date),
          log.actorName.trim(),
          log.title.trim(),
          log.notes.trim(),
          log.imagePath ?? "",
        ]
          .map(csvCell)
          .join(",")
      );
    }
  }
  return lines.join("\r\n");
}
