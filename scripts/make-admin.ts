// Promote an existing user to admin:  npm run make-admin -- <username>
// (The first account created on a fresh database is made admin automatically.)
import { getDb } from "../src/lib/db.ts";

const username = process.argv[2];
if (!username) {
  console.error("Usage: npm run make-admin -- <username>");
  process.exit(1);
}
const res = getDb().prepare("UPDATE users SET is_admin = 1 WHERE username = ?").run(username);
if (Number(res.changes) === 0) {
  console.error(`No user named "${username}".`);
  process.exit(1);
}
console.log(`${username} is now an admin.`);
