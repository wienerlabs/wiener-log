"use server";

import { revalidatePath } from "next/cache";
import { isAuthed } from "@/lib/session";
import { assignTask } from "@/lib/db";

export type AssignState = { ok?: boolean; error?: string };

export async function assignAction(
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  if (!(await isAuthed())) return { error: "Not authorized." };

  const handle = String(formData.get("handle") || "");
  const title = String(formData.get("title") || "");
  const body = String(formData.get("body") || "");
  const repo = String(formData.get("repo") || "");

  const res = await assignTask({ handle, title, body, repo });
  if (!res.ok) return { error: res.error || "Could not assign task." };

  revalidatePath(`/members/${handle}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true };
}
