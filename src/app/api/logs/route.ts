import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Akting",
  "Vokal & Musik",
  "Gerak & Tari",
  "Improvisasi",
  "Baca Naskah",
  "Teknis & Panggung",
  "Observasi",
  "Lainnya",
] as const;

const INTENSITIES = ["Rendah", "Sedang", "Tinggi"] as const;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

const logSchema = z.object({
  actorName: z
    .string()
    .trim()
    .min(1, "Nama aktor/kelompok wajib diisi.")
    .max(60, "Nama aktor/kelompok maksimal 60 karakter."),
  title: z
    .string()
    .trim()
    .min(1, "Judul latihan wajib diisi.")
    .max(120, "Judul latihan maksimal 120 karakter."),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus dalam format YYYY-MM-DD.")
    .refine((value) => {
      const [y, m, d] = value.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return (
        dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
      );
    }, "Tanggal tidak valid."),
  durationMin: z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = Number(v);
      return Number.isNaN(n) ? v : n;
    },
    z
      .number({ error: "Durasi wajib diisi." })
      .int("Durasi harus bilangan bulat menit.")
      .min(1, "Durasi minimal 1 menit.")
      .max(1440, "Durasi maksimal 1440 menit (24 jam).")
  ),
  category: z.enum(CATEGORIES, {
    error: "Kategori tidak valid.",
  }),
  intensity: z
    .enum(INTENSITIES, { error: "Intensitas tidak valid." })
    .default("Sedang"),
  mood: z
    .string()
    .max(8, "Mood tidak valid.")
    .default("🙂"),
  notes: z
    .string()
    .max(2000, "Catatan maksimal 2000 karakter.")
    .default(""),
});

/** Parse "YYYY-MM-DD" into a local Date (midnight, local time) — avoids timezone shifts. */
function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getString(form: FormData, key: string): string | null {
  const value = form.get(key);
  return typeof value === "string" ? value : null;
}

export async function GET() {
  try {
    const logs = await db.practiceLog.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ logs });
  } catch (error) {
    console.error("GET /api/logs failed:", error);
    return NextResponse.json(
      { error: "Gagal memuat log latihan. Coba lagi nanti." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Format permintaan tidak valid." },
      { status: 400 }
    );
  }

  const parsed = logSchema.safeParse({
    actorName: getString(form, "actorName") ?? "",
    title: getString(form, "title") ?? "",
    date: getString(form, "date") ?? "",
    durationMin: getString(form, "durationMin") ?? "",
    category: getString(form, "category") ?? "",
    intensity: getString(form, "intensity") || undefined,
    mood: getString(form, "mood") || undefined,
    notes: getString(form, "notes") || undefined,
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { actorName, title, date, durationMin, category, intensity, mood, notes } =
    parsed.data;

  // --- Optional image handling ---
  let imagePath: string | null = null;
  const imageEntry = form.get("image");

  if (imageEntry && imageEntry instanceof File && imageEntry.size > 0) {
    if (!imageEntry.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Foto harus berupa berkas gambar (JPG/PNG)." },
        { status: 400 }
      );
    }
    if (imageEntry.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Ukuran foto maksimal 8MB." },
        { status: 400 }
      );
    }

    try {
      const buffer = Buffer.from(await imageEntry.arrayBuffer());
      const processed = await sharp(buffer)
        .rotate() // auto-rotate based on EXIF
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadsDir, { recursive: true });

      const fileName = `${randomUUID()}.jpg`;
      await writeFile(path.join(uploadsDir, fileName), processed);
      imagePath = `/uploads/${fileName}`;
    } catch (error) {
      console.error("Image processing failed:", error);
      return NextResponse.json(
        { error: "Gagal memproses foto. Coba foto lain." },
        { status: 400 }
      );
    }
  }

  try {
    const log = await db.practiceLog.create({
      data: {
        actorName,
        title,
        date: parseLocalDate(date),
        durationMin,
        category,
        intensity,
        mood,
        notes,
        imagePath,
      },
    });
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("POST /api/logs failed:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan latihan. Coba lagi." },
      { status: 500 }
    );
  }
}
