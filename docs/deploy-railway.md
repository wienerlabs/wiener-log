# VPS-less deploy: Neon + Railway

No Hetzner, no Mac mini. Data lives on Neon; the three server
processes run as Railway services built from this repo's root
`Dockerfile`. Employee laptops write events straight to Neon, so
NATS is not part of this deployment at all.

```
employee laptop                     Railway project "wienerlog"
---------------                    -----------------------------
wlog daemon run                     ingest   wlog daemon run --gh-listen  <- GitHub webhooks
  --database-url NEON  ---+         engine   wlog engine run              -> Anthropic
git/cc hooks              |         web      wlog-web                     <- browsers
                          v              \       |        /
                        NEON  <----------- all three read/write NEON
                     (Postgres + pgvector, free tier)
```

## 0. Prices and accounts

| Piece | Plan | Cost |
| --- | --- | --- |
| Neon | Free (0.5 GB, autosuspend) | $0 |
| Railway | Hobby | $5/mo flat, includes usage credit |
| Anthropic API | pay-as-you-go | capped by the engine's cost policy |

## 1. Neon (done once)

Already live. The rules that matter:

- Use the **direct** endpoint (host without `-pooler`).
- Keep `?sslmode=require`; **delete** `channel_binding=require`
  (sqlx's rustls path rejects it).
- `wlog init --database-url '<direct-url>'` ran the migrations and
  created the pgvector extension.

Rotate the password now if it was ever pasted into a chat or
screenshot: Neon console, branch, Roles, Reset password. Then
update the URL everywhere it is referenced (steps below + your
local `~/.config/wlog/wlog.toml`).

## 2. Railway project

1. railway.com, New Project, Deploy from GitHub repo,
   `wienerlabs/wienerlog`.
2. Create **three services** from the same repo. Each service picks
   up the root `Dockerfile` automatically; only the start command
   and env vars differ.

### Service `ingest` (GitHub webhook receiver)

- Start command:
  `wlog daemon run --socket /tmp/wlog.sock --gh-listen 0.0.0.0:8080`
  (this is also the repo default via `railway.json`). Port is
  hardcoded to 8080 on purpose: the container ENTRYPOINT is tini, so
  the start command runs without a shell and `${PORT}` would NOT
  expand (it binds the literal string and the GH listener dies). Set
  the domain target port to 8080 to match.
- Env:

  | Var | Value |
  | --- | --- |
  | `WLOG_DAEMON_DATABASE_URL` | Neon direct URL |
  | `WLOG_DAEMON_WORKSPACE` | `wienerlabs` (org-wide events workspace) |
  | `WLOG_GH_SECRET` | webhook HMAC secret (`openssl rand -hex 32`) |
  | `RUST_LOG` | `info` |

- Settings, Networking, **Generate Domain**. Note it:
  `https://<ingest>.up.railway.app`. Your GitHub webhook URL is
  `https://<ingest>.up.railway.app/github-webhook`.

### Service `engine` (synthesis loop)

- Start command: `wlog engine run --interval 60 --batch-min 3`
- Env:

  | Var | Value |
  | --- | --- |
  | `WLOG_DATABASE_URL` | Neon direct URL |
  | `ANTHROPIC_API_KEY` | founder key |
  | `WLOG_SYNTH_MODEL` | `claude-sonnet-4-6` (default) |
  | `WLOG_ENGINE_CURSOR` | `/tmp/engine-cursor` |
  | `RUST_LOG` | `info` |

- No public domain needed.
- Without `ANTHROPIC_API_KEY` the loop runs in observe mode:
  batches are logged, nothing is synthesized, nothing is spent.
- The cursor file is ephemeral on Railway; a redeploy rewinds at
  most one 500-event window, which re-synthesizes recent batches.
  Duplicate proposals are cheap to reject with `wlog ack --reject`.

### Service `web` (dashboard + JSON API)

- Start command: `wlog-web --listen 0.0.0.0:8080`
  (hardcode 8080 for the same no-shell reason as ingest; set the
  domain target port to 8080)
- Env:

  | Var | Value |
  | --- | --- |
  | `WLOG_DATABASE_URL` | Neon direct URL |
  | `RUST_LOG` | `info` |

- Generate Domain: `https://<web>.up.railway.app` is your dashboard
  (`/` HTML, `/health` JSON). Map `wlog.wienerlabs.io` as a custom
  domain later if wanted.

## 3. GitHub webhooks

With the ingest domain live:

```bash
export WLOG_WEBHOOK_URL="https://<ingest>.up.railway.app/github-webhook"
WLOG_GH_WEBHOOK_SECRET='<same hex as WLOG_GH_SECRET>' \
  ./scripts/github-org-integrate.sh --active-days 60

# or one org-level hook (needs the extra scope):
gh auth refresh -h github.com -s admin:org_hook
WLOG_GH_WEBHOOK_SECRET='<same hex>' \
  ./scripts/github-org-integrate.sh --org-hook
```

Confirm with a test PR anywhere in the org, then:

```bash
wlog log --kind gh --all-workspaces --limit 10
```

## 4. Employee laptops (NATS-less)

The installer flow stays the same; the daemon just points at Neon
instead of NATS:

```bash
wlog daemon run --database-url 'postgres://...neon...?sslmode=require'
# or persistently:
export WLOG_DAEMON_DATABASE_URL='postgres://...neon...?sslmode=require'
export WLOG_DAEMON_WORKSPACE=<github-login-slug>
wlog daemon run
```

`WLOG_DAEMON_WORKSPACE` must match the workspace slug created by
`wlog admin sync-members` (the lowercased GitHub login).

Trust model note: this hands each employee a role that can write
events. For the 11-person team that is acceptable; per-user
Postgres roles with insert-only grants are the hardening step when
it matters.

## 5. Verify end to end

```bash
# laptop: emit an event
cd ~/wienerlog && git commit --allow-empty -m "test: vps-less pipeline"

# anywhere: watch it arrive
wlog log --limit 5

# engine service logs (Railway dashboard) show:
#   N new event(s) in <workspace>
# and with ANTHROPIC_API_KEY set, proposals appear:
wlog ls --status proposed
```

## What moved where

| Concern | Hetzner plan | This plan |
| --- | --- | --- |
| Postgres + pgvector | Docker container | Neon |
| Event transport | NATS JetStream | the `events` table itself |
| Webhook receiver | daemon behind Caddy | Railway `ingest` service |
| Synthesis worker | daemon on host | Railway `engine` service |
| Dashboard | wlog-web behind Caddy | Railway `web` service |
| TLS + domain | Caddy + DNS | Railway-managed |
| Backups | pg_dump timer | Neon PITR (plus optional `pg_dump` from a laptop) |
| Monitoring | Grafana + Loki stack | Railway logs + `wlog doctor` (Grafana stack optional later) |

The NATS path is still in the codebase and still works; nothing was
removed. `--database-url` simply takes precedence when set, so the
Hetzner/mac-mini kits remain valid fallbacks.
