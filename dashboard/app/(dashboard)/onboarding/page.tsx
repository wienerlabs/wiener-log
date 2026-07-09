import { isAdmin } from "@/lib/session";
import { Card, PageHeader, SectionHeader, EmptyState } from "@/components/ui";
import { CopyBlock } from "@/components/copy-block";
import { InviteForm } from "@/components/invite-form";

export const dynamic = "force-dynamic";

const BASE = "https://wienerlog-dashboard.vercel.app";

export default async function OnboardingPage() {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div className="rise">
        <PageHeader title="Onboarding" />
        <EmptyState>Only admins can see onboarding credentials.</EmptyState>
      </div>
    );
  }

  const ingest = process.env.INGEST_TOKEN || "(set INGEST_TOKEN)";
  const mcp = process.env.MCP_TOKEN || "(set MCP_TOKEN)";
  const command = `curl -fsSL ${BASE}/onboard.sh | WLOG_HANDLE=<github-handle> WLOG_BASE=${BASE} WLOG_INGEST_TOKEN=${ingest} WLOG_MCP_TOKEN=${mcp} bash`;

  return (
    <div className="rise">
      <PageHeader
        title="Onboarding"
        subtitle="Connect a teammate's machine so their work flows into WienerLog."
      />

      <div className="mb-8">
        <SectionHeader title="One-time setup command" />
        <Card className="p-5">
          <p className="mb-3 text-[13px] text-[var(--color-muted)]">
            Send this to each teammate. Replace{" "}
            <span className="font-[family-name:var(--font-mono)] text-[var(--color-ink-soft)]">
              &lt;github-handle&gt;
            </span>{" "}
            with their GitHub username. They paste it once into a terminal (macOS
            or Linux, with git, node and python3 installed).
          </p>
          <CopyBlock text={command} />
        </Card>
      </div>

      <div className="mb-8">
        <SectionHeader title="Or invite by link" />
        <Card className="p-5">
          <p className="mb-3 text-[13px] text-[var(--color-muted)]">
            For a teammate who has no account yet: generate a personal link, they
            set their own password and they are in.
          </p>
          <InviteForm />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="What it sets up" />
          <Card className="p-5">
            <ul className="flex flex-col gap-2.5 text-[13px] text-[var(--color-ink-soft)]">
              <li>
                <b>Commit reporting</b> — a global git hook sends each commit
                (repo, branch, message) to WienerLog.
              </li>
              <li>
                <b>Claude Code activity</b> — a SessionStart hook reports when
                they start a Claude Code session and in which repo.
              </li>
              <li>
                <b>MCP integration</b> — installs the WienerLog MCP into Claude
                Desktop and Claude Code (read-only, over an authenticated proxy —
                no database credentials leave the server).
              </li>
            </ul>
          </Card>
        </div>
        <div>
          <SectionHeader title="Notes" />
          <Card className="p-5">
            <ul className="flex flex-col gap-2.5 text-[13px] text-[var(--color-muted)]">
              <li>
                The handle must match a member of the wienerlabs or Sidewinder
                org (same handle they log in with).
              </li>
              <li>
                Events appear on their member profile and feed task synthesis
                within minutes.
              </li>
              <li>
                The git hook sets{" "}
                <span className="font-[family-name:var(--font-mono)]">
                  core.hooksPath
                </span>
                ; if a teammate already uses global git hooks, tell them first.
              </li>
              <li>
                Rotating tokens: update{" "}
                <span className="font-[family-name:var(--font-mono)]">
                  INGEST_TOKEN
                </span>{" "}
                /{" "}
                <span className="font-[family-name:var(--font-mono)]">
                  MCP_TOKEN
                </span>{" "}
                in Vercel and re-send the command.
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <SectionHeader title="Ask their Claude" />
        <Card className="p-5">
          <p className="text-[13px] text-[var(--color-muted)]">
            Once set up and Claude Desktop is restarted, they can ask their own
            Claude things like:
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-[var(--color-ink-soft)]">
            <li>“Which wienerlabs repo has the most open issues?”</li>
            <li>“What are my open pull requests?”</li>
            <li>“Show the health of the cortexagent project.”</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
