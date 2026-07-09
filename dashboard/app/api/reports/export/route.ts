import { isAdmin } from "@/lib/session";
import { getTeamTimeReport } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  const days = new URL(req.url).searchParams.get("days") === "30" ? 30 : 7;
  const report = await getTeamTimeReport(days);

  const lines = ["member,tracked_minutes,tracked_hours,sessions,events"];
  for (const m of report.perMember) {
    lines.push(
      [
        m.handle,
        Math.round(m.minutes),
        (m.minutes / 60).toFixed(2),
        m.sessions,
        m.events,
      ].join(","),
    );
  }
  const csv = lines.join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="wienerlog-report-${days}d.csv"`,
    },
  });
}
