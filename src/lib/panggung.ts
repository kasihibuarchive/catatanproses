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

/** "45 mnt" atau "1 j 30 mnt". */
export function formatDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin} mnt`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} jam` : `${h} jam ${m} mnt`;
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
