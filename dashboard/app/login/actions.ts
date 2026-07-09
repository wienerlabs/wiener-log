"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { startSession, endSession, getSession } from "@/lib/session";
import { getAccountByUsername, recordLogin, recordLogout } from "@/lib/db";
import { verifyPassword, type Role } from "@/lib/auth";

function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

async function establish(
  role: Role,
  handle: string,
  username: string,
): Promise<void> {
  const sid = crypto.randomUUID();
  const h = await headers();
  const ip =
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    h.get("x-real-ip") ||
    null;
  const userAgent = h.get("user-agent") || null;
  await recordLogin({
    sid,
    username,
    role,
    handle: handle === "admin" ? null : handle,
    ip,
    userAgent,
  });
  await startSession(role, handle, username, sid);
}

export async function signIn(formData: FormData) {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const next = safeNext(String(formData.get("next") || "/"));
  const q = next !== "/" ? `&next=${encodeURIComponent(next)}` : "";

  const account = username ? await getAccountByUsername(username) : null;
  if (account && (await verifyPassword(password, account.password_hash))) {
    await establish(account.role, account.handle || account.username, account.username);
    redirect(next);
  }

  const breakGlass = process.env.ADMIN_PASSWORD || "";
  if (username.toLowerCase() === "admin" && breakGlass && password === breakGlass) {
    await establish("admin", "admin", "admin");
    redirect(next);
  }

  redirect(`/login?error=1${q}`);
}

export async function logout() {
  const session = await getSession();
  if (session?.sid) await recordLogout(session.sid, "signout");
  await endSession();
  redirect("/login");
}
