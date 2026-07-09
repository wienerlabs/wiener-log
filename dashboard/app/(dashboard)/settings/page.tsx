import { getSession, isAdmin } from "@/lib/session";
import {
  listAccounts,
  getGhStats,
  memberExists,
  getUserStatus,
} from "@/lib/db";
import {
  Card,
  PageHeader,
  SectionHeader,
  Avatar,
  GithubMark,
} from "@/components/ui";
import { getAuditLog } from "@/lib/audit";
import { listApiTokens } from "@/lib/tokens";
import { StatusSetter } from "@/components/status-setter";
import { ThemeToggle } from "@/components/theme-toggle";
import { ChangePasswordForm } from "@/components/change-password-form";
import { AccountsManager } from "@/components/accounts-manager";
import { AuditLog } from "@/components/audit-log";
import { ApiTokens } from "@/components/api-tokens";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  const admin = await isAdmin();
  const handle = session?.handle ?? "admin";
  const username = session?.username ?? handle;

  const tokenHandle = handle !== "admin" ? handle : username;
  const [member, accounts, stats, audit, tokens, userStatus] = await Promise.all([
    handle !== "admin" ? memberExists(handle) : Promise.resolve(null),
    admin ? listAccounts() : Promise.resolve([]),
    admin ? getGhStats() : Promise.resolve(null),
    admin ? getAuditLog(40) : Promise.resolve([]),
    listApiTokens(tokenHandle),
    getUserStatus(tokenHandle),
  ]);

  return (
    <div className="rise">
      <PageHeader
        title="Settings"
        subtitle="Manage your account, appearance and the team."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <SectionHeader title="Your account" />
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <Avatar handle={handle} src={member?.avatar_url} size={52} />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-[var(--color-ink)]">
                  {username}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-[var(--color-muted)]">
                  <span
                    className={
                      admin
                        ? "rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)]"
                        : "rounded-full bg-[var(--color-line-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-muted)]"
                    }
                  >
                    {admin ? "Admin" : "Team member"}
                  </span>
                  {handle !== "admin" ? <span>@{handle}</span> : null}
                </div>
              </div>
              {handle !== "admin" ? (
                <a
                  href={`https://github.com/${handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[11px] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-medium text-[var(--color-ink-soft)] ring-1 ring-[var(--color-ring)] transition-colors hover:bg-[var(--color-line-soft)]"
                >
                  <GithubMark className="size-4" /> Profile
                </a>
              ) : null}
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title="Appearance" />
          <Card className="p-5">
            <div className="mb-3 text-[13px] text-[var(--color-muted)]">
              Choose a theme. System follows your device.
            </div>
            <div className="max-w-[240px]">
              <ThemeToggle />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <SectionHeader title="Your status" />
        <Card className="p-5">
          <StatusSetter
            current={userStatus?.status || "available"}
            message={userStatus?.message ?? null}
          />
        </Card>
      </div>

      <div className="mt-6 max-w-[520px]">
        <SectionHeader title="Change password" />
        <Card className="p-5">
          <ChangePasswordForm />
        </Card>
      </div>

      <div className="mt-8">
        <SectionHeader title="Personal API tokens" />
        <Card className="p-5">
          <p className="mb-4 text-[13px] text-[var(--color-muted)]">
            Personal tokens for the CLI ingest and MCP. An ingest token reports
            events as you (no impersonation); an MCP token grants read access.
            Use these instead of the shared team tokens.
          </p>
          <ApiTokens tokens={tokens} />
        </Card>
      </div>

      {admin ? (
        <div className="mt-8">
          <SectionHeader
            title="Team accounts"
            action={<span>{accounts.length} people</span>}
          />
          <Card className="overflow-hidden">
            <AccountsManager accounts={accounts} currentUsername={username} />
          </Card>
          <p className="mt-2 text-[12px] text-[var(--color-faint)]">
            Add new members by running scripts/seed-accounts.mjs, which mints a
            login for every org member.
          </p>
        </div>
      ) : null}

      {admin && stats ? (
        <div className="mt-8">
          <SectionHeader title="Data and sync" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DataTile label="Repositories" value={stats.repos} />
            <DataTile label="Open pull requests" value={stats.pulls} />
            <DataTile label="Open issues" value={stats.issues} />
            <DataTile label="Members" value={stats.members} />
          </div>
          <p className="mt-2 text-[12px] text-[var(--color-faint)]">
            GitHub data refreshes nightly. Manual refresh: scripts/seed-github.mjs.
          </p>
        </div>
      ) : null}

      {admin ? (
        <div className="mt-8">
          <SectionHeader
            title="Admin activity"
            action={<span>{audit.length} recent actions</span>}
          />
          <Card className="overflow-hidden">
            <AuditLog rows={audit} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function DataTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-[12.5px] text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums text-[var(--color-ink)]">
        {value}
      </div>
    </Card>
  );
}
