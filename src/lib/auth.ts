import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";

const COOKIE = "session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export type User = { id: number; username: string };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createSession(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + SESSION_MS;
  getDb()
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)")
    .run(sha256(token), userId, expires);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(expires),
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
  jar.delete(COOKIE);
}

export async function getUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), Date.now()) as User | undefined;
  return row ?? null;
}

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
