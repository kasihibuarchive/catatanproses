import { NextResponse } from "next/server";
import { z } from "zod";
import { db, ensureSchema } from "@/lib/db";
import { parseLocalDate } from "@/lib/panggung";
import { deleteImage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    actorName: z.string().trim().min(1, "Nama wajib diisi.").max(60, "Nama maksimal 60 karakter."),
    title: z
      .string()
      .trim()
      .min(1, "Judul latihan wajib diisi.")
      .max(120, "Judul latihan maksimal 120 karakter."),
    notes: z.string().max(2000, "Catatan maksimal 2000 karakter."),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
      .optional(),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Data yang dikirim tidak valid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    await ensureSchema();
    const existing = await db.practiceLog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Log tidak ditemukan." }, { status: 404 });
    }

    const { date: dateInput, ...fields } = parsed.data;
    const data: {
      actorName?: string;
      title?: string;
      notes?: string;
      date?: Date;
    } = fields;

    if (dateInput !== undefined) {
      const parsedDate = parseLocalDate(dateInput);
      if (!parsedDate) {
        return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
      }
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (parsedDate.getTime() > today.getTime()) {
        return NextResponse.json(
          { error: "Tanggal tidak boleh di masa depan." },
          { status: 400 }
        );
      }
      data.date = parsedDate;
    }

    const log = await db.practiceLog.update({
      where: { id },
      data,
    });
    return NextResponse.json({ log });
  } catch (error) {
    console.error("PATCH /api/logs/[id] failed:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui catatan. Coba lagi." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await ensureSchema();
    const log = await db.practiceLog.findUnique({ where: { id } });
    if (!log) {
      return NextResponse.json({ error: "Log tidak ditemukan." }, { status: 404 });
    }

    // Best-effort cleanup of the associated image (Blob URL atau file lokal).
    await deleteImage(log.imagePath);

    await db.practiceLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/logs/[id] failed:", error);
    return NextResponse.json(
      { error: "Gagal menghapus log latihan." },
      { status: 500 }
    );
  }
}
