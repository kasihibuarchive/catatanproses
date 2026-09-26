import { endOfWeek, format, startOfWeek } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  BookOpen,
  Eye,
  Mic2,
  MoreHorizontal,
  Music,
  PersonStanding,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Mirror of the PracticeLog API JSON (dates arrive as ISO strings). */
export interface PracticeLog {
  id: string;
  actorName: string;
  title: string;
  date: string; // ISO
  durationMin: number;
  category: string;
  intensity: string;
  mood: string;
  notes: string;
  imagePath: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface CategoryDef {
  name: string;
  icon: LucideIcon;
  badgeClass: string;
}

export const CATEGORIES: CategoryDef[] = [
  {
    name: "Akting",
    icon: Mic2,
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  {
    name: "Vokal & Musik",
    icon: Music,
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  },
  {
    name: "Gerak & Tari",
    icon: PersonStanding,
    badgeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    name: "Improvisasi",
    icon: Sparkles,
    badgeClass: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  },
  {
    name: "Baca Naskah",
    icon: BookOpen,
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  },
  {
    name: "Teknis & Panggung",
    icon: Wrench,
    badgeClass: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  },
  {
    name: "Observasi",
    icon: Eye,
    badgeClass: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  },
  {
    name: "Lainnya",
    icon: MoreHorizontal,
    badgeClass: "bg-stone-500/15 text-stone-300 border-stone-500/30",
  },
];

export const INTENSITIES = ["Rendah", "Sedang", "Tinggi"] as const;

export const MOODS = ["😅", "🙂", "😊", "🤩", "😤"] as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export const ACTOR_NAME_STORAGE_KEY = "panggung.actorName";

export function categoryDef(name: string): CategoryDef {
  return (
    CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1]
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

/** Stats total: "45 mnt" or "12,5 jam" (Indonesian decimal comma). */
export function formatDuration(totalMin: number): string {
  if (totalMin < 60) return `${totalMin} mnt`;
  const hours = Math.round((totalMin / 60) * 10) / 10;
  const text = hours.toFixed(1).replace(".", ",").replace(/,0$/, "");
  return `${text} jam`;
}

/** Per-log duration: "90 mnt", "1 j 30 mnt", "2 j". */
export function formatLogDuration(min: number): string {
  if (min < 60) return `${min} mnt`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} j` : `${h} j ${m} mnt`;
}

/** Extract "YYYY-MM-DD" from an ISO datetime string (timezone-shift safe). */
export function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Parse "YYYY-MM-DD" into a local Date (midnight, local time). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** Consecutive days (ending today or yesterday) that have at least one log. */
export function computeStreak(logs: PracticeLog[]): number {
  const days = new Set(logs.map((l) => dateKey(l.date)));
  const cursor = new Date();
  if (!days.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface WeekGroup {
  key: string; // week start "yyyy-MM-dd"
  label: string; // "Pekan 1 · 03–09 Feb"
  logs: PracticeLog[];
  totalMin: number;
}

export interface MonthGroup {
  key: string; // "yyyy-MM"
  label: string; // "Februari 2025"
  totalMin: number;
  weeks: WeekGroup[];
}

/** Group logs (sorted date desc) into month → week buckets. */
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
      week = {
        key: weekKey,
        label: `Pekan ${month.weeks.length + 1} · ${range}`,
        logs: [],
        totalMin: 0,
      };
      month.weeks.push(week);
    }

    week.logs.push(log);
    week.totalMin += log.durationMin;
    month.totalMin += log.durationMin;
  }

  // Resolve month labels after grouping (needs date-fns formatting).
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
