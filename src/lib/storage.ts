import { del, put } from "@vercel/blob";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Penyimpanan foto latihan dengan dua jalur:
 *
 * 1. Vercel Blob (aktif saat BLOB_READ_WRITE_TOKEN tersedia — deployment Vercel).
 *    imagePath yang tersimpan = URL publik blob.
 * 2. Filesystem lokal (fallback — dev/sandbox): public/uploads/{uuid}.jpg,
 *    imagePath = /uploads/{uuid}.jpg.
 *
 * Kontrak feed tidak berubah: <img src={imagePath}> bekerja untuk keduanya.
 */

const isBlobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function saveProcessedImage(jpeg: Buffer): Promise<string> {
  if (isBlobEnabled()) {
    const blob = await put(`uploads/${randomUUID()}.jpg`, jpeg, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const fileName = `${randomUUID()}.jpg`;
  await writeFile(path.join(uploadsDir, fileName), jpeg);
  return `/uploads/${fileName}`;
}

/** Best-effort: gagal hapus file tidak boleh menggagalkan delete record. */
export async function deleteImage(imagePath: string | null): Promise<void> {
  if (!imagePath) return;
  try {
    if (/^https?:\/\//i.test(imagePath)) {
      if (isBlobEnabled()) await del(imagePath);
      return;
    }
    if (imagePath.startsWith("/uploads/")) {
      const uploadsRoot = path.join(process.cwd(), "public", "uploads");
      const target = path.join(process.cwd(), "public", path.normalize(imagePath));
      if (target.startsWith(uploadsRoot)) await unlink(target);
    }
  } catch {
    // File mungkin sudah terhapus — abaikan.
  }
}
