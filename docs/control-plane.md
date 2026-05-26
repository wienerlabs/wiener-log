# Control plane: founder operator manual

Everything you (the founder) need to operate WienerLog across the
whole Wiener Labs team.

## Quick mental model

```
employee laptop                Hetzner prod host
---------------                -----------------
wlog daemon  ----nats-tls---> nats:4222
hooks (git)                     |
  |                             v
  socket                    wlog-engine (consumer + synth + triage)
                                |
                                v
                         Postgres (pgvector)
                                |
                  +-------------+--------------+
                  v             v              v
              wlog-web      Grafana        wlog admin
              (Axum API)    (dash)         (your CLI)
```

You have **four** surfaces to operate from:

1. **Grafana** at `https://wlog.wienerlabs.io/grafana` for dashboards
   and alerting.
2. **`wlog admin`** subcommands from your laptop for live queries.
3. **`wlog-web`** at `https://wlog.wienerlabs.io/` for the read-only
   web UI.
4. **SSH** to the Hetzner host for everything else.

## One-time setup on your laptop

```bash
export WLOG_ADMIN_DATABASE_URL=postgres://wlog_admin:<pw>@wlog.wienerlabs.io:5435/wlog
export WLOG_NATS_URL=nats://nats.wlog.wienerlabs.io:4222
```

(Drop these into `~/.zshenv` so they persist.)

Verify:

```bash
wlog status
wlog admin workspaces
```

## Daily checks (3 minutes)

```bash
# 1. Quick health gate
curl -fsS https://wlog.wienerlabs.io/health
wlog status

# 2. Grafana "WienerLog Overview" dashboard
open https://wlog.wienerlabs.io/grafana/d/wlog-overview

# 3. Spending vs cap
wlog cost --days 1
```

What you are looking for:

- `wlog_llm_cost_usd_today` under 80% of the daily cap.
- Synthesis p95 latency under 5s.
- No daemon restarts in the last 24h.
- Tasks-by-status panel: no workspace stuck at zero new tasks.

## Weekly review (15 minutes)

```bash
# Spend rollup
wlog cost --days 7

# Calibration check (acks vs edits ratio)
ssh wlog@wlog.wienerlabs.io -p 2222
docker exec wlog-prod-postgres-1 psql -U wlog -d wlog <<'EOF'
SELECT
    w.slug,
    count(*) FILTER (WHERE t.status = 'acked')   AS acked,
    count(*) FILTER (WHERE t.status = 'edited')  AS edited,
    count(*) FILTER (WHERE t.status = 'rejected') AS rejected,
    round( 100.0 * count(*) FILTER (WHERE t.status IN ('acked','edited'))
                          / nullif(count(*),0)
         , 1)                                     AS accept_pct
FROM tasks t
JOIN workspaces w ON w.id = t.workspace_id
WHERE t.created_at > now() - interval '7 days'
GROUP BY w.slug
ORDER BY accept_pct DESC NULLS LAST;
EOF
```

Anyone below 60% acceptance probably has a prompt drift problem;
look at their `wlog ack --edit` history and consider a prompt
version bump.

## Live monitoring

`wlog admin tail` is the firehose. It subscribes to `wlog.>` on
NATS and prints every event in real time, with subject + body
preview:

```bash
wlog admin tail
```

Filter to one user:

```bash
wlog admin tail --subject 'wlog.kh0ra.>'
```

Filter to one channel:

```bash
wlog admin tail --subject 'wlog.*.event.cc.*'   # all CC events, any workspace
wlog admin tail --subject 'wlog.*.event.gh.pr.*' # all PR-related GH events
```

For Loki-backed log search use Grafana → Explore.

## Cross-workspace queries

```bash
wlog admin users          # all users, all workspaces
wlog admin workspaces     # all workspaces
```

Anything ad-hoc, drop into `psql` on the host:

```bash
ssh wlog@wlog.wienerlabs.io -p 2222
docker exec -it wlog-prod-postgres-1 psql -U wlog -d wlog
```

Useful queries are in [runbooks/incident.md](./runbooks/incident.md)
and [runbooks/llm-cost.md](./runbooks/llm-cost.md).

## Onboarding a new employee

1. Pick a slug (lowercase, hyphens, 2..40 chars). Convention is the
   employee's GitHub handle, e.g. `kh0ra`.
2. Create the workspace + their user row on the host:
   ```bash
   ssh wlog@wlog.wienerlabs.io -p 2222
   docker exec wlog-prod-daemon-1 wlog init --slug <slug> --name "<Their Name>" \
       --database-url postgres://wlog@postgres:5432/wlog
   docker exec wlog-prod-daemon-1 wlog add ... # bootstrap task if you want
   ```
3. Mint their read replica role:
   ```sql
   CREATE ROLE <slug>_reader LOGIN PASSWORD '<random>';
   GRANT CONNECT ON DATABASE wlog TO <slug>_reader;
   GRANT USAGE ON SCHEMA public TO <slug>_reader;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO <slug>_reader;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO <slug>_reader;
   ```
4. Drop the password into 1Password as `wlog-replica/<slug>`.
5. DM the employee a link to [docs/onboarding.md](./onboarding.md).
6. Watch `wlog admin tail --subject 'wlog.<slug>.>'` for their first
   commit; if it shows up, they are fully wired.

## Suspending an employee

There are three layers; revoke from outside-in.

1. **NATS publish rights**: rotate the shared secret (see
   [runbooks/webhook-rotation.md](./runbooks/webhook-rotation.md)).
   This stops their daemon from publishing anything new. Already
   noisy if they are still online; pair with the next steps.
2. **Postgres reader role**: `ALTER ROLE <slug>_reader NOLOGIN;`
   so they cannot run `wlog ls`, `wlog daily`, etc.
3. **Workspace data**: usually keep it for the calibration record.
   If you need to nuke it:
   ```sql
   BEGIN;
   DELETE FROM tasks WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = '<slug>');
   DELETE FROM users WHERE workspace_id = (SELECT id FROM workspaces WHERE slug = '<slug>');
   DELETE FROM workspaces WHERE slug = '<slug>';
   COMMIT;
   ```

## Cost control

Daily cap is enforced by the engine (`WLOG_LLM_DAILY_USD_CAP`,
default $15) and rolling 7-day cap (`WLOG_LLM_ROLLING_USD_CAP`,
default $75). When breached, the circuit breaker fail-soft: new
synthesis defers, triage falls back to rules-only, ack/edit/search
keep working.

See [runbooks/llm-cost.md](./runbooks/llm-cost.md) for the full
breach response.

## When something breaks

[runbooks/incident.md](./runbooks/incident.md) is the on-call
playbook. Decision tree:

- Healthchecks paged: start there.
- Grafana panels show zero: NATS or daemon trouble; tail with
  `wlog admin tail` first to confirm publishes are landing.
- Web returns 5xx but daemon is healthy: roll the web image back
  ([runbooks/deploy.md](./runbooks/deploy.md)).
- LLM bill spike: [runbooks/llm-cost.md](./runbooks/llm-cost.md).
- Suspected webhook abuse: rotate immediately
  ([runbooks/webhook-rotation.md](./runbooks/webhook-rotation.md)).

## Backups

Nightly at 03:23 UTC via `wlog-backup.timer`. Off-host copy is
your responsibility; configure rclone or `aws s3 sync` per
[runbooks/backup.md](./runbooks/backup.md).

Restore drill: every quarter, restore the latest dump into a
disposable container, run `wlog admin workspaces`, confirm row
counts match the production dashboard panel. Document the result
in a session report under `reports/sessions/`.

## Where the data lives

| Data | Location | Owner |
| --- | --- | --- |
| Tasks, edges, events, users, workspaces | Postgres `wlog` schema | founder |
| Event stream (last 24h) | NATS JetStream `wlog-events` | founder |
| LLM cost ledger | `reports/cost/YYYY-MM-DD.md` on host | founder |
| Logs (30d retention) | Loki `/home/wlog/state/loki` | founder |
| Metrics (30d retention) | Prometheus TSDB | founder |
| Grafana dashboards | `infra/monitor/grafana/dashboards/` (git) | both |
| Employee binary + config | their laptop | employee |
| Their git hooks | their repo `.git/hooks/` | employee |

## Reference

- [Architecture](./architecture.md)
- [ADRs](./adr/)
- [Runbooks](./runbooks/README.md)
- [Onboarding (employee view)](./onboarding.md)
