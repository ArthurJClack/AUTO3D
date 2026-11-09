import { getDb } from "./db.ts";

// Small DB-backed sliding-window limiter, enough to blunt bots and password guessing on one server.
// A key is any string, e.g. `signup:1.2.3.4`.

const CLEANUP_AFTER_MS = 24 * 60 * 60 * 1000;

/** How many events with this key happened in the last `windowSec` seconds. */
export function count(key: string, windowSec: number, now = Date.now()): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM rate_events WHERE key = ? AND at > ?")
    .get(key, now - windowSec * 1000) as { n: number };
  return row.n;
}

export function record(key: string, now = Date.now()) {
  const db = getDb();
  db.prepare("INSERT INTO rate_events (key, at) VALUES (?, ?)").run(key, now);
  // Housekeeping: occasionally drop old rows so the table can't grow forever.
  if (Math.random() < 0.01) db.prepare("DELETE FROM rate_events WHERE at < ?").run(now - CLEANUP_AFTER_MS);
}

/** True if the key has already used up `limit` events in the window (does not record). */
export const isLimited = (key: string, limit: number, windowSec: number, now = Date.now()) =>
  count(key, windowSec, now) >= limit;

/** Record an event unless the limit is already hit. Returns false when the caller should be refused. */
export function consume(key: string, limit: number, windowSec: number, now = Date.now()): boolean {
  if (isLimited(key, limit, windowSec, now)) return false;
  record(key, now);
  return true;
}
