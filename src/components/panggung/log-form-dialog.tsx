"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTOR_NAME_STORAGE_KEY,
  CATEGORIES,
  INTENSITIES,
  MAX_IMAGE_BYTES,
  MOODS,
  todayKey,
  type PracticeLog,
} from "@/lib/panggung";
import { cn } from "@/lib/utils";

const DURATION_PRESETS = [30, 60, 90, 120, 180];

interface LogFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (log: PracticeLog) => void;
}

interface FieldErrors {
  actorName?: string;
  title?: string;
  date?: string;
  duration?: string;
  image?: string;
}

/** Client-side downscale: max 1600px, JPEG quality 0.85. */
async function downscaleImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Gagal membaca gambar."));
      img.src = url;
    });

    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak didukung.");
    ctx.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Gagal memproses gambar."))),
        "image/jpeg",
        0.85
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function LogFormDialog({ open, onOpenChange, onSubmitted }: LogFormDialogProps) {
  const [actorName, setActorName] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayKey());
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("Akting");
  const [intensity, setIntensity] = useState<string>("Sedang");
  const [mood, setMood] = useState<string>("🙂");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxDate = todayKey();

  // Prefill actor name from localStorage each time the dialog opens.
  useEffect(() => {
    if (open) {
      try {
        setActorName(localStorage.getItem(ACTOR_NAME_STORAGE_KEY) ?? "");
      } catch {
        // localStorage might be unavailable — ignore.
      }
    }
  }, [open]);

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, image: "Berkas harus gambar (JPG/PNG)." }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({ ...prev, image: "Ukuran foto maksimal 8MB." }));
      return;
    }
    setErrors((prev) => ({ ...prev, image: undefined }));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function removeImage() {
    clearImage();
    setErrors((prev) => ({ ...prev, image: undefined }));
  }

  const requiredFilled =
    actorName.trim().length > 0 &&
    title.trim().length > 0 &&
    date.length > 0 &&
    duration.length > 0 &&
    Number(duration) >= 1;

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!actorName.trim()) next.actorName = "Nama wajib diisi.";
    else if (actorName.trim().length > 60)
      next.actorName = "Nama maksimal 60 karakter.";
    if (!title.trim()) next.title = "Judul wajib diisi.";
    else if (title.trim().length > 120) next.title = "Judul maksimal 120 karakter.";
    if (!date) next.date = "Tanggal wajib diisi.";
    const dur = Number(duration);
    if (!duration || Number.isNaN(dur) || dur < 1)
      next.duration = "Durasi minimal 1 menit.";
    else if (dur > 1440) next.duration = "Durasi maksimal 1440 menit.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("actorName", actorName.trim());
      fd.set("title", title.trim());
      fd.set("date", date);
      fd.set("durationMin", String(Math.round(Number(duration))));
      fd.set("category", category);
      fd.set("intensity", intensity);
      fd.set("mood", mood);
      fd.set("notes", notes);
      if (imageFile) {
        let blob: Blob = imageFile;
        try {
          blob = await downscaleImage(imageFile);
        } catch {
          // Fall back to the original file if downscaling fails.
        }
        fd.set("image", blob, "latihan.jpg");
      }

      const res = await fetch("/api/logs", { method: "POST", body: fd });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Gagal menyimpan latihan.");
      }
      const data = (await res.json()) as { log: PracticeLog };

      try {
        localStorage.setItem(ACTOR_NAME_STORAGE_KEY, actorName.trim());
      } catch {
        // Ignore storage errors.
      }

      toast.success("Latihan tercatat! 🎭");

      // Reset fields (keep actorName).
      setTitle("");
      setDate(todayKey());
      setDuration("");
      setCategory("Akting");
      setIntensity("Sedang");
      setMood("🙂");
      setNotes("");
      clearImage();
      setErrors({});

      onSubmitted(data.log);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan latihan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-scroll max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold">
            Catat Latihan
          </DialogTitle>
          <DialogDescription>
            Isi detil latihanmu hari ini — nanti muncul di log.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="actorName">Nama Aktor/Kelompok *</Label>
            <Input
              id="actorName"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="cth. Raka / Sanggar Senja"
              maxLength={60}
              autoComplete="off"
            />
            {errors.actorName && (
              <p className="text-xs text-destructive">{errors.actorName}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Judul Latihan *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="cth. Bloking Adegan 3 Babak Akhir"
              maxLength={120}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Tanggal *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              max={maxDate}
              onChange={(e) => setDate(e.target.value)}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="duration">Durasi (menit) *</Label>
            <Input
              id="duration"
              type="number"
              inputMode="numeric"
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="cth. 90"
            />
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => {
                const active = Number(duration) === preset;
                return (
                  <Button
                    key={preset}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    className="h-9 min-w-11"
                    aria-pressed={active}
                    onClick={() => setDuration(String(preset))}
                  >
                    {preset}
                  </Button>
                );
              })}
            </div>
            {errors.duration && (
              <p className="text-xs text-destructive">{errors.duration}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Kategori *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    <span className="flex items-center gap-2">
                      <c.icon className="size-4" aria-hidden="true" />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Intensitas</Label>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Intensitas latihan">
              {INTENSITIES.map((level) => {
                const active = intensity === level;
                return (
                  <Button
                    key={level}
                    type="button"
                    variant={active ? "default" : "outline"}
                    className="h-11"
                    aria-pressed={active}
                    onClick={() => setIntensity(level)}
                  >
                    {level}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Mood</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Mood latihan">
              {MOODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mood === m}
                  aria-label={`Mood ${m}`}
                  onClick={() => setMood(m)}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full text-xl transition",
                    mood === m
                      ? "bg-accent ring-2 ring-primary"
                      : "bg-muted hover:bg-accent/60"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea
              id="notes"
              rows={4}
              value={notes}
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Apa yang dilatih? Kesulitan, temuan, catatan sutradara…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Foto (opsional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Pilih foto latihan"
            />
            {previewUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={previewUrl}
                  alt="Pratinjau foto latihan"
                  className="h-24 w-24 rounded-lg border object-cover"
                />
                <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {imageFile?.name ?? "latihan.jpg"}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="Hapus foto"
                  onClick={removeImage}
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex min-h-[88px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed bg-muted/30 px-4 py-6 text-sm transition hover:border-primary/50 hover:text-foreground"
              >
                <ImagePlus className="size-6 text-primary" aria-hidden="true" />
                <span className="font-medium">Tambah Foto</span>
                <span className="text-xs text-muted-foreground">
                  JPG/PNG, maks 8MB
                </span>
              </button>
            )}
            {errors.image && (
              <p className="text-xs text-destructive">{errors.image}</p>
            )}
          </div>

          <Button
            type="submit"
            className="h-11 w-full"
            disabled={submitting || !requiredFilled}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Menyimpan…
              </>
            ) : (
              "Simpan Latihan"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
