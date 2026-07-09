"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { createApiToken, revokeApiToken } from "@/lib/tokens";

function handleOf(session: { handle: string; username: string }): string {
  return session.handle && session.handle !== "admin"
    ? session.handle
    : session.username;
}

export type TokenState = { token?: string; error?: string };

export async function createToken(
  _prev: TokenState,
  formData: FormData,
): Promise<TokenState> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };
  const name = String(formData.get("name") || "").slice(0, 60).trim();
  const kind = formData.get("kind") === "mcp" ? "mcp" : "ingest";
  const token = await createApiToken(handleOf(session), name, kind);
  revalidatePath("/settings");
  return { token };
}

export async function revokeToken(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await revokeApiToken(id, handleOf(session));
  revalidatePath("/settings");
}
