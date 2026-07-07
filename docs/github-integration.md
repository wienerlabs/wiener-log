# GitHub org integration

How WienerLog plugs into the `wienerlabs` GitHub organization:
members, repositories, PRs, issues, workflow runs, and Dependabot.

## The event map

Every accepted `X-GitHub-Event` header maps to a NATS subject leaf
(ADR-0007). The receiver is `wlog-ingest-gh`, exposed by the daemon
at `--gh-listen` and fronted by Caddy at
`https://wlog.wienerlabs.io/github-webhook`.

| GitHub event | Subject leaf | Captures |
| --- | --- | --- |
| `push` | `push` | commits landing on any branch |
| `pull_request` | `pr.opened`, `pr.closed`, `pr.merged`, ... | PR lifecycle |
| `pull_request_review` | `pr_review.submitted`, ... | review activity |
| `issues` | `issue.opened`, `issue.closed`, ... | issue lifecycle |
| `issue_comment` | `issue_comment.created`, ... | discussion signal |
| `workflow_run` | `workflow.completed`, ... | CI outcomes |
| `member` | `member.added`, `member.removed` | repo collaborator changes |
| `organization` | `org.member_added`, `org.member_removed`, `org.member_invited` | org membership lifecycle |
| `repository` | `repo.created`, `repo.archived`, `repo.renamed`, ... | repo lifecycle |
| `release` | `release.published`, ... | release activity |

Full subject: `wlog.{workspace}.event.gh.{leaf}`.

Unrecognized event kinds return HTTP 202 without publishing, so
GitHub does not retry them.

### Dependabot and bots

`GhEvent::is_dependabot()` returns true when the sender is
`dependabot[bot]` (or the legacy preview bot). `GhEvent::is_bot()`
matches any `[bot]` sender. The engine uses these to route
dependency bumps into the automated-PR lane instead of human task
synthesis, so your `wlog daily` is not polluted by 30 lockfile
bumps.

## The three integration commands

### 1. Webhooks: `scripts/github-org-integrate.sh`

Installs the WienerLog webhook on org repositories. Two modes:

```bash
# Per-repo hooks over everything pushed in the last 60 days (dry run):
./scripts/github-org-integrate.sh --active-days 60 --dry-run

# Apply with the shared HMAC secret:
WLOG_GH_WEBHOOK_SECRET_FILE=/home/wlog/state/secrets/gh_webhook \
  ./scripts/github-org-integrate.sh --active-days 60

# Single org-level hook (one hook covers every repo, present and future):
gh auth refresh -h github.com -s admin:org_hook   # one-time scope grant
./scripts/github-org-integrate.sh --org-hook
```

Idempotent: repos that already have a hook pointing at the WienerLog
URL are skipped. The org-hook mode is preferred once the scope is
granted; per-repo mode works with the default `repo` scope.

Subscribed events match the table above exactly.

**Precondition**: the webhook endpoint must be live (Hetzner deploy,
see [runbooks/deploy.md](./runbooks/deploy.md)). Installing hooks
against a dead URL floods GitHub's delivery log with failures.

### 2. Members: `wlog admin sync-members`

Mirrors org members into WienerLog workspaces + users:

```bash
gh api /orgs/wienerlabs/members --paginate \
  | wlog admin sync-members --dry-run     # inspect first
gh api /orgs/wienerlabs/members --paginate \
  | wlog admin sync-members               # apply
```

- One workspace per member; slug is the GitHub login lowercased
  with non `[a-z0-9-]` characters folded to `-`
  (`MuhammedAkinci` becomes `muhammedakinci`).
- One user row per member inside their workspace; the handle keeps
  the original login casing.
- Idempotent: existing workspaces/users are reported as `existing`
  and left untouched.
- Targets the DB in `WLOG_ADMIN_DATABASE_URL` (falls back to
  `WLOG_DATABASE_URL`).

Keeping membership current after the initial sync is automatic
once the org webhook is live: `org.member_added` events flow into
the pipeline, and the engine can create the workspace on arrival
(engine-side automation tracked for Phase 5). Until then, re-run
the pipe above after inviting someone.

### 3. Dependabot: `scripts/github-org-dependabot.sh`

Rolls a standard `.github/dependabot.yml` out to repos that lack
one. Auto-detects ecosystems per repo (cargo, npm, pip, gomod,
gradle, github-actions) and writes a weekly, grouped-minor-patch
config:

```bash
# Report coverage (dry run is the default):
./scripts/github-org-dependabot.sh --active-days 60

# Commit configs to the repos that lack one:
./scripts/github-org-dependabot.sh --active-days 60 --apply
```

Status as of 2026-07-07: all 28 actively-pushed wienerlabs repos
already carry a dependabot.yml, so the script currently reports
full coverage and writes nothing.

Dependabot PRs then flow back into WienerLog through the
`pull_request` webhook with `is_dependabot() == true`.

## Current state and gates

| Piece | State |
| --- | --- |
| Webhook receiver code (10 event kinds) | shipped |
| HMAC verify + replay LRU + two-key rotation | shipped |
| `wlog admin sync-members` | shipped |
| Webhook installer script | shipped (dry-run verified over 30 repos) |
| Dependabot rollout script | shipped (verified: 28/28 active repos covered) |
| Org member sync (live run) | local DB synced; prod pending Hetzner |
| Org webhook (live) | pending Hetzner endpoint + `admin:org_hook` scope |
| Engine auto-workspace on `org.member_added` | Phase 5 backlog |

### Token scopes

The operator token (`gh auth status`) needs:

| Scope | Used by |
| --- | --- |
| `repo` | per-repo webhooks, dependabot.yml commits, repo listing |
| `read:org` | member listing |
| `admin:org_hook` | org-level webhook only; grant with `gh auth refresh -h github.com -s admin:org_hook` |
| `workflow` | dependabot.yml under `.github/` in some repos |

### Go-live sequence (after Hetzner deploy)

```bash
# 1. Endpoint answers
curl -fsS https://wlog.wienerlabs.io/health

# 2. Org-wide hook (preferred) or per-repo fallback
gh auth refresh -h github.com -s admin:org_hook
WLOG_GH_WEBHOOK_SECRET_FILE=~/state/secrets/gh_webhook \
  ./scripts/github-org-integrate.sh --org-hook

# 3. Member mirror against prod
gh api /orgs/wienerlabs/members --paginate \
  | WLOG_ADMIN_DATABASE_URL=postgres://wlog_admin:...@wlog.wienerlabs.io:5435/wlog \
    wlog admin sync-members

# 4. Confirm events flow
wlog admin tail --subject 'wlog.*.event.gh.>'
# then open a test PR anywhere in the org and watch it land
```

## Reference

- [ADR-0007: NATS subject hierarchy](./adr/0007-nats-subject-hierarchy.md)
- [Webhook secret rotation](./runbooks/webhook-rotation.md)
- [Control plane manual](./control-plane.md)
- [Onboarding (employee)](./onboarding.md)
