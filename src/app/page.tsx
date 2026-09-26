"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTOR_NAME_STORAGE_KEY,
  buildMonthSummary,
  dateKey,
  formatDuration,
  groupByMonthWeek,
  hoursToMinutes,
  minutesToHoursInput,
  monthActorCount,
  monthPhotoCount,
  monthSessionCount,
  toDateKey,
  WEEKDAY_KANJI,
  type MonthGroup,
  type PracticeLog,
} from "@/lib/panggung";
import { renderMonthSummaryBlob } from "@/lib/summary-image";

/** Quiet lowercase text-link used for all small actions. */
const textLink =
  "rounded-sm text-xs underline underline-offset-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** Ink underline input — quiet, like a brush line. */
const underlineInput =
  "h-10 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-1 text-sm shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-0 focus-visible:border-seal";

export default function Page() {
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/logs", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { logs: PracticeLog[] };
      setLogs(data.logs);
    } catch {
      setError("Tidak bisa memuat log. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreated = useCallback((log: PracticeLog) => {
    setLogs((prev) => {
      // Insert in feed order (date desc, createdAt desc) so backdated
      // entries land in the right place instead of always on top.
      const next = [...prev, log];
      next.sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return b.createdAt.localeCompare(a.createdAt);
      });
      return next;
    });
    setJustAddedId(log.id);
    window.setTimeout(() => {
      setJustAddedId((current) => (current === log.id ? null : current));
      document
        .getElementById(`log-${log.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
  }, []);

  const handleDeleted = useCallback((id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handleUpdated = useCallback((updated: PracticeLog) => {
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }, []);

  const totalMin = logs.reduce((sum, l) => sum + l.durationMin, 0);
  const groups = groupByMonthWeek(logs);

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* washi paper grain */}
      <div aria-hidden className="washi-grain pointer-events-none fixed inset-0 -z-10" />
      {/* vertical tategaki accent, wide screens only */}
      <p
        aria-hidden
        className="font-kanji fixed right-6 top-1/2 hidden -translate-y-1/2 select-none text-sm tracking-[0.6em] text-foreground/15 lg:block [writing-mode:vertical-rl]"
      >
        稽古日誌
      </p>

      {/* Header */}
      <header className="border-b border-foreground/10">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="font-kanji flex size-9 flex-col items-center justify-center rounded-[3px] bg-seal text-[11px] leading-[1.2] text-[#f7f2e6] ring-1 ring-inset ring-white/25"
            >
              <span>稽</span>
              <span>古</span>
            </span>
            <div>
              <p className="font-serif text-sm leading-tight tracking-wide">稽古日誌</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Log Latihan Teater
              </p>
            </div>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5">
        {/* Form */}
        <LogForm onCreated={handleCreated} lastLog={logs[0] ?? null} />

        {/* Summary */}
        {!loading && !error && logs.length > 0 && (
          <p aria-live="polite" className="mb-6 text-sm tabular-nums text-muted-foreground">
            {logs.length} sesi · {formatDuration(totalMin)} total
          </p>
        )}

        {/* Feed */}
        {loading ? (
          <div className="space-y-3 pb-16">
            <div className="h-5 w-40 rounded bg-foreground/5" />
            <div className="h-24 rounded-[3px] border border-foreground/10" />
            <div className="h-24 rounded-[3px] border border-foreground/10" />
          </div>
        ) : error ? (
          <div className="pb-16 text-sm text-muted-foreground">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
              Coba lagi
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="border-t border-foreground/10 pb-20 pt-12 text-center">
            <p aria-hidden className="font-kanji text-4xl text-foreground/15">
              空
            </p>
            <p className="mt-4 text-sm font-medium">Belum ada catatan.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Isi form di atas untuk mencatat latihan pertamamu.
            </p>
          </div>
        ) : (
          <div className="space-y-10 pb-16">
            {groups.map((month) => {
              const sessions = monthSessionCount(month);
              const people = monthActorCount(month);
              const photos = monthPhotoCount(month);
              return (
                <section key={month.key}>
                  {/* thick-thin double rule, Showa print style */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b-[3px] border-double border-foreground/25 pb-2">
                    <h2 className="font-serif text-base tracking-wide">
                      {month.label}
                      <span aria-hidden className="font-kanji ml-2 text-xs text-seal">
                        {Number(month.key.split("-")[1])}月
                      </span>
                      <span className="ml-2 text-xs font-sans font-normal tabular-nums text-muted-foreground">
                        {sessions} sesi
                        {people > 1 ? ` · ${people} orang` : ""}
                        {photos > 0 ? ` · ${photos} foto` : ""}
                      </span>
                    </h2>
                    <div className="flex shrink-0 items-baseline gap-3">
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {formatDuration(month.totalMin)}
                      </p>
                      <ShareMonthLink month={month} />
                      <span aria-hidden className="text-foreground/20">·</span>
                      <CopyMonthButton month={month} />
                      <span aria-hidden className="text-foreground/20">·</span>
                      <DownloadMonthImage month={month} />
                    </div>
                  </div>
                  {month.weeks.map((week) => (
                    <div key={week.key} className="mt-5">
                      <p className="text-xs tracking-wide text-muted-foreground">
                        {week.range} · {formatDuration(week.totalMin)}
                      </p>
                      <ul className="mt-2 space-y-2">
                        {week.logs.map((log) => (
                          <LogRow
                            key={log.id}
                            log={log}
                            justAdded={log.id === justAddedId}
                            onDeleted={handleDeleted}
                            onUpdated={handleUpdated}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-foreground/10">
        <div className="mx-auto flex w-full max-w-2xl items-start justify-between gap-4 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
          <div>
            <p className="font-kanji text-sm tracking-[0.3em] text-foreground/70">継続は力なり</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Keizoku wa chikara nari — konsistensi adalah kekuatan.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              })
            }
            className={`${textLink} shrink-0 pt-0.5`}
          >
            ↑ atas
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Copy month summary ---------- */

/** Quiet link that opens WhatsApp with the month recap pre-filled. */
function ShareMonthLink({ month }: { month: MonthGroup }) {
  const href = `https://wa.me/?text=${encodeURIComponent(buildMonthSummary(month))}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Bagikan ringkasan bulan ini via WhatsApp"
      className={textLink}
    >
      whatsapp
    </a>
  );
}

/** Quiet link that renders the month recap as a washi PNG poster and downloads it. */
function DownloadMonthImage({ month }: { month: MonthGroup }) {
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderMonthSummaryBlob(month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kekiro-${month.key}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("Gambar ringkasan diunduh.");
    } catch {
      toast.error("Gagal membuat gambar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={download} disabled={busy} className={textLink}>
      {busy ? "menyiapkan…" : "gambar"}
    </button>
  );
}

function CopyMonthButton({ month }: { month: MonthGroup }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildMonthSummary(month));
      toast.success("Ringkasan disalin.");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Gagal menyalin.");
    }
  };

  return (
    <button type="button" onClick={copy} className={textLink}>
      {copied ? "tersalin" : "salin"}
    </button>
  );
}

/* ---------- Form ---------- */

const DURATION_CHIPS: { label: string; hours: number }[] = [
  { label: "0,5", hours: 0.5 },
  { label: "1", hours: 1 },
  { label: "1,5", hours: 1.5 },
  { label: "2", hours: 2 },
  { label: "3", hours: 3 },
];

function LogForm({
  onCreated,
  lastLog,
}: {
  onCreated: (log: PracticeLog) => void;
  lastLog: PracticeLog | null;
}) {
  const [actorName, setActorName] = useState("");
  const [title, setTitle] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [notes, setNotes] = useState("");
  const [dateValue, setDateValue] = useState(""); // "" = today
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [todayKey, setTodayKey] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill name from localStorage (client only).
  useEffect(() => {
    const saved = window.localStorage.getItem(ACTOR_NAME_STORAGE_KEY);
    if (saved) setActorName(saved);
    setTodayKey(toDateKey(new Date()));
  }, []);

  const isToday = !dateValue || (todayKey !== "" && dateValue === todayKey);
  const isYesterday =
    !isToday &&
    todayKey !== "" &&
    dateValue === toDateKey(new Date(Date.now() - 86400000));

  // "Use last practice" is only useful while the form is still blank.
  const canReuse = Boolean(lastLog) && !title && !durationHours && !notes;
  const reuseLast = () => {
    if (!lastLog) return;
    setTitle(lastLog.title);
    setDurationHours(minutesToHoursInput(lastLog.durationMin));
    setNotes(lastLog.notes);
  };

  const pickedDateLabel =
    dateValue && !isToday
      ? new Date(`${dateValue}T00:00:00`).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
        })
      : "hari ini";

  const pickPhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const reset = (keepName: boolean) => {
    if (!keepName) setActorName("");
    setTitle("");
    setDurationHours("");
    setNotes("");
    setDateValue("");
    setShowDatePicker(false);
    pickPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setFieldError(null);

    if (!actorName.trim()) return setFieldError("Isi nama/divisi dulu ya.");
    if (!title.trim()) return setFieldError("Tulis apa yang dilatih hari ini.");
    const minutes = hoursToMinutes(durationHours);
    if (minutes === null || minutes < 1) {
      return setFieldError("Isi durasi latihan (jam).");
    }
    if (minutes > 1440) {
      return setFieldError("Durasi maksimal 24 jam.");
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("actorName", actorName.trim());
      fd.set("title", title.trim());
      fd.set("durationMin", String(minutes));
      fd.set("notes", notes.trim());
      if (!isToday && dateValue) fd.set("date", dateValue);

      let file: File | null = photo;
      if (file) {
        // Downscale in the browser so uploads stay small.
        file = await downscaleImage(file);
        if (file) fd.set("image", file);
      }

      const res = await fetch("/api/logs", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as
        | { log?: PracticeLog; error?: string }
        | null;

      if (!res.ok || !data?.log) {
        throw new Error(data?.error ?? "Gagal menyimpan. Coba lagi.");
      }

      window.localStorage.setItem(ACTOR_NAME_STORAGE_KEY, actorName.trim());
      onCreated(data.log);
      reset(true);
      toast.success("Latihan tercatat.");
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : "Gagal menyimpan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          void submit();
        }
      }}
      className="pb-8 pt-10"
      noValidate
    >
      <p
        aria-hidden
        className="font-kanji text-xs tracking-[0.35em] text-seal"
      >
        {isToday ? "今日の稽古" : isYesterday ? "昨日の稽古" : "過去の稽古"}
      </p>
      <h1 className="mt-2 font-serif text-2xl tracking-tight">
        {isToday ? "Catat latihan hari ini" : `Catat latihan ${pickedDateLabel}`}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Isi detilnya, tambahkan foto kalau ada, lalu kirim.
      </p>
      {canReuse && (
        <p className="mt-2 text-xs text-muted-foreground">
          Latihan terakhir: “{lastLog?.title}” ·{" "}
          <button type="button" onClick={reuseLast} className={textLink}>
            pakai lagi
          </button>
        </p>
      )}

      {/* Date row — quiet by default, backdate on demand */}
      <div className="mt-4 min-h-9">
        {showDatePicker ? (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              value={dateValue}
              max={todayKey || undefined}
              onChange={(e) => setDateValue(e.target.value)}
              aria-label="Tanggal latihan"
              className="h-9 rounded-[3px] border border-foreground/15 bg-card/70 px-2 text-sm tabular-nums shadow-none outline-none transition-colors focus:border-seal"
            />
            <button
              type="button"
              onClick={() => setShowDatePicker(false)}
              className={textLink}
            >
              selesai
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tanggal: {pickedDateLabel} ·{" "}
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className={textLink}
            >
              ubah
            </button>
          </p>
        )}
      </div>

      <div className="mt-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="actorName">Nama/Divisi</Label>
            <Input
              id="actorName"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="cth. Raka — Divisi Akting"
              autoComplete="name"
              className={underlineInput}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="durationHours">Durasi (jam)</Label>
            <Input
              id="durationHours"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value)}
              placeholder="1,5"
              className={`${underlineInput} tabular-nums`}
            />
            <div className="flex items-center gap-1">
              {DURATION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setDurationHours(chip.label)}
                  aria-label={`Set durasi ${chip.label} jam`}
                  aria-pressed={durationHours === chip.label}
                  className={`rounded px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${
                    durationHours === chip.label ? "bg-foreground/5 text-foreground" : ""
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">Apa yang dilatih?</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="cth. Latihan bloking adegan 3"
            className={underlineInput}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Catatan (opsional)</Label>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Yang sulit, yang menemukan, catatan sutradara…"
            className="min-h-20 w-full resize-y rounded-[3px] border-foreground/15 bg-card/70 px-3 py-2 text-sm shadow-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-seal focus-visible:outline-none focus-visible:ring-0"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Pilih foto latihan"
            onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            {photo ? "Ganti foto" : "Tambah foto"}
          </Button>
          {photoPreview && (
            <div className="flex items-center gap-2">
              <img
                src={photoPreview}
                alt="Pratinjau foto latihan"
                className="size-12 rounded-[3px] border border-foreground/15 object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  pickPhoto(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className={textLink}
              >
                buang
              </button>
            </div>
          )}
        </div>

        {fieldError && (
          <p role="alert" className="text-sm text-destructive">
            {fieldError}
          </p>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full tracking-wide sm:w-auto sm:min-w-36"
        >
          {submitting ? "Mengirim…" : "Kirim"}
        </Button>
      </div>
    </form>
  );
}

/* ---------- Log row ---------- */

function relativeDayLabel(day: string): string | null {
  const today = toDateKey(new Date());
  if (day === today) return "Hari ini";
  const target = new Date(`${day}T00:00:00`).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  const diffDays = Math.round((now - target) / 86400000);
  if (diffDays === 1) return "Kemarin";
  if (diffDays >= 2 && diffDays <= 6) return `${diffDays} hari lalu`;
  return null;
}

function LogRow({
  log,
  justAdded,
  onDeleted,
  onUpdated,
}: {
  log: PracticeLog;
  justAdded: boolean;
  onDeleted: (id: string) => void;
  onUpdated: (log: PracticeLog) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    actorName: log.actorName,
    title: log.title,
    durationHours: minutesToHoursInput(log.durationMin),
    notes: log.notes,
  });

  const startEdit = () => {
    setDraft({
      actorName: log.actorName,
      title: log.title,
      durationHours: minutesToHoursInput(log.durationMin),
      notes: log.notes,
    });
    setEditError(null);
    setConfirming(false);
    setEditing(true);
  };

  const saveEdit = async () => {
    const name = draft.actorName.trim();
    const title = draft.title.trim();
    const minutes = hoursToMinutes(draft.durationHours);
    if (!name) return setEditError("Nama tidak boleh kosong.");
    if (!title) return setEditError("Judul tidak boleh kosong.");
    if (minutes === null || minutes < 1) {
      return setEditError("Isi durasi (jam).");
    }
    if (minutes > 1440) {
      return setEditError("Durasi maksimal 24 jam.");
    }

    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actorName: name,
          title,
          durationMin: minutes,
          notes: draft.notes.trim(),
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { log?: PracticeLog; error?: string }
        | null;
      if (!res.ok || !data?.log) {
        throw new Error(data?.error ?? "Gagal menyimpan perubahan.");
      }
      onUpdated(data.log);
      setEditing(false);
      toast.success("Perubahan tersimpan.");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      const res = await fetch(`/api/logs/${log.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(log.id);
      toast.success("Catatan dihapus.");
    } catch {
      toast.error("Gagal menghapus. Coba lagi.");
      setConfirming(false);
    }
  };

  const day = dateKey(log.date);
  const dayLabel =
    relativeDayLabel(day) ??
    new Date(`${day}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  const weekday = WEEKDAY_KANJI[new Date(`${day}T00:00:00`).getDay()];

  if (editing) {
    return (
      <li className="rounded-[3px] border border-foreground/30 bg-card p-4">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <input
              value={draft.actorName}
              onChange={(e) => setDraft({ ...draft, actorName: e.target.value })}
              aria-label="Nama/Divisi"
              className={underlineInput}
              autoFocus
            />
            <input
              value={draft.durationHours}
              onChange={(e) => setDraft({ ...draft, durationHours: e.target.value })}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Durasi (jam)"
              className={`${underlineInput} tabular-nums`}
            />
          </div>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            aria-label="Apa yang dilatih"
            className={underlineInput}
          />
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={3}
            aria-label="Catatan"
            className="w-full resize-y rounded-[3px] border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-seal"
          />
          {editError && (
            <p role="alert" className="text-sm text-destructive">
              {editError}
            </p>
          )}
          <div className="flex items-center justify-end gap-4">
            <button type="button" onClick={() => setEditing(false)} className={textLink}>
              batal
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="rounded-sm text-xs font-semibold underline underline-offset-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {saving ? "menyimpan…" : "simpan"}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      id={`log-${log.id}`}
      className={`rounded-[3px] border bg-card p-4 transition-colors hover:border-foreground/30 ${
        justAdded ? "entry-flash border-seal/40" : "border-foreground/10"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-sm font-bold">{log.actorName}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          <span aria-hidden className="font-kanji mr-1.5 text-[11px] text-seal/75">
            {weekday}
          </span>
          {dayLabel} · {formatDuration(log.durationMin)}
        </p>
      </div>
      <p className="mt-1 text-sm">{log.title}</p>
      {log.notes && (
        <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{log.notes}</p>
      )}
      {log.imagePath && (
        <a
          href={log.imagePath}
          target="_blank"
          rel="noreferrer"
          className={`group mt-4 block ${
            // Prints taped into a Showa photo album: a hairline white frame,
            // the faintest tilt, straightening on hover.
            log.id.charCodeAt(0) % 2 === 0 ? "-rotate-[0.4deg]" : "rotate-[0.4deg]"
          } transition-transform hover:rotate-0 motion-reduce:rotate-0 motion-reduce:transition-none`}
        >
          <img
            src={log.imagePath}
            alt={`Foto latihan ${log.title}`}
            loading="lazy"
            className="w-full rounded-[2px] border border-foreground/15 bg-white p-1 shadow-[0_1px_4px_rgba(60,50,30,0.10)] transition-opacity hover:opacity-90"
          />
        </a>
      )}
      <div className="mt-3 flex justify-end gap-4">
        <button type="button" onClick={startEdit} className={textLink}>
          ubah
        </button>
        <button
          type="button"
          onClick={remove}
          onBlur={() => setConfirming(false)}
          className={`${textLink} ${confirming ? "text-destructive hover:text-destructive" : ""}`}
        >
          {confirming ? "yakin? klik lagi" : "hapus"}
        </button>
      </div>
    </li>
  );
}

/* ---------- Image helper ---------- */

/** Downscale to max 1600px JPEG 0.85 in the browser. Returns null on failure. */
async function downscaleImage(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file; // fall back to the original file
  }
}
