"use server";

import { redirect } from "next/navigation";
import { startSession, endSession } from "@/lib/session";

export async function login(formData: FormData) {
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/");
  const expected = process.env.ADMIN_PASSWORD || "";

  if (expected && password === expected) {
    await startSession();
    redirect(next.startsWith("/") ? next : "/");
  }
  const q = next && next !== "/" ? `&next=${encodeURIComponent(next)}` : "";
  redirect(`/login?error=1${q}`);
}

export async function logout() {
  await endSession();
  redirect("/login");
}
