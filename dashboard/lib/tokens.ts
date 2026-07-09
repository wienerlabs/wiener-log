import { sql } from "@/lib/db";

async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(kind: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  const rand = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `wlog_${kind}_${rand}`;
}

export interface ApiTokenRow {
  id: number;
  name: string | null;
  kind: string;
  created_at: string;
  last_used_at: string | null;
}

export async function createApiToken(
  handle: string,
  name: string,
  kind: "ingest" | "mcp",
): Promise<string> {
  const token = randomToken(kind);
  const token_hash = await hashToken(token);
  await sql`
    INSERT INTO api_tokens (handle, name, kind, token_hash)
    VALUES (${handle}, ${name || null}, ${kind}, ${token_hash})`;
  return token;
}

export async function listApiTokens(handle: string): Promise<ApiTokenRow[]> {
  return (await sql`
    SELECT id, name, kind, created_at, last_used_at FROM api_tokens
    WHERE handle = ${handle} ORDER BY id DESC
  `) as ApiTokenRow[];
}

export async function revokeApiToken(
  id: number,
  handle: string,
): Promise<boolean> {
  const rows = (await sql`
    DELETE FROM api_tokens WHERE id = ${id} AND handle = ${handle} RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}

export async function findTokenOwner(
  presented: string,
  kind: "ingest" | "mcp",
): Promise<string | null> {
  if (!presented) return null;
  const token_hash = await hashToken(presented);
  const rows = (await sql`
    UPDATE api_tokens SET last_used_at = now()
    WHERE token_hash = ${token_hash} AND kind = ${kind}
    RETURNING handle
  `) as { handle: string }[];
  return rows[0]?.handle ?? null;
}
