"use server";

import { revalidatePath } from "next/cache";
import { getSession, isAdmin } from "@/lib/session";
import { assignTask } from "@/lib/db";
import { createIssue } from "@/lib/github";
import { recordAudit } from "@/lib/audit";

export type AssignState = { ok?: boolean; error?: string; githubUrl?: string };

export async function assignAction(
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  if (!(await isAdmin())) return { error: "Only admins can assign tasks." };
  const session = await getSession();

  const handle = String(formData.get("handle") || "");
  const title = String(formData.get("title") || "");
  const body = String(formData.get("body") || "");
  const repo = String(formData.get("repo") || "").trim();
  const createGithub = formData.get("create_github") === "on";

  let githubUrl: string | null = null;
  if (createGithub) {
    if (!repo || !repo.includes("/")) {
      return {
        error: "Add a repo like wienerlabs/wienerlog to open a GitHub issue.",
      };
    }
    try {
      const issue = await createIssue(repo, {
        title: title.trim(),
        body: body.trim() || undefined,
        assignees: [handle],
      });
      githubUrl = issue.html_url;
    } catch (e) {
      return {
        error: `GitHub issue failed: ${e instanceof Error ? e.message : "error"}`,
      };
    }
  }

  const res = await assignTask({ handle, title, body, repo, githubUrl });
  if (!res.ok) return { error: res.error || "Could not assign task." };

  await recordAudit({
    actor: session?.username || "admin",
    action: "assign_task",
    target: handle,
    detail: { title: title.trim(), repo: repo || null, github_url: githubUrl },
  });

  revalidatePath(`/members/${handle}`);
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true, githubUrl: githubUrl || undefined };
}
