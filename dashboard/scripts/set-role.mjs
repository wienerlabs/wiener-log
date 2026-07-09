import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.WLOG_DATABASE_URL);

const username = (process.argv[2] || "").toLowerCase();
const role = process.argv[3] || "";

if (!username || (role !== "admin" && role !== "employee")) {
  console.error("usage: set-role.mjs <username> <admin|employee>");
  process.exit(1);
}

const rows = await sql`
  UPDATE accounts SET role = ${role}
  WHERE lower(username) = ${username}
  RETURNING username, role, handle`;

if (rows.length === 0) {
  console.error(`no account named "${username}"`);
  process.exit(1);
}
console.log(`${rows[0].username} -> ${rows[0].role}`);

const admins = await sql`SELECT username FROM accounts WHERE role = 'admin' ORDER BY username`;
console.log(`admins: ${admins.map((a) => a.username).join(", ")}`);
