"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { CalendarDays, Clapperboard, Clock, Flame, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  computeStreak,
  dateKey,
  formatDuration,
  formatLogDuration,
  todayKey,
  type PracticeLog,
} from "@/lib/panggung";
import { cn } from "@/lib/utils";

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1.5 truncate text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
    </Card>
  );
}

interface DayBar {
  key: string;
  label: string;
  min: number;
  isToday: boolean;
}

export function StatsSection({ logs }: { logs: PracticeLog[] }) {
  const today = todayKey();
  const monthPrefix = today.slice(0, 7); // "yyyy-MM"

  const stats = useMemo(() => {
    const totalSessions = logs.length;
    const totalMin = logs.reduce((acc, l) => acc + l.durationMin, 0);
    const streak = computeStreak(logs);
    const thisMonth = logs.filter((l) => dateKey(l.date).startsWith(monthPrefix)).length;
    return { totalSessions, totalMin, streak, thisMonth };
  }, [logs, monthPrefix]);

  const days = useMemo<DayBar[]>(() => {
    const perDay = new Map<string, number>();
    for (const log of logs) {
      const key = dateKey(log.date);
      perDay.set(key, (perDay.get(key) ?? 0) + log.durationMin);
    }
    const result: DayBar[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      result.push({
        key,
        label: format(d, "EEE", { locale: localeId }),
        min: perDay.get(key) ?? 0,
        isToday: key === today,
      });
    }
    return result;
  }, [logs, today]);

  const maxMin = Math.max(...days.map((d) => d.min), 1);
  const total7 = days.reduce((acc, d) => acc + d.min, 0);

  return (
    <section aria-label="Statistik latihan" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Clapperboard} value={String(stats.totalSessions)} label="Total Sesi" />
        <StatCard icon={Clock} value={formatDuration(stats.totalMin)} label="Total Latihan" />
        <StatCard icon={Flame} value={`${stats.streak} hari`} label="Streak" />
        <StatCard icon={CalendarDays} value={String(stats.thisMonth)} label="Bulan Ini" />
      </div>

      <Card className="p-4">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Aktivitas 7 Hari Terakhir
        </h3>
        <div className="mt-3 flex items-end gap-2 sm:gap-3" role="img" aria-label="Grafik batang durasi latihan 7 hari terakhir">
          {days.map((day) => {
            const height = day.min > 0 ? Math.max(4, (day.min / maxMin) * 80) : 4;
            return (
              <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div
                  className="flex h-20 w-full items-end justify-center"
                  title={`${day.label}${day.min > 0 ? ` · ${formatLogDuration(day.min)}` : " · tidak ada latihan"}`}
                >
                  <div
                    className={cn(
                      "w-full max-w-9 rounded-t",
                      day.min > 0 ? "bg-primary" : "bg-secondary",
                      day.isToday && "ring-1 ring-primary"
                    )}
                    style={{ height: `${height}px` }}
                  />
                </div>
                <span
                  className={cn(
                    "text-[10px] leading-none",
                    day.isToday ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {day.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Total {formatLogDuration(total7)} dalam 7 hari terakhir
        </p>
      </Card>
    </section>
  );
}
