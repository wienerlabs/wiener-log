import { sql } from "@/lib/db";

export async function recordAudit(input: {
  actor: string;
  action: string;
  target?: string | null;
  detail?: unknown;
}): Promise<void> {
  try {
    await sql`
      INSERT INTO audit_log (actor, action, target, detail)
      VALUES (${input.actor}, ${input.action}, ${input.target ?? null},
              ${input.detail ? JSON.stringify(input.detail) : null})`;
  } catch {
    /* audit is best-effort, never block the action */
  }
}

export interface AuditRow {
  id: number;
  actor: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  at: string;
}

export async function getAuditLog(limit = 60): Promise<AuditRow[]> {
  return (await sql`
    SELECT id, actor, action, target, detail, at
    FROM audit_log ORDER BY at DESC LIMIT ${limit}
  `) as AuditRow[];
}
