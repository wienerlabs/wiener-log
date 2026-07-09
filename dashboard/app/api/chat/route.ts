import { getSession, isAdmin } from "@/lib/session";
import {
  getRecentMessages,
  searchMessages,
  postMessage,
  getMemberHandles,
  createNotification,
  assignTask,
  getProjectByName,
  createMeeting,
  getMemberStandup,
} from "@/lib/db";
import { createIssue } from "@/lib/github";
import { parseMentions } from "@/lib/mentions";
import { answerAsWiener } from "@/lib/chat-ai";
import { generateStandup } from "@/lib/standup";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function meOf(session: { handle: string; username: string }): string {
  return session.handle && session.handle !== "admin"
    ? session.handle
    : session.username;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me = meOf(session);
  const q = new URL(req.url).searchParams.get("q") || "";
  const messages =
    q.trim().length >= 1
      ? await searchMessages(me, q)
      : await getRecentMessages(me);
  return Response.json({ messages });
}

const HELP = `Commands:
/standup — post your auto-generated standup for today
/call <title> — start a video call and drop the link here
/task @handle <title> — assign a WienerLog task (admins)
/issue #project <title> — open a GitHub issue
@wiener <question> — ask the AI teammate about repos, PRs, issues
@handle — mention a teammate (they get notified)
#project — link a project`;

function meetRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  let s = "";
  for (const b of bytes) s += (b % 36).toString(36);
  return `wienerlog-${s}`;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me = meOf(session);
  let payload: { body?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const text = String(payload.body || "").trim();
  if (!text) return Response.json({ ok: false }, { status: 400 });

  if (text.startsWith("/")) {
    const base = `https://${req.headers.get("host") || "wienerlog-dashboard.vercel.app"}`;
    const msg = await handleCommand(text, me, base);
    return Response.json({ ok: true, message: msg });
  }

  const msg = await postMessage(me, text, "user");
  if (!msg) return Response.json({ ok: false }, { status: 400 });

  const mentioned = parseMentions(text);
  if (mentioned.length) {
    const members = await getMemberHandles();
    const canonical = new Map(members.map((h) => [h.toLowerCase(), h]));
    for (const m of mentioned) {
      const target = canonical.get(m);
      if (target && target !== me) {
        await createNotification({
          recipient: target,
          actor: me,
          kind: "mention",
          body: text.slice(0, 140),
          link: "/chat",
          messageId: msg.id,
        });
      }
    }
  }

  if (/@wiener\b/i.test(text)) {
    const answer = await answerAsWiener(text);
    await postMessage("wiener", answer, "bot");
  }

  return Response.json({ ok: true, message: msg });
}

async function handleCommand(text: string, me: string, base: string) {
  const [cmd, ...restParts] = text.split(/\s+/);
  const rest = restParts.join(" ").trim();

  if (cmd === "/help") {
    return postMessage("system", HELP, "system");
  }

  if (cmd === "/call") {
    const title = rest || "Team call";
    const room = meetRoomId();
    await createMeeting(room, title, me);
    return postMessage(
      "system",
      `📹 ${me} started a call: ${title} — ${base}/meet/${room}`,
      "system",
    );
  }

  if (cmd === "/standup") {
    const today = new Date().toISOString().slice(0, 10);
    await generateStandup(me, today);
    const summary = await getMemberStandup(me, today);
    return postMessage(
      "system",
      summary
        ? `🗒️ ${me}'s standup — ${today}\n${summary}`
        : `No tracked activity for ${me} today yet. Standups fill from your commits and Claude Code sessions.`,
      "system",
    );
  }

  if (cmd === "/task") {
    if (!(await isAdmin())) {
      return postMessage("system", "Only admins can use /task.", "system");
    }
    const mm = rest.match(/@([a-zA-Z0-9-]+)\s+([\s\S]+)/);
    if (!mm) {
      return postMessage("system", "Usage: /task @handle <title>", "system");
    }
    const handle = mm[1];
    const title = mm[2].trim();
    const res = await assignTask({ handle, title });
    if (!res.ok) {
      return postMessage("system", `Could not assign: ${res.error}`, "system");
    }
    await createNotification({
      recipient: handle,
      actor: me,
      kind: "task",
      body: title,
      link: "/",
    });
    return postMessage(
      "system",
      `📋 Task assigned to @${handle}: ${title}`,
      "system",
    );
  }

  if (cmd === "/issue") {
    const mm = rest.match(/#([a-zA-Z0-9._-]+)\s+([\s\S]+)/);
    if (!mm) {
      return postMessage("system", "Usage: /issue #project <title>", "system");
    }
    const project = await getProjectByName(mm[1]);
    if (!project) {
      return postMessage("system", `No project named "${mm[1]}".`, "system");
    }
    try {
      const issue = await createIssue(project.full_name, { title: mm[2].trim() });
      return postMessage(
        "system",
        `🐛 Opened issue in ${project.name}: ${issue.html_url}`,
        "system",
      );
    } catch (e) {
      return postMessage(
        "system",
        `GitHub issue failed: ${e instanceof Error ? e.message : "error"}`,
        "system",
      );
    }
  }

  return postMessage("system", "Unknown command. Try /help.", "system");
}
