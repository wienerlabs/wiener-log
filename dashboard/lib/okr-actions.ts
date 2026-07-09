"use server";

import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "@/lib/session";
import {
  createObjective,
  addKeyResult,
  updateKeyResultProgress,
  deleteObjective,
} from "@/lib/db";

export async function createObjectiveAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const session = await getSession();
  const title = String(formData.get("title") || "").slice(0, 200).trim();
  const owner = String(formData.get("owner") || "").slice(0, 60).trim();
  const period = String(formData.get("period") || "").slice(0, 40).trim();
  if (!title) return;
  await createObjective(title, owner, period, session?.username || "admin");
  revalidatePath("/goals");
}

export async function addKeyResultAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const objectiveId = Number(formData.get("objectiveId"));
  const title = String(formData.get("title") || "").slice(0, 200).trim();
  if (!Number.isFinite(objectiveId) || !title) return;
  await addKeyResult(objectiveId, title);
  revalidatePath("/goals");
}

export async function setProgressAction(id: number, progress: number) {
  if (!(await isAdmin())) return;
  await updateKeyResultProgress(id, progress);
  revalidatePath("/goals");
}

export async function deleteObjectiveAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await deleteObjective(id);
  revalidatePath("/goals");
}
