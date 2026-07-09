import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth";

const ADMIN_ONLY = [
  "/members",
  "/tasks",
  "/events",
  "/workspaces",
  "/onboarding",
  "/reports",
  "/briefing",
  "/expertise",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/invite"))
    return NextResponse.next();
  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/ingest") ||
    pathname.startsWith("/api/mcp")
  )
    return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifyToken(token, process.env.AUTH_SECRET || "");

  if (session) {
    if (
      session.role !== "admin" &&
      ADMIN_ONLY.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ) {
      const home = req.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return NextResponse.redirect(home);
    }
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|wiener-logo.png|wiener-logo-white.png|onboard.sh|wlog-mcp.mjs|wlog-mcp-package.json).*)",
  ],
};
