import { getRecentMessages, getMemberHandles, getProjectNames } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ChatView } from "@/components/chat-view";
import { CallBar } from "@/components/call-bar";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const session = await getSession();
  const me =
    session?.handle && session.handle !== "admin"
      ? session.handle
      : session?.username || "";

  const [messages, members, projects] = await Promise.all([
    getRecentMessages(me),
    getMemberHandles(),
    getProjectNames(),
  ]);

  return (
    <div className="rise">
      <PageHeader
        title="Team chat"
        subtitle="Mention people and projects, react, run commands, or ask @wiener."
      />
      <CallBar />
      <ChatView
        initialMessages={messages}
        me={me}
        members={members}
        projects={projects}
      />
    </div>
  );
}
