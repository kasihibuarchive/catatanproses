"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { dateKey, type PracticeLog } from "@/lib/panggung";
import {
  renderStoryBlob,
  renderStoryDataUrl,
  STORY_TEMPLATES,
  storyDataFromLog,
  storySampleData,
} from "@/lib/story-templates";

/** Thumbnail pemilih templat dirender sekali (data contoh) lalu dicache. */
const thumbCache = new Map<string, string>();

/**
 * Panel inline (bukan dialog) untuk memilih templat story ala Strava:
 * pratinjau 9:16 + unduh PNG 1080×1920.
 */
export function StoryPanel({ log }: { log: PracticeLog }) {
  const [tplId, setTplId] = useState(STORY_TEMPLATES[0].id);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewUrlRef = useRef<string | null>(null);

  // Thumbnails — sekali per mount, dari cache bila sudah ada.
  useEffect(() => {
    let alive = true;
    (async () => {
      const missing = STORY_TEMPLATES.filter((t) => !thumbCache.has(t.id));
      if (missing.length === 0) {
        if (alive) {
          setThumbUrls(Object.fromEntries(thumbCache));
        }
        return;
      }
      const sample = storySampleData();
      for (const t of missing) {
        try {
          const url = await renderStoryDataUrl(t.id, sample, 0.1);
          thumbCache.set(t.id, url);
        } catch {
          // Thumbnail gagal — biarkan tombol placeholder.
        }
      }
      if (alive) setThumbUrls(Object.fromEntries(thumbCache));
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Pratinjau mengikuti templat terpilih (skala 0.36 → 389×691, cukup tajam).
  useEffect(() => {
    let alive = true;
    let localUrl: string | null = null;
    (async () => {
      try {
        const blob = await renderStoryBlob(
          tplId,
          storyDataFromLog(log),
          0.36
        );
        if (!alive) return;
        localUrl = URL.createObjectURL(blob);
        previewUrlRef.current = localUrl;
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return localUrl;
        });
      } catch {
        // Pratinjau gagal — biarkan placeholder; unduh tetap dicoba.
      }
    })();
    return () => {
      alive = false;
      if (localUrl && previewUrlRef.current === localUrl) {
        previewUrlRef.current = null;
      }
    };
  }, [tplId, log]);

  // Lepas URL pratinjau terakhir saat panel ditutup.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const meta = STORY_TEMPLATES.find((t) => t.id === tplId) ?? STORY_TEMPLATES[0];

  const download = async () => {
    setBusy(true);
    try {
      const blob = await renderStoryBlob(tplId, storyDataFromLog(log), 1);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `story-${tplId}-${dateKey(log.date)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success("Story 1080×1920 diunduh.");
    } catch {
      toast.error("Gagal membuat story.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-[3px] border border-foreground/15 bg-background/70 p-3">
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        <span
          aria-hidden
          className="font-kanji mr-1.5 text-[10px] normal-case tracking-[0.2em] text-seal/80"
        >
          アップロード
        </span>
        templat story · 1080×1920
      </p>

      {/* pemilih templat */}
      <div className="mt-2.5 flex gap-2" role="group" aria-label="Pilih templat story">
        {STORY_TEMPLATES.map((t) => {
          const active = t.id === tplId;
          const thumb = thumbUrls[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTplId(t.id)}
              aria-pressed={active}
              title={`${t.name} — ${t.hint}`}
              className={`shrink-0 rounded-[3px] border p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seal ${
                active
                  ? "border-seal bg-seal/5"
                  : "border-foreground/15 hover:border-foreground/40"
              }`}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt={`Templat ${t.name}`}
                  className="h-24 w-[54px] rounded-[2px] object-cover"
                />
              ) : (
                <div className="h-24 w-[54px] animate-pulse rounded-[2px] bg-foreground/5" />
              )}
            </button>
          );
        })}
      </div>

      {/* pratinjau + aksi */}
      <div className="mt-3 flex items-start gap-4">
        <div className="shrink-0 rounded-[3px] border border-foreground/15 bg-white p-1 shadow-[0_1px_4px_rgba(60,50,30,0.10)]">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`Pratinjau story templat ${meta.name}`}
              className="h-64 w-36 rounded-[2px] object-cover"
            />
          ) : (
            <div className="h-64 w-36 animate-pulse rounded-[2px] bg-foreground/5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-sm">
            {meta.name}
            <span aria-hidden className="font-kanji ml-1.5 text-[11px] text-seal/80">
              {meta.kanji}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>
          <button
            type="button"
            onClick={download}
            disabled={busy || !previewUrl}
            className="mt-3 inline-flex h-8 items-center rounded-[3px] border border-foreground/20 px-3 text-xs font-medium transition-colors hover:border-seal hover:text-seal disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seal"
          >
            {busy ? "menyiapkan…" : "unduh PNG"}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            pas buat IG story / WhatsApp status
          </p>
        </div>
      </div>
    </div>
  );
}
