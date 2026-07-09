import { neon } from "@neondatabase/serverless";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const sql = neon(process.env.WLOG_DATABASE_URL);

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "0raclus";
const ADMIN_HANDLE = process.env.ADMIN_HANDLE || "kh0ra";
const RESET = process.argv.includes("--reset");

function b64url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function hashPw(pw) {
  const salt = randomBytes(16);
  const it = 100000;
  const dk = pbkdf2Sync(pw, salt, it, 32, "sha256");
  return `pbkdf2$${it}$${b64url(salt)}$${b64url(dk)}`;
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genPassword(len = 11) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

await sql`
  CREATE TABLE IF NOT EXISTS accounts (
    username text PRIMARY KEY,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'employee',
    handle text,
    display_name text,
    created_at timestamptz DEFAULT now()
  )`;

if (RESET) await sql`TRUNCATE accounts`;

const members = (await sql`
  SELECT DISTINCT handle FROM member_orgs ORDER BY handle
`).map((r) => r.handle);

const list = [
  { username: ADMIN_USERNAME, handle: ADMIN_HANDLE, role: "admin" },
];
for (const h of members) {
  if (h.toLowerCase() === ADMIN_USERNAME.toLowerCase()) continue;
  if (h.toLowerCase() === ADMIN_HANDLE.toLowerCase()) continue;
  list.push({ username: h, handle: h, role: "employee" });
}

const created = [];
for (const acc of list) {
  const password = genPassword();
  const hash = hashPw(password);
  const rows = await sql`
    INSERT INTO accounts (username, password_hash, role, handle, display_name)
    VALUES (${acc.username.toLowerCase()}, ${hash}, ${acc.role}, ${acc.handle}, ${acc.username})
    ON CONFLICT (username) DO NOTHING
    RETURNING username`;
  if (rows.length) created.push({ ...acc, password });
}

const total = (await sql`SELECT count(*)::int AS n FROM accounts`)[0].n;

if (created.length) {
  const lines = created.map(
    (c) =>
      `${c.role.padEnd(9)} ${c.username.toLowerCase().padEnd(22)} ${c.password}`,
  );
  const header = `role      username               password`;
  const body = [header, "-".repeat(header.length + 8), ...lines].join("\n");
  console.log(body);
  writeFileSync(
    new URL("../.accounts.local.txt", import.meta.url),
    body + "\n",
  );
  console.log(`\ncreated ${created.length} new account(s), ${total} total`);
} else {
  console.log(`no new accounts created, ${total} total (use --reset to rotate)`);
}
