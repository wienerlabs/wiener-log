"use server";

import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "@/lib/session";
import {
  getAccountByIdentifier,
  updatePassword,
  setAccountRole,
  countAdmins,
} from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

export type PasswordState = { ok?: boolean; error?: string };

export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  const confirm = String(formData.get("confirm") || "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };

  const account = await getAccountByIdentifier(session.username || session.handle);
  if (!account) return { error: "This session has no editable account." };
  if (!(await verifyPassword(current, account.password_hash))) {
    return { error: "Current password is incorrect." };
  }

  const hash = await hashPassword(next);
  await updatePassword(account.username, hash);
  return { ok: true };
}

export type RoleState = { ok?: boolean; error?: string; username?: string };

export async function toggleRole(
  _prev: RoleState,
  formData: FormData,
): Promise<RoleState> {
  if (!(await isAdmin())) return { error: "Only admins can change roles." };

  const username = String(formData.get("username") || "");
  const role = formData.get("role") === "admin" ? "admin" : "employee";

  if (role === "employee") {
    const admins = await countAdmins();
    const target = await getAccountByIdentifier(username);
    if (target?.role === "admin" && admins <= 1) {
      return { error: "Keep at least one admin.", username };
    }
  }

  const ok = await setAccountRole(username, role);
  if (!ok) return { error: "Account not found.", username };
  const session = await getSession();
  await recordAudit({
    actor: session?.username || "admin",
    action: "set_role",
    target: username,
    detail: { role },
  });
  revalidatePath("/settings");
  return { ok: true, username };
}
