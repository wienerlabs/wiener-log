# Monitoring runbook

How to read, extend, and troubleshoot the WienerLog observability
stack.

## When to use

- Onboarding a new operator who needs to know what dashboards
  exist.
- Adding a new metric, dashboard panel, or log query.
- Diagnosing why a panel is empty or why an alert never fires.
- Reviewing weekly health before the Friday sync.

## Preconditions

- `infra/monitor/compose.monitor.yml` is layered on top of the
  production compose file (see
  [infra/monitor/README.md](../../infra/monitor/README.md)).
- `/home/wlog/state/secrets/grafana_admin` exists with mode 0600.
- Caddy patch from `infra/monitor/README.md` applied so that
  `/grafana/*` proxies to the Grafana container.
- DNS for `wlog.wienerlabs.io` resolves to the Hetzner host.

## Steps

### Stack layout

| Service     | Port (host) | Purpose                                  |
| ----------- | ----------- | ---------------------------------------- |
| Prometheus  | 9090        | Scrapes daemon, web, NATS, exporters     |
| Loki        | 3100        | Log store, 30-day retention              |
| Promtail    | n/a         | Docker SD log shipper                    |
| Grafana     | 3000        | UI, dashboards, alerts                   |

Only Grafana is exposed externally (via Caddy under `/grafana/`).
Prometheus and Loki listen on the docker network only.

### Built-in dashboard

`WienerLog Overview` (file:
`infra/monitor/grafana/dashboards/wlog-overview.json`) covers:

- Socket event rate (`wlog_socket_events_total`).
- Claude Code hook events (`wlog_cc_events_received_total`).
- GitHub webhook events (`wlog_gh_events_received_total`).
- LLM USD today (`wlog_llm_cost_usd_today`).
- Synthesis p95 latency (`wlog_synthesis_duration_seconds`
  histogram).
- Tasks by status (`wlog_tasks_by_status` gauge).
- Calibration MAPE (`wlog_calibration_mape`).
- Daemon logs panel (Loki, filtered to `service="daemon"`).

### Useful Loki queries

```
{service="daemon"} |= "ERROR"
{service="daemon"} | json | level="error"
{service="web"} | json | latency_ms > 1000
{service="daemon"} | json | target=~"wlog_engine.*"
```

### Useful Prometheus queries

```
sum by (status) (wlog_tasks_by_status)
rate(wlog_llm_calls_total[5m])
histogram_quantile(0.95, sum(rate(wlog_synthesis_duration_seconds_bucket[10m])) by (le))
wlog_llm_cost_usd_today / 15
```

### Adding a panel

1. Edit the dashboard in Grafana UI (admin) and validate visually.
2. Export JSON via the share menu, scrub the runtime fields (`id`,
   `iteration`).
3. Replace
   `infra/monitor/grafana/dashboards/wlog-overview.json` with the
   exported file.
4. Commit and push (direct to `main`).
5. `docker compose -f infra/hetzner/compose.prod.yml -f
   infra/monitor/compose.monitor.yml restart grafana` on the host.

### Adding a metric

1. Define the metric in `wlog-engine` (or owning crate) using the
   `metrics` crate. Use `metrics::counter!` /
   `metrics::histogram!` / `metrics::gauge!` with a name
   prefixed `wlog_`.
2. Document the metric in
   `docs/architecture.md#observability`.
3. Add a Prometheus rule or Grafana panel for it.
4. Bump `wlog-overview.json` to expose it on the dashboard.

### Alerts

Configured in Grafana → Alerting → Alert rules. Current set:

- `wlog-daemon-down`: `up{job="wlog-daemon"} == 0` for 5m.
- `wlog-llm-cost-budget-90`: `wlog_llm_cost_usd_today > 13.5` for
  10m. Page on warning, see [llm-cost.md](./llm-cost.md).
- `wlog-synthesis-p95-slow`:
  `histogram_quantile(0.95, ...) > 8` for 15m.
- `wlog-tasks-stalled`:
  `rate(wlog_tasks_created_total[1h]) == 0` during an active
  workspace window.

Notification target: Pushover via Grafana contact point
`pushover-kh0ra`.

## Verification

- `curl -fsS http://127.0.0.1:9090/-/healthy` returns `Prometheus
  Server is Healthy`.
- `curl -fsS http://127.0.0.1:3100/ready` returns `ready`.
- `curl -fsS http://127.0.0.1:3000/api/health` returns `{"database":
  "ok",...}`.
- `WienerLog Overview` dashboard renders all panels with data.
- Test alert: temporarily lower a threshold, confirm Pushover
  notification arrives, restore the threshold.

## Rollback

- Bad dashboard change: revert the JSON in git and re-deploy.
- Bad Prometheus rule: comment the rule, `docker compose ... restart
  prometheus`.
- Promtail flooding: stop the Promtail container; Loki retains
  whatever shipped before. Fix the scrape config and restart.
- Full stack rollback: take down the monitor overlay
  (`docker compose -f infra/monitor/compose.monitor.yml down`).
  Production stack keeps running; you lose dashboards and logs but
  the daemon is unaffected.
