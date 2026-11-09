import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { getDb, uploadPath } from "./db.ts";

export const MAX_STL_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function looksLikeStl(buf: Buffer): boolean {
  if (buf.length >= 84 && 84 + buf.readUInt32LE(80) * 50 === buf.length) return true; // binary
  return buf.subarray(0, 5).toString("ascii").toLowerCase() === "solid"; // ascii
}

/** Identify an image by its magic bytes (never trust the filename or MIME type). */
export function sniffImage(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP")
    return "webp";
  return null;
}

export async function saveUpload(buf: Buffer, ext: string): Promise<string> {
  const name = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(uploadPath(name), buf);
  return name;
}

export async function removeUploads(...names: (string | null | undefined)[]) {
  await Promise.all(names.filter((n): n is string => !!n).map((n) => fs.rm(uploadPath(n), { force: true })));
}

/** Delete parts (fitments/reports cascade) and their files. */
export async function deleteParts(ids: number[]) {
  const db = getDb();
  for (const id of ids) {
    const row = db.prepare("SELECT file_path, image_path FROM parts WHERE id = ?").get(id) as
      | { file_path: string | null; image_path: string | null }
      | undefined;
    if (!row) continue;
    db.prepare("DELETE FROM parts WHERE id = ?").run(id);
    await removeUploads(row.file_path, row.image_path);
  }
}
