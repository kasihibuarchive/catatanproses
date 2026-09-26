"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTOR_NAME_STORAGE_KEY,
  dateKey,
  formatDuration,
  groupByMonthWeek,
  toDateKey,
  type PracticeLog,
} from "@/lib/panggung";

export default function Page() {
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreated = useCallback(
    (log: PracticeLog) => {
      setLogs((prev) => [log, ...prev]);
    },
    []
  );

  const handleDeleted = useCallback((id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const handleUpdated = useCallback((updated: PracticeLog) => {
    setLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }, []);

  const totalMin = logs.reduce((sum, l) => sum + l.durationMin, 0);
  const groups = groupByMonthWeek(logs);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-5">
          <p className="text-sm font-semibold tracking-tight">Log Latihan Teater</p>
          <p className="text-xs text-muted-foreground">
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
        <LogForm onCreated={handleCreated} />

        {/* Summary */}
        {!loading && !error && logs.length > 0 && (
          <p className="mb-6 text-sm tabular-nums text-muted-foreground">
            {logs.length} sesi · {formatDuration(totalMin)} total
          </p>
        )}

        {/* Feed */}
        {loading ? (
          <div className="space-y-3 pb-16">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-24 rounded-lg border" />
            <div className="h-24 rounded-lg border" />
          </div>
        ) : error ? (
          <div className="pb-16 text-sm text-muted-foreground">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
              Coba lagi
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="pb-20">
            <p className="text-sm font-medium">Belum ada catatan.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Isi form di atas untuk mencatat latihan pertamamu.
            </p>
          </div>
        ) : (
          <div className="space-y-8 pb-16">
            {groups.map((month) => (
              <section key={month.key}>
                <div className="flex items-baseline justify-between border-b pb-2">
                  <h2 className="text-sm font-semibold">{month.label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(month.totalMin)}
                  </p>
                </div>
                {month.weeks.map((week) => (
                  <div key={week.key} className="mt-4">
                    <p className="text-xs text-muted-foreground">
                      {week.range} · {formatDuration(week.totalMin)}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {week.logs.map((log) => (
                        <LogRow
                          key={log.id}
                          log={log}
                          onDeleted={handleDeleted}
                          onUpdated={handleUpdated}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t">
        <div className="mx-auto w-full max-w-2xl px-5 py-5">
          <p className="text-xs text-muted-foreground">
            Catat latihan, lihat perkembangannya dari pekan ke pekan.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Form ---------- */

function LogForm({ onCreated }: { onCreated: (log: PracticeLog) => void }) {
  const [actorName, setActorName] = useState("");
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Prefill name from localStorage (client only).
  useEffect(() => {
    const saved = window.localStorage.getItem(ACTOR_NAME_STORAGE_KEY);
    if (saved) setActorName(saved);
  }, []);

  const pickPhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const reset = (keepName: boolean) => {
    if (!keepName) setActorName("");
    setTitle("");
    setDurationMin("");
    setNotes("");
    pickPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!actorName.trim()) return setFieldError("Isi nama dulu ya.");
    if (!title.trim()) return setFieldError("Tulis apa yang dilatih hari ini.");
    const duration = Number(durationMin);
    if (!durationMin || Number.isNaN(duration) || duration < 1) {
      return setFieldError("Isi durasi latihan (menit).");
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("actorName", actorName.trim());
      fd.set("title", title.trim());
      fd.set("durationMin", String(Math.round(duration)));
      fd.set("notes", notes.trim());

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
    <form onSubmit={submit} className="py-8" noValidate>
      <h1 className="text-lg font-semibold tracking-tight">Catat latihan hari ini</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Isi detilnya, tambahkan foto kalau ada, lalu kirim.
      </p>

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="actorName">Nama</Label>
            <Input
              id="actorName"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="Namamu atau nama kelompok"
              autoComplete="name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="durationMin">Durasi (menit)</Label>
            <Input
              id="durationMin"
              type="number"
              min={1}
              max={1440}
              inputMode="numeric"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="90"
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="title">Apa yang dilatih?</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="cth. Latihan bloking adegan 3"
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
                className="size-12 rounded-md border object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  pickPhoto(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                buang
              </button>
            </div>
          )}
        </div>

        {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}

        <Button type="submit" disabled={submitting} className="w-full sm:w-auto sm:min-w-32">
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
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === toDateKey(yesterday)) return "Kemarin";
  return null;
}

function LogRow({
  log,
  onDeleted,
  onUpdated,
}: {
  log: PracticeLog;
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
    durationMin: String(log.durationMin),
    notes: log.notes,
  });

  const startEdit = () => {
    setDraft({
      actorName: log.actorName,
      title: log.title,
      durationMin: String(log.durationMin),
      notes: log.notes,
    });
    setEditError(null);
    setConfirming(false);
    setEditing(true);
  };

  const saveEdit = async () => {
    const name = draft.actorName.trim();
    const title = draft.title.trim();
    const duration = Number(draft.durationMin);
    if (!name) return setEditError("Nama tidak boleh kosong.");
    if (!title) return setEditError("Judul tidak boleh kosong.");
    if (!draft.durationMin || Number.isNaN(duration) || duration < 1) {
      return setEditError("Isi durasi (menit).");
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
          durationMin: Math.round(duration),
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

  if (editing) {
    return (
      <li className="rounded-lg border border-foreground/25 p-4">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={draft.actorName}
              onChange={(e) => setDraft({ ...draft, actorName: e.target.value })}
              aria-label="Nama"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
              autoFocus
            />
            <input
              value={draft.durationMin}
              onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })}
              type="number"
              min={1}
              max={1440}
              inputMode="numeric"
              aria-label="Durasi (menit)"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm tabular-nums outline-none focus:border-foreground/40"
            />
          </div>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            aria-label="Apa yang dilatih"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
          />
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={3}
            aria-label="Catatan"
            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
          />
          {editError && <p className="text-sm text-destructive">{editError}</p>}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              batal
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="text-xs font-semibold underline underline-offset-2 disabled:opacity-50"
            >
              {saving ? "menyimpan…" : "simpan"}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-lg border p-4 transition-colors hover:border-foreground/25">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">{log.actorName}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {dayLabel} · {formatDuration(log.durationMin)}
        </p>
      </div>
      <p className="mt-1 text-sm">{log.title}</p>
      {log.notes && (
        <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
          {log.notes}
        </p>
      )}
      {log.imagePath && (
        <a href={log.imagePath} target="_blank" rel="noreferrer" className="mt-3 block">
          <img
            src={log.imagePath}
            alt={`Foto latihan ${log.title}`}
            loading="lazy"
            className="max-h-80 w-full rounded-md border object-cover"
          />
        </a>
      )}
      <div className="mt-3 flex justify-end gap-4">
        <button
          type="button"
          onClick={startEdit}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          ubah
        </button>
        <button
          type="button"
          onClick={remove}
          onBlur={() => setConfirming(false)}
          className={`text-xs underline underline-offset-2 ${
            confirming ? "text-destructive" : "text-muted-foreground hover:text-foreground"
          }`}
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
