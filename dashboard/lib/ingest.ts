import { sql } from "@/lib/db";

const SOURCES = new Set(["git", "claude_code"]);

export async function ingestEvent(input: {
  handle: string;
  source: string;
  kind: string;
  payload: Record<string, unknown>;
}): Promise<boolean> {
  const handle = (input.handle || "").trim();
  if (!handle || !SOURCES.has(input.source) || !input.kind) return false;

  await sql`
    INSERT INTO workspaces (id, slug, name, created_at, updated_at)
    VALUES (gen_random_uuid(), ${handle}, ${handle}, now(), now())
    ON CONFLICT (slug) DO NOTHING`;
  const ws = (await sql`
    SELECT id FROM workspaces WHERE slug = ${handle} LIMIT 1
  `) as { id: string }[];
  if (!ws.length) return false;

  await sql`
    INSERT INTO events (id, workspace_id, source, kind, payload, occurred_at, ingested_at)
    VALUES (gen_random_uuid(), ${ws[0].id}, ${input.source}, ${input.kind},
      ${JSON.stringify(input.payload || {})}, now(), now())`;
  return true;
}
