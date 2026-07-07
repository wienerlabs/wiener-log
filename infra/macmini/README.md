# Mac mini deployment (VPS-less)

Runs the entire WienerLog server side on the WienerEnvoy Mac mini.
No Hetzner, no VPS. Postgres lives in Neon; the mini carries NATS,
the hub daemon (GitHub webhook receiver + ingest), and the web
dashboard. Employees reach NATS and the dashboard over Tailscale;
GitHub reaches the webhook receiver through Tailscale Funnel.

```
employee laptop            Mac mini (tailnet)                cloud
---------------            ------------------                -----
wlog daemon --tailscale--> nats://mini:4222 (launchd)     Neon Postgres
git hooks                  wlog daemon hub :8787 <--Funnel-- GitHub webhooks
                           wlog-web :8088 (tailnet only)
```

## Prerequisites

- Mac mini already on the tailnet (WienerEnvoy host).
- Tailscale 1.60+ with Funnel enabled for the tailnet
  (admin console: DNS > HTTPS certificates ON, then the funnel
  node attribute).
- Homebrew.
- The Neon connection string (direct endpoint, `sslmode=require`,
  no `channel_binding`, no `-pooler` host).

## 1. Binaries

```bash
brew install nats-server
# Build wlog + wlog-web from the repo (or copy binaries over scp):
cd ~/wienerlog
cargo build --release -p wlog-cli -p wlog-web
install -m 0755 target/release/wlog      /opt/homebrew/bin/wlog
install -m 0755 target/release/wlog-web  /opt/homebrew/bin/wlog-web
```

## 2. State + secrets layout

```bash
sudo mkdir -p /Users/Shared/wlog/{nats,logs,secrets}
sudo chown -R "$(whoami)" /Users/Shared/wlog
chmod 0700 /Users/Shared/wlog/secrets

# GitHub webhook HMAC (mint once, goes to GitHub too):
openssl rand -hex 32 > /Users/Shared/wlog/secrets/gh_webhook

# Neon URL (single line, direct endpoint):
printf '%s' 'postgresql://USER:PASS@ep-....neon.tech/neondb?sslmode=require' \
  > /Users/Shared/wlog/secrets/database_url

chmod 0600 /Users/Shared/wlog/secrets/*
```

Secrets ride in files, not in the plists: launchd plists are
world-readable, so the units reference `WLOG_GH_SECRET_FILE` and
`WLOG_DATABASE_URL_FILE` instead of literal values.

## 3. launchd units

```bash
cd ~/wienerlog
cp infra/macmini/io.wienerlabs.wlog-nats.plist  ~/Library/LaunchAgents/
cp infra/macmini/io.wienerlabs.wlog-hub.plist   ~/Library/LaunchAgents/
cp infra/macmini/io.wienerlabs.wlog-web.plist   ~/Library/LaunchAgents/

launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/io.wienerlabs.wlog-nats.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/io.wienerlabs.wlog-hub.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/io.wienerlabs.wlog-web.plist

# Verify
launchctl print "gui/$(id -u)/io.wienerlabs.wlog-hub" | head -20
tail -F /Users/Shared/wlog/logs/hub.err.log
```

Boot order does not matter: the hub retries NATS, and web talks
only to Neon.

## 4. Tailscale exposure

```bash
# Webhook receiver: PUBLIC via Funnel (GitHub must reach it).
tailscale funnel --bg 8787

# Dashboard: tailnet-only via Serve (employees only).
tailscale serve --bg 8088

tailscale funnel status
```

Funnel gives you a stable public URL like
`https://<mini-host>.<tailnet>.ts.net/`. The webhook route is
`/webhook`, so the full webhook URL is:

```
https://<mini-host>.<tailnet>.ts.net/webhook
```

## 5. GitHub webhooks

```bash
cd ~/wienerlog
WLOG_WEBHOOK_URL="https://<mini-host>.<tailnet>.ts.net/webhook" \
WLOG_GH_WEBHOOK_SECRET_FILE=/Users/Shared/wlog/secrets/gh_webhook \
  ./scripts/github-org-integrate.sh --active-days 60 --dry-run
# then drop --dry-run; or use --org-hook after
# `gh auth refresh -h github.com -s admin:org_hook`
```

## 6. Member mirror + smoke

```bash
gh api /orgs/wienerlabs/members --paginate \
  | WLOG_ADMIN_DATABASE_URL="$(cat /Users/Shared/wlog/secrets/database_url)" \
    wlog admin sync-members

# Watch events flow, then open a test PR anywhere in the org:
wlog admin tail --nats-url nats://127.0.0.1:4222 --subject 'wlog.*.event.gh.>'
```

## 7. Employee wiring

Each employee's daemon publishes over the tailnet:

```bash
# in their installer env (scripts/install-wlog.sh):
WLOG_SERVER=<mini-host>.<tailnet>.ts.net
# daemon flag becomes:
wlog daemon run --nats-url nats://<mini-tailnet-ip>:4222
```

NATS is bound on the mini without public exposure; only tailnet
peers reach 4222. The dashboard is at
`https://<mini-host>.<tailnet>.ts.net:8088/` for tailnet members
(via `tailscale serve`).

## Backups

Neon provides PITR on all plans; that is the primary story. For
belt-and-braces dumps from the mini:

```bash
brew install libpq
PGURL="$(cat /Users/Shared/wlog/secrets/database_url)"
/opt/homebrew/opt/libpq/bin/pg_dump "$PGURL" \
  | gzip > /Users/Shared/wlog/backup-$(date -u +%Y%m%dT%H%MZ).sql.gz
```

Wrap in a launchd StartCalendarInterval unit if nightly dumps are
wanted; PITR usually makes this unnecessary.

## What replaces what

| Hetzner plan | Mac mini plan |
| --- | --- |
| compose.prod postgres container | Neon |
| compose.prod nats container | brew nats-server + launchd |
| compose.prod daemon container | wlog binary + launchd |
| compose.prod web container | wlog-web binary + launchd |
| Caddy + DNS + TLS certs | Tailscale Funnel (public) + Serve (tailnet) |
| systemd units | launchd plists (this directory) |
| backup.timer | Neon PITR (+ optional pg_dump) |
| Grafana/Loki/Prometheus stack | deferred; `wlog admin tail` + logs under /Users/Shared/wlog/logs |

Trade-offs accepted: home-network availability (mini offline =
event'ler NATS'a ulaşamaz; git hook'lar non-blocking olduğu için
commit akışı etkilenmez, kaçan event'ler `wlog admin replay` ile
geri doldurulur), no Grafana until the monitoring overlay finds a
new home.
