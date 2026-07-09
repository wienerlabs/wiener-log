"use server";

import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "@/lib/session";
import {
  createAnnouncement,
  deleteAnnouncement,
  getMemberHandles,
  createNotification,
} from "@/lib/db";

export async function postAnnouncement(formData: FormData) {
  if (!(await isAdmin())) return;
  const session = await getSession();
  const author = session?.username || "admin";
  const title = String(formData.get("title") || "").slice(0, 200).trim();
  const body = String(formData.get("body") || "").slice(0, 4000).trim();
  const pinned = formData.get("pinned") === "on";
  if (!title) return;

  await createAnnouncement(author, title, body, pinned);
  const members = await getMemberHandles();
  for (const h of members) {
    await createNotification({
      recipient: h,
      actor: author,
      kind: "announcement",
      body: title,
      link: "/announcements",
    });
  }
  revalidatePath("/announcements");
  revalidatePath("/");
}

export async function removeAnnouncement(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await deleteAnnouncement(id);
  revalidatePath("/announcements");
  revalidatePath("/");
}
