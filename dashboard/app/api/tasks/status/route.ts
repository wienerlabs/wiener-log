import { isAdmin, getSession } from "@/lib/session";
import { adminSetTaskStatus, type TaskStatus } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const VALID: TaskStatus[] = [
  "proposed",
  "acked",
  "in_progress",
  "done",
  "rejected",
];

export async function POST(req: Request) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  let body: { id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const id = String(body.id || "");
  const status = body.status as TaskStatus;
  if (!id || !VALID.includes(status)) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const ok = await adminSetTaskStatus(id, status);
  if (ok) {
    const session = await getSession();
    await recordAudit({
      actor: session?.username || "admin",
      action: "task_status",
      target: id,
      detail: { status },
    });
  }
  return Response.json({ ok });
}
