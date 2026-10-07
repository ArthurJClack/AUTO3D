"use server";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { createSession, destroySession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { getDb, uploadPath } from "@/lib/db";
import { CATEGORIES, MATERIALS } from "@/lib/constants";

export type FormState = { error?: string } | undefined;

const MAX_STL_BYTES = 50 * 1024 * 1024;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function signup(_: FormState, fd: FormData): Promise<FormState> {
  const username = str(fd, "username");
  const password = String(fd.get("password") ?? "");
  if (!/^[A-Za-z0-9_-]{3,24}$/.test(username))
    return { error: "Username must be 3-24 characters: letters, numbers, _ or -." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const db = getDb();
  if (db.prepare("SELECT 1 FROM users WHERE username = ?").get(username))
    return { error: "That username is taken." };
  const res = db
    .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run(username, hashPassword(password));
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

function looksLikeStl(buf: Buffer): boolean {
  if (buf.length >= 84 && 84 + buf.readUInt32LE(80) * 50 === buf.length) return true; // binary
  return buf.subarray(0, 5).toString("ascii").toLowerCase() === "solid"; // ascii
}

function cleanUrl(raw: string): string | null | undefined {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function uploadPart(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const title = str(fd, "title");
  const description = str(fd, "description");
  const category = str(fd, "category");
  const material = str(fd, "material");
  const universal = fd.get("universal") === "on";
  const creatorName = str(fd, "creator_name") || null;
  const sourceUrl = cleanUrl(str(fd, "source_url"));
  const file = fd.get("file");
  const vehicleIds = [...new Set(fd.getAll("vehicle").map(Number))].filter(Number.isInteger);

  if (title.length < 3 || title.length > 120) return { error: "Title must be 3-120 characters." };
  if (description.length > 4000) return { error: "Description is too long." };
  if (!(CATEGORIES as readonly string[]).includes(category)) return { error: "Pick a category." };
  if (material && !(MATERIALS as readonly string[]).includes(material))
    return { error: "Unknown material." };
  if (sourceUrl === undefined) return { error: "Source link must be a valid http(s) URL." };
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !sourceUrl) return { error: "Upload an STL file or give a link to the original." };
  if (!universal && vehicleIds.length === 0)
    return { error: "Choose at least one vehicle it fits, or mark it universal." };

  const db = getDb();
  if (vehicleIds.length) {
    const marks = vehicleIds.map(() => "?").join(",");
    const { n } = db
      .prepare(`SELECT COUNT(*) AS n FROM vehicles WHERE id IN (${marks})`)
      .get(...vehicleIds) as { n: number };
    if (n !== vehicleIds.length) return { error: "Unknown vehicle selected." };
  }

  let storedName: string | null = null;
  let fileName: string | null = null;
  let fileSize: number | null = null;
  if (hasFile) {
    if (!file.name.toLowerCase().endsWith(".stl")) return { error: "Only .stl files are supported." };
    if (file.size > MAX_STL_BYTES) return { error: "File is larger than 50 MB." };
    const buf = Buffer.from(await file.arrayBuffer());
    if (!looksLikeStl(buf)) return { error: "That doesn't look like a valid STL file." };
    storedName = `${crypto.randomUUID()}.stl`;
    await fs.writeFile(uploadPath(storedName), buf);
    fileName = path.basename(file.name).replace(/[^\w.\- ]/g, "_");
    fileSize = buf.length;
  }

  let partId: number;
  try {
    db.exec("BEGIN");
    const res = db
      .prepare(
        `INSERT INTO parts (user_id, title, description, category, material, universal,
           file_name, file_path, file_size, source_url, creator_name)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(user.id, title, description, category, material, universal ? 1 : 0, fileName, storedName, fileSize, sourceUrl, creatorName);
    partId = Number(res.lastInsertRowid);
    const ins = db.prepare("INSERT INTO fitments (part_id, vehicle_id) VALUES (?,?)");
    for (const id of vehicleIds) ins.run(partId, id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    if (storedName) await fs.rm(uploadPath(storedName), { force: true });
    throw e;
  }
  redirect(`/parts/${partId}`);
}

export async function deletePart(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  const db = getDb();
  const row = db.prepare("SELECT file_path FROM parts WHERE id = ? AND user_id = ?").get(id, user.id) as
    | { file_path: string | null }
    | undefined;
  if (!row) return;
  db.prepare("DELETE FROM parts WHERE id = ?").run(id);
  if (row.file_path) await fs.rm(uploadPath(row.file_path), { force: true });
  redirect("/");
}
