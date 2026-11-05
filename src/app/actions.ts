"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canManage,
  createSession,
  destroySession,
  hashPassword,
  requireAdmin,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { CATEGORIES, MATERIALS } from "@/lib/constants";
import { getDb } from "@/lib/db";
import {
  deleteParts,
  looksLikeStl,
  MAX_IMAGE_BYTES,
  MAX_STL_BYTES,
  removeUploads,
  saveUpload,
  sniffImage,
} from "@/lib/storage";

export type FormState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const MAX_PARTS_PER_HOUR = 10;

// ---------- accounts ----------

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username");
  const password = String(fd.get("password") ?? "");
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(username))
    return { error: "Username must be 3-24 characters: letters, numbers, _ or -." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username))
    return { error: "That username is taken." };
  // The very first account becomes the site admin.
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  const res = db
    .prepare("INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)")
    .run(username, hashPassword(password), n === 0 ? 1 : 0);
  await createSession(Number(res.lastInsertRowid));
  redirect("/");
}

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username");
  const password = String(fd.get("password") ?? "");
  const row = getDb()
    .prepare("SELECT id, password_hash FROM users WHERE username = ?")
    .get(username) as { id: number; password_hash: string } | undefined;
  if (!row || !verifyPassword(password, row.password_hash))
    return { error: "Wrong username or password." };
  await createSession(row.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------- parts ----------

function cleanUrl(raw: string): string | null | undefined {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

type PartRow = { user_id: number; file_name: string | null; file_path: string | null; file_size: number | null; image_path: string | null };

/** Create a part, or update one when the form carries an `id`. */
export async function savePart(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const db = getDb();

  const editId = Number(fd.get("id")) || null;
  let existing: PartRow | undefined;
  if (editId) {
    existing = db
      .prepare("SELECT user_id, file_name, file_path, file_size, image_path FROM parts WHERE id = ?")
      .get(editId) as PartRow | undefined;
    if (!existing || !canManage(user, existing.user_id)) return { error: "You can't edit this part." };
  } else if (!user.isAdmin) {
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM parts WHERE user_id = ? AND created_at > datetime('now','-1 hour')")
      .get(user.id) as { n: number };
    if (n >= MAX_PARTS_PER_HOUR) return { error: "You've posted a lot of parts recently — try again in a while." };
  }

  const title = str(fd, "title");
  const description = str(fd, "description");
  const category = str(fd, "category");
  const material = str(fd, "material");
  const universal = fd.get("universal") === "on";
  const creatorName = str(fd, "creator_name") || null;
  const sourceUrl = cleanUrl(str(fd, "source_url"));
  const file = fd.get("file");
  const image = fd.get("image");
  const removeImage = fd.get("remove_image") === "on";
  const vehicleIds = [...new Set(fd.getAll("vehicle").map(Number))].filter(Number.isInteger);

  if (title.length < 3 || title.length > 120) return { error: "Title must be 3-120 characters." };
  if (description.length > 4000) return { error: "Description is too long." };
  if (!(CATEGORIES as readonly string[]).includes(category)) return { error: "Pick a category." };
  if (material && !(MATERIALS as readonly string[]).includes(material)) return { error: "Unknown material." };
  if (sourceUrl === undefined) return { error: "Source link must be a valid http(s) URL." };
  const newFile = file instanceof File && file.size > 0 ? file : null;
  const newImage = image instanceof File && image.size > 0 ? image : null;
  if (!newFile && !existing?.file_path && !sourceUrl)
    return { error: "Upload an STL file or give a link to the original." };
  if (!universal && vehicleIds.length === 0)
    return { error: "Choose at least one vehicle it fits, or mark it universal." };

  if (vehicleIds.length) {
    const marks = vehicleIds.map(() => "?").join(",");
    const { n } = db.prepare(`SELECT COUNT(*) AS n FROM vehicles WHERE id IN (${marks})`).get(...vehicleIds) as { n: number };
    if (n !== vehicleIds.length) return { error: "Unknown vehicle selected." };
  }

  let fileBuf: Buffer | null = null;
  if (newFile) {
    if (!newFile.name.toLowerCase().endsWith(".stl")) return { error: "Only .stl files are supported." };
    if (newFile.size > MAX_STL_BYTES) return { error: "STL is larger than 50 MB." };
    fileBuf = Buffer.from(await newFile.arrayBuffer());
    if (!looksLikeStl(fileBuf)) return { error: "That doesn't look like a valid STL file." };
  }
  let imageBuf: Buffer | null = null;
  let imageExt: string | null = null;
  if (newImage) {
    if (newImage.size > MAX_IMAGE_BYTES) return { error: "Photo is larger than 5 MB." };
    imageBuf = Buffer.from(await newImage.arrayBuffer());
    imageExt = sniffImage(imageBuf);
    if (!imageExt) return { error: "Photo must be a JPG, PNG or WebP image." };
  }

  const stored: string[] = [];
  let partId: number;
  const replaced: (string | null)[] = [];
  try {
    const filePath = fileBuf ? await saveUpload(fileBuf, "stl") : null;
    if (filePath) stored.push(filePath);
    const imagePath = imageBuf && imageExt ? await saveUpload(imageBuf, imageExt) : null;
    if (imagePath) stored.push(imagePath);

    const fileName = newFile ? path.basename(newFile.name).replace(/[^\w.\- ]/g, "_") : (existing?.file_name ?? null);
    const finalFilePath = filePath ?? existing?.file_path ?? null;
    const finalFileSize = fileBuf ? fileBuf.length : (existing?.file_size ?? null);
    const finalImage = imagePath ?? (removeImage ? null : (existing?.image_path ?? null));

    db.exec("BEGIN");
    try {
      if (editId) {
        db.prepare(
          `UPDATE parts SET title=?, description=?, category=?, material=?, universal=?, file_name=?, file_path=?,
             file_size=?, image_path=?, source_url=?, creator_name=? WHERE id=?`,
        ).run(title, description, category, material, universal ? 1 : 0, fileName, finalFilePath, finalFileSize, finalImage, sourceUrl, creatorName, editId);
        db.prepare("DELETE FROM fitments WHERE part_id = ?").run(editId);
        partId = editId;
      } else {
        const res = db
          .prepare(
            `INSERT INTO parts (user_id, title, description, category, material, universal,
               file_name, file_path, file_size, image_path, source_url, creator_name)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(user.id, title, description, category, material, universal ? 1 : 0, fileName, finalFilePath, finalFileSize, finalImage, sourceUrl, creatorName);
        partId = Number(res.lastInsertRowid);
      }
      const ins = db.prepare("INSERT INTO fitments (part_id, vehicle_id) VALUES (?,?)");
      for (const id of vehicleIds) ins.run(partId, id);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    // Committed: remember files that were replaced or removed.
    if (existing) {
      if (filePath) replaced.push(existing.file_path);
      if (finalImage !== existing.image_path) replaced.push(existing.image_path);
    }
  } catch (e) {
    await removeUploads(...stored);
    throw e;
  }
  await removeUploads(...replaced);
  revalidatePath("/", "layout");
  redirect(`/parts/${partId}`);
}

export async function deletePart(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  const row = getDb().prepare("SELECT user_id FROM parts WHERE id = ?").get(id) as { user_id: number } | undefined;
  if (!row || !canManage(user, row.user_id)) return;
  await deleteParts([id]);
  revalidatePath("/", "layout");
  redirect(user.isAdmin && user.id !== row.user_id ? "/admin" : "/me");
}

// ---------- moderation ----------

export async function reportPart(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const partId = Number(fd.get("part_id"));
  const reason = str(fd, "reason");
  if (reason.length < 5 || reason.length > 500) return { error: "Please describe the problem (5-500 characters)." };
  const db = getDb();
  if (!db.prepare("SELECT 1 FROM parts WHERE id = ?").get(partId)) return { error: "That part no longer exists." };
  if (db.prepare("SELECT 1 FROM reports WHERE part_id = ? AND user_id = ? AND resolved = 0").get(partId, user.id))
    return { error: "You already reported this part — an admin will look at it." };
  db.prepare("INSERT INTO reports (part_id, user_id, reason) VALUES (?,?,?)").run(partId, user.id, reason);
  return { ok: "Thanks — an admin will review it." };
}

export async function resolveReport(fd: FormData) {
  await requireAdmin();
  getDb().prepare("UPDATE reports SET resolved = 1 WHERE id = ?").run(Number(fd.get("id")));
  revalidatePath("/admin");
}

export async function adminDeletePart(fd: FormData) {
  await requireAdmin();
  await deleteParts([Number(fd.get("id"))]);
  revalidatePath("/", "layout");
}

export async function adminDeleteUser(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  if (id === admin.id) return;
  const db = getDb();
  const ids = db.prepare("SELECT id FROM parts WHERE user_id = ?").all(id).map((r) => Number(r.id));
  await deleteParts(ids);
  db.prepare("DELETE FROM users WHERE id = ?").run(id); // sessions + reports cascade
  revalidatePath("/", "layout");
}

export async function adminToggleAdmin(fd: FormData) {
  const admin = await requireAdmin();
  const id = Number(fd.get("id"));
  if (id === admin.id) return; // never lock yourself out
  getDb().prepare("UPDATE users SET is_admin = 1 - is_admin WHERE id = ?").run(id);
  revalidatePath("/admin");
}
