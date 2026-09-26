import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

const logSchema = z.object({
  actorName: z
    .string()
    .trim()
    .min(1, "Nama wajib diisi.")
    .max(60, "Nama maksimal 60 karakter."),
  title: z
    .string()
    .trim()
    .min(1, "Judul latihan wajib diisi.")
    .max(120, "Judul latihan maksimal 120 karakter."),
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
  notes: z.string().max(2000, "Catatan maksimal 2000 karakter.").default(""),
});

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
    durationMin: getString(form, "durationMin") ?? "",
    notes: getString(form, "notes") ?? "",
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { actorName, title, durationMin, notes } = parsed.data;

  // Date is always "today" (local midnight).
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

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
        date,
        durationMin,
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
