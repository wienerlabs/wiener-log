"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/session";
import { generateBriefing } from "@/lib/briefing";

export async function regenerateBriefingAction() {
  if (!(await isAdmin())) return;
  const today = new Date().toISOString().slice(0, 10);
  await generateBriefing(today);
  revalidatePath("/briefing");
}
