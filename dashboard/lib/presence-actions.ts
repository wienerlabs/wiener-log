"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { setUserStatus } from "@/lib/db";

export async function setStatusAction(formData: FormData) {
  const session = await getSession();
  if (!session) return;
  const handle =
    session.handle && session.handle !== "admin"
      ? session.handle
      : session.username;
  const allowed = ["available", "focus", "away", "ooo"];
  const raw = String(formData.get("status") || "available");
  const status = allowed.includes(raw) ? raw : "available";
  const message = String(formData.get("message") || "").slice(0, 100).trim() || null;
  await setUserStatus(handle, status, message, null);
  revalidatePath("/members");
  revalidatePath("/settings");
}
