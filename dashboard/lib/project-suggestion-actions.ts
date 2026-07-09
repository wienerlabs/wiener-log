"use server";

import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "@/lib/session";
import { getSuggestionById, setSuggestionStatus, assignTask } from "@/lib/db";
import { createIssue } from "@/lib/github";
import { recordAudit } from "@/lib/audit";

export async function acceptSuggestion(
  id: number,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Admins only." };
  const s = await getSuggestionById(id);
  if (!s || s.status !== "open") return { ok: false, error: "Not available." };

  const assignee = s.suggested_assignee || null;
  let url: string;
  try {
    const issue = await createIssue(s.repo, {
      title: s.title,
      body: s.body || undefined,
      assignees: assignee ? [assignee] : undefined,
    });
    url = issue.html_url;
  } catch (e) {
    return {
      ok: false,
      error: `GitHub issue failed: ${e instanceof Error ? e.message : "error"}`,
    };
  }

  if (assignee) {
    await assignTask({
      handle: assignee,
      title: s.title,
      body: s.body || undefined,
      repo: s.repo,
      githubUrl: url,
    });
  }

  await setSuggestionStatus(id, "accepted", url);
  const session = await getSession();
  await recordAudit({
    actor: session?.username || "admin",
    action: "accept_suggestion",
    target: s.repo,
    detail: { title: s.title, github_url: url, assignee },
  });
  revalidatePath("/");
  revalidatePath("/projects");
  return { ok: true, url };
}

export async function dismissSuggestion(
  id: number,
): Promise<{ ok: boolean }> {
  if (!(await isAdmin())) return { ok: false };
  const s = await setSuggestionStatus(id, "dismissed");
  if (s) {
    const session = await getSession();
    await recordAudit({
      actor: session?.username || "admin",
      action: "dismiss_suggestion",
      target: s.repo,
      detail: { title: s.title },
    });
    revalidatePath("/");
    revalidatePath("/projects");
  }
  return { ok: true };
}
