import { Sidebar, MobileTopBar } from "@/components/sidebar";
import { SessionHeartbeat } from "@/components/session-heartbeat";
import { CommandPalette } from "@/components/command-palette";
import { logout } from "@/app/login/actions";
import { getSession } from "@/lib/session";
import { getPinnedRepos, getTopics } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, pinned, topics] = await Promise.all([
    getSession(),
    getPinnedRepos(5),
    getTopics(10),
  ]);

  return (
    <>
      <SessionHeartbeat />
      <CommandPalette />
      <Sidebar
        logoutAction={logout}
        role={session?.role ?? "admin"}
        handle={session?.handle ?? "admin"}
        pinned={pinned.map((p) => ({
          full_name: p.full_name,
          name: p.name,
          language: p.language,
          is_private: p.is_private,
        }))}
        topics={topics.map((t) => t.topic)}
      />
      <MobileTopBar />
      <main className="lg:pl-[248px]">
        <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
          {children}
        </div>
      </main>
    </>
  );
}
