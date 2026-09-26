import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { z } from "zod";
import { db } from "@/lib/db";

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
    durationMin: z
      .number({ error: "Durasi wajib diisi." })
      .int("Durasi harus bilangan bulat menit.")
      .min(1, "Durasi minimal 1 menit.")
      .max(1440, "Durasi maksimal 1440 menit (24 jam)."),
    notes: z.string().max(2000, "Catatan maksimal 2000 karakter."),
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
    const existing = await db.practiceLog.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Log tidak ditemukan." }, { status: 404 });
    }

    const log = await db.practiceLog.update({
      where: { id },
      data: parsed.data,
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
    const log = await db.practiceLog.findUnique({ where: { id } });
    if (!log) {
      return NextResponse.json({ error: "Log tidak ditemukan." }, { status: 404 });
    }

    // Best-effort cleanup of the associated image file.
    if (log.imagePath && log.imagePath.startsWith("/uploads/")) {
      try {
        const uploadsRoot = path.join(process.cwd(), "public", "uploads");
        const target = path.join(process.cwd(), "public", path.normalize(log.imagePath));
        if (target.startsWith(uploadsRoot)) {
          await unlink(target);
        }
      } catch {
        // Ignore unlink errors (file may already be gone).
      }
    }

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
