"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Clapperboard,
  Drama,
  LogIn,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { LogCard } from "@/components/panggung/log-card";
import { LogFormDialog } from "@/components/panggung/log-form-dialog";
import { StatsSection } from "@/components/panggung/stats-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  formatLogDuration,
  groupByMonthWeek,
  type PracticeLog,
} from "@/lib/panggung";

export default function Page() {
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/logs", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat log latihan.");
      const data = (await res.json()) as { logs: PracticeLog[] };
      setLogs(data.logs);
    } catch {
      setError("Tidak bisa memuat log latihan. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (categoryFilter !== "all" && log.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        log.actorName.toLowerCase().includes(q) ||
        log.title.toLowerCase().includes(q) ||
        log.notes.toLowerCase().includes(q)
      );
    });
  }, [logs, search, categoryFilter]);

  const groups = useMemo(() => groupByMonthWeek(filtered), [filtered]);

  const handleDelete = useCallback(
    async (log: PracticeLog) => {
      try {
        const res = await fetch(`/api/logs/${log.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Gagal menghapus log.");
        }
        toast.success("Log dihapus.");
        await refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus log.");
      }
    },
    [refresh]
  );

  const handleSubmitted = useCallback(
    (log: PracticeLog) => {
      setLogs((prev) => [log, ...prev]);
      void refresh();
    },
    [refresh]
  );

  const hasFilters = search.trim().length > 0 || categoryFilter !== "all";

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      {/* Subtle top spotlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-72"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, oklch(0.8 0.16 80 / 0.12), transparent 70%)",
        }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Drama className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none">Panggung</p>
              <p className="mt-1 text-[10px] font-medium uppercase leading-none tracking-widest text-muted-foreground">
                Log Latihan Teater
              </p>
            </div>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="h-11 w-11 p-0 sm:h-10 sm:w-auto sm:px-4"
            aria-label="Catat Latihan"
          >
            <Plus className="size-5 sm:size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Catat Latihan</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4">
        {/* Hero */}
        <section
          className="relative -mx-4 mb-4 overflow-hidden text-center"
          aria-label="Tentang Panggung"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Panggung teater kosong dengan sorotan lampu emas di antara tirai merah"
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          {/* Blend overlays: fade image into page background top & bottom */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-background"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0.16_0.01_60/0.55)_100%)]"
          />
          <div className="relative px-4 py-14 md:py-20">
            <Badge
              variant="outline"
              className="mb-5 gap-1.5 border-primary/40 bg-primary/10 text-primary"
            >
              <Drama className="size-3.5" aria-hidden="true" />
              Log latihan untuk komunitas teater
            </Badge>
            <h1 className="font-display text-3xl font-bold drop-shadow-[0_2px_12px_oklch(0.1_0_0/0.8)] md:text-5xl">
              Setiap latihan, satu langkah ke{" "}
              <span className="text-primary">panggung</span>.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-foreground/80 md:text-lg">
              Seperti Strava untuk teater — catat durasi, kesulitan, catatan, dan foto
              latihanmu hari ini.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="outline" className="gap-1.5 bg-background/60 backdrop-blur-sm">
                <LogIn className="size-3.5" aria-hidden="true" />
                Tanpa login
              </Badge>
              <Badge variant="outline" className="gap-1.5 bg-background/60 backdrop-blur-sm">
                <Camera className="size-3.5" aria-hidden="true" />
                Fotografis
              </Badge>
              <Badge variant="outline" className="gap-1.5 bg-background/60 backdrop-blur-sm">
                <Users className="size-3.5" aria-hidden="true" />
                Kolektif
              </Badge>
            </div>
          </div>
        </section>

        {/* Stats */}
        <StatsSection logs={logs} />

        {/* Feed */}
        <section className="flex flex-col gap-4 pb-16 pt-10" aria-label="Log latihan">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-bold">Log Latihan</h2>
              <Badge variant="secondary" aria-label={`${filtered.length} log`}>
                {filtered.length}
              </Badge>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, judul, atau catatan…"
                  className="h-11 pl-9"
                  aria-label="Cari log latihan"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger
                  className="h-11 w-full sm:w-56"
                  aria-label="Filter kategori"
                >
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                  <Skeleton className="mt-4 h-5 w-2/3" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card className="p-10 text-center">
              <CardContent className="flex flex-col items-center gap-3 p-0">
                <Clapperboard className="size-10 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button onClick={() => void refresh()}>Coba Lagi</Button>
              </CardContent>
            </Card>
          ) : logs.length === 0 ? (
            <Card className="py-16 text-center">
              <CardContent className="flex flex-col items-center gap-3 p-4">
                <Drama className="size-12 text-muted-foreground" aria-hidden="true" />
                <p className="font-display text-xl font-semibold">
                  Belum ada log latihan
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Jadilah yang pertama mencatat latihan hari ini — seperti membuka
                  tiras panggung 🎭
                </p>
                <Button className="mt-2" onClick={() => setDialogOpen(true)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Catat Latihan Pertama
                </Button>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="py-10 text-center">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">
                  Tidak ada log yang cocok dengan pencarian.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((month) => (
                <div key={month.key} className="flex flex-col gap-4">
                  <div className="sticky top-16 z-30 -mx-4 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
                    <h3 className="font-display text-lg font-semibold">
                      {month.label}
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {formatLogDuration(month.totalMin)}
                    </span>
                  </div>

                  {month.weeks.map((week) => (
                    <div key={week.key} className="flex flex-col gap-3">
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-sm font-medium">{week.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {week.logs.length} sesi · total{" "}
                          {formatLogDuration(week.totalMin)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-4">
                        {week.logs.map((log) => (
                          <LogCard key={log.id} log={log} onDelete={handleDelete} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {hasFilters && !loading && !error && logs.length > 0 && (
            <p className="sr-only" aria-live="polite">
              {filtered.length} log cocok dengan filter.
            </p>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-auto border-t bg-background/80 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center backdrop-blur">
        <p className="text-sm text-muted-foreground">
          Panggung 🎭 — catat latihanmu, rayakan progresmu.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Data tersimpan lokal di perangkat server ini.
        </p>
      </footer>

      <LogFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}
