"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { setOwnTaskStatus } from "@/lib/db";

export async function reviewOwnTask(
  id: string,
  decision: "acked" | "rejected",
): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const ok = await setOwnTaskStatus(id, decision, session.handle);
  if (ok) revalidatePath("/");
  return { ok };
}
