import { getSession } from "@/lib/session";
import { listActiveMeetings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const meetings = await listActiveMeetings();
  return Response.json({ meetings });
}
