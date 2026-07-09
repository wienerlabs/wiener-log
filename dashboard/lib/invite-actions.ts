"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "@/lib/session";
import {
  memberExists,
  createInvite,
  getInvite,
  markInviteAccepted,
  createAccount,
  getAccountByUsername,
} from "@/lib/db";
import { hashPassword } from "@/lib/auth";

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type InviteState = { link?: string; error?: string };

export async function makeInvite(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  if (!(await isAdmin())) return { error: "Admins only." };
  const handleRaw = String(formData.get("handle") || "").trim().replace(/^@/, "");
  if (!handleRaw) return { error: "Enter a GitHub handle." };
  const member = await memberExists(handleRaw);
  if (!member) return { error: "That handle is not in the org." };
  const existing = await getAccountByUsername(member.handle);
  if (existing) return { error: `@${member.handle} already has an account.` };

  const token = randomToken();
  const session = await getSession();
  await createInvite(token, member.handle, session?.username || "admin");
  const host = (await headers()).get("host") || "wienerlog-dashboard.vercel.app";
  return { link: `https://${host}/invite/${token}` };
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") || "");
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  const fail = (msg: string) =>
    redirect(`/invite/${token}?error=${encodeURIComponent(msg)}`);

  const invite = await getInvite(token);
  if (!invite || invite.accepted) fail("This invite is not valid.");
  if (!username) fail("Choose a username.");
  if (password.length < 8) fail("Password must be at least 8 characters.");
  if (password !== confirm) fail("Passwords do not match.");
  if (await getAccountByUsername(username)) fail("That username is taken.");

  const hash = await hashPassword(password);
  const ok = await createAccount(
    username,
    hash,
    invite!.role,
    invite!.handle,
  );
  if (!ok) fail("Could not create the account.");
  await markInviteAccepted(token);
  revalidatePath("/settings");
  redirect("/login?invited=1");
}
