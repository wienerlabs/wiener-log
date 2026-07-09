import { neon } from "@neondatabase/serverless";
import { execSync } from "node:child_process";

const sql = neon(process.env.WLOG_DATABASE_URL);
const orgs = ["wienerlabs", "S-SIDEWINDER"];

await sql`
  CREATE TABLE IF NOT EXISTS member_orgs (
    handle     text NOT NULL,
    org        text NOT NULL,
    avatar_url text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (handle, org)
  )
`;

for (const org of orgs) {
  const out = execSync(
    `gh api /orgs/${org}/members --paginate --jq '.[] | {login, avatar_url}'`,
    { encoding: "utf8" },
  );
  const members = out
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  for (const m of members) {
    await sql`
      INSERT INTO member_orgs (handle, org, avatar_url)
      VALUES (${m.login}, ${org}, ${m.avatar_url})
      ON CONFLICT (handle, org)
      DO UPDATE SET avatar_url = EXCLUDED.avatar_url, updated_at = now()
    `;
  }
  console.log(`${org}: ${members.length} members`);
}

const total = await sql`SELECT count(*)::int AS n FROM member_orgs`;
console.log(`member_orgs total rows: ${total[0].n}`);
