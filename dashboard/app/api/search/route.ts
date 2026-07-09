import { searchAll } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  const results = await searchAll(q);
  return Response.json(results);
}
