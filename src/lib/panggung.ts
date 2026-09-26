import { endOfWeek, format, startOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale";

/** Mirror of the PracticeLog API JSON (dates arrive as ISO strings). */
export interface PracticeLog {
  id: string;
  actorName: string;
  title: string;
  date: string; // ISO
  durationMin: number;
  notes: string;
  imagePath: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export const ACTOR_NAME_STORAGE_KEY = "panggung.actorName";

/** Compact hour-based duration: "45 mnt", "1,5 jam", "2 jam", "2 jam 5 mnt". */
export function formatDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin} mnt`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h} jam`;
  if (m === 30) return `${h},5 jam`;
  return `${h} jam ${m} mnt`;
}

/** Parse hours input ("1,5" / "1.5" / "2") into whole minutes; null if invalid. */
export function hoursToMinutes(input: string): number | null {
  const normalized = input.trim().replace(",", ".");
  if (!normalized) return null;
  const hours = Number(normalized);
  if (Number.isNaN(hours)) return null;
  return Math.round(hours * 60);
}

/** Minutes -> editable hours string with comma decimal ("90" -> "1,5"). */
export function minutesToHoursInput(min: number): string {
  return String(parseFloat((min / 60).toFixed(2))).replace(".", ",");
}

/** Extract "YYYY-MM-DD" from an ISO datetime string (timezone-shift safe). */
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Parse "YYYY-MM-DD" into a local Date (midnight, local time). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
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
  totalMin: number;
}

export interface MonthGroup {
  key: string; // "yyyy-MM"
  label: string; // "September 2026"
  totalMin: number;
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
      month = { key: monthKey, label: monthKey, totalMin: 0, weeks: [] };
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
      week = { key: weekKey, range, logs: [], totalMin: 0 };
      month.weeks.push(week);
    }

    week.logs.push(log);
    week.totalMin += log.durationMin;
    month.totalMin += log.durationMin;
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

/** Plain-text recap of one month, ready to paste into a chat. */
export function buildMonthSummary(month: MonthGroup): string {
  const totalSessions = month.weeks.reduce((n, w) => n + w.logs.length, 0);
  const actorCount = new Set(
    month.weeks.flatMap((w) => w.logs.map((l) => l.actorName.trim().toLowerCase()))
  ).size;
  const lines: string[] = [
    `Log Latihan — ${month.label}`,
    `Total: ${totalSessions} sesi · ${formatDuration(month.totalMin)}${
      actorCount > 1 ? ` · ${actorCount} orang` : ""
    }`,
  ];

  for (const week of month.weeks) {
    lines.push("");
    lines.push(
      `${week.range}: ${week.logs.length} sesi · ${formatDuration(week.totalMin)}`
    );

    // Per-person totals within the week (case-insensitive name grouping).
    const byActor = new Map<string, { name: string; min: number }>();
    for (const log of week.logs) {
      const key = log.actorName.trim().toLowerCase();
      const entry = byActor.get(key);
      if (entry) {
        entry.min += log.durationMin;
      } else {
        byActor.set(key, { name: log.actorName.trim(), min: log.durationMin });
      }
    }
    for (const actor of [...byActor.values()].sort((a, b) => b.min - a.min)) {
      lines.push(`• ${actor.name} — ${formatDuration(actor.min)}`);
    }
  }

  return lines.join("\n");
}
