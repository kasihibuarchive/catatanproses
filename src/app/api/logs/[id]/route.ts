import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
