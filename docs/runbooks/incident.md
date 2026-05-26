# Incident response runbook

How to triage and recover from a WienerLog production incident.

## When to use

- Healthchecks.io paged because `/health` failed for 2+ consecutive
  probes (10+ minutes).
- Grafana dashboard panels show 0 events for 30+ minutes during
  expected active window.
- LLM cost ceiling alarm fired (see [llm-cost.md](./llm-cost.md)).
- A user reports stale tasks, missing synthesis output, or web UI
  errors.

## Preconditions

- You can SSH into the host (`wlog@<host> -p 2222`).
- You have the Anthropic console open in case the LLM is the cause.
- Grafana credentials at hand (admin password in
  `/home/wlog/state/secrets/grafana_admin`).
- A recent backup exists (see [backup.md](./backup.md)).

## Steps

### 1. Acknowledge and snapshot

Acknowledge the page so other on-call do not duplicate work.
Snapshot the time, alert source, and a one-line summary in the
incident channel:

```
[wlog] <UTC stamp> ack <source>: <summary>
```

### 2. Confirm scope

```bash
ssh wlog@<host> -p 2222
docker compose -f infra/hetzner/compose.prod.yml ps
systemctl status wlog-daemon
curl -fsS http://127.0.0.1:8088/health || echo "web down"
curl -fsS http://127.0.0.1:8222/healthz || echo "nats down"
docker exec wlog-postgres pg_isready -U "$(cat /home/wlog/state/secrets/pg_user)"
```

Classify into one of:

- **A. Daemon crash loop** (systemd shows repeated restarts).
- **B. Postgres unreachable / disk full / corruption**.
- **C. NATS down / JetStream wedged**.
- **D. Web 5xx but daemon healthy** (template or migration issue).
- **E. LLM provider outage** (synthesis stalls, daemon healthy
  otherwise).
- **F. External webhook flood** (GH event rate spike, queue lag).

### 3. Mitigate

#### A. Daemon crash loop

```bash
journalctl -u wlog-daemon -n 200 --no-pager
docker logs --tail 200 wlog-prod-daemon-1
```

Common causes:
- Bad migration: restore from backup (see [backup.md](./backup.md)).
- LLM API key invalid: rotate via Anthropic console, update
  `daemon.env`, restart.
- Out of memory: `dmesg | tail -40` for OOM kills. Scale the host
  or tune `WLOG_LLM_MAX_CONCURRENCY`.

```bash
sudo systemctl stop wlog-daemon.service
# fix root cause
sudo systemctl start wlog-daemon.service
```

#### B. Postgres trouble

```bash
docker logs --tail 200 wlog-prod-postgres-1
df -h /home/wlog/state/postgres
```

- Disk full: prune `/home/wlog/state/backups/` (oldest first), then
  `docker exec wlog-prod-postgres-1 vacuumdb --full --analyze
  --username=wlog --dbname=wlog`.
- Corruption: restore (see [backup.md](./backup.md)).

#### C. NATS wedged

```bash
docker exec wlog-prod-nats-1 nats stream report
```

- Stream stuck: `nats stream purge wlog-events` (only after
  confirming all consumers have caught up; otherwise data loss).
- File store corruption: stop daemon, `rm -rf
  /home/wlog/state/nats/jetstream/<bad-stream>`, restart. Events
  in-flight will be lost; the daemon re-emits next cycle.

#### D. Web 5xx

```bash
docker logs --tail 200 wlog-prod-web-1
```

Likely a missing template or DB query failure. Roll back to the
previous tag (see [deploy.md](./deploy.md)).

#### E. LLM provider outage

The cost ledger and circuit breaker should already be limiting
calls. Confirm:
```bash
curl -fsS http://127.0.0.1:9789/metrics | grep wlog_llm_
```

If Anthropic is fully down, expect synthesis to fail-soft (tasks
queue but no new candidate output). No action required other than
status-page subscription. If a key is revoked, rotate (see
[webhook-rotation.md](./webhook-rotation.md) for the rotation
pattern).

#### F. Webhook flood

```bash
curl -fsS http://127.0.0.1:8787/metrics | grep wlog_gh_events_received_total
```

- If a single repo is responsible, temporarily disable its webhook
  in the GitHub UI.
- If a malicious source is bypassing HMAC, rotate the secret (see
  [webhook-rotation.md](./webhook-rotation.md)).

### 4. Verify recovery

- All `docker compose ps` services show `Up (healthy)`.
- Healthchecks.io flips back to green.
- Grafana dashboard panels populate normally.
- `/health` returns 200 for three consecutive 5s probes.
- A test event flows through end-to-end (drop a `cc:hook` event,
  watch it land in the `tasks` table).

### 5. Postmortem

Within 48h, file an issue at `wienerlabs/wienerlog` with template
`incident:postmortem`. Capture:

- Timeline (UTC).
- Detection mechanism (alert / user report / chance discovery).
- Root cause.
- What worked, what did not.
- Concrete follow-up actions, each linked to its own issue.

## Rollback

- Every mitigation step above has its own rollback (rolling back a
  bad deploy is in [deploy.md](./deploy.md), restoring DB state is
  in [backup.md](./backup.md)).
- If a mitigation makes things worse, stop the stack entirely:
  ```bash
  sudo systemctl stop wlog-daemon.service
  ```
  Then restore from the most recent known-good backup and bring up
  the previous image tag. Document why in the postmortem.
