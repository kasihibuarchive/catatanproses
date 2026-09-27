import { NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseLocalDate } from "@/lib/panggung";
import { saveProcessedImage } from "@/lib/storage";

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
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
    .optional(),
});

/** Parse "YYYY-MM-DD" into a local-midnight Date; shared with PATCH via @/lib/panggung. */

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
    date: getString(form, "date") ?? undefined,
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { actorName, title, durationMin, notes, date: dateInput } = parsed.data;

  // Date defaults to "today" (local midnight); a past date may be supplied.
  const now = new Date();
  let date = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateInput) {
    const parsedDate = parseLocalDate(dateInput);
    if (!parsedDate) {
      return NextResponse.json(
        { error: "Tanggal tidak valid." },
        { status: 400 }
      );
    }
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (parsedDate.getTime() > today.getTime()) {
      return NextResponse.json(
        { error: "Tanggal tidak boleh di masa depan." },
        { status: 400 }
      );
    }
    date = parsedDate;
  }

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

      // Vercel Blob saat deploy (BLOB_READ_WRITE_TOKEN ada), filesystem saat lokal.
      imagePath = await saveProcessedImage(processed);
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
