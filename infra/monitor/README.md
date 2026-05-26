# Monitoring stack

Grafana + Loki + Promtail + Prometheus, deployed alongside the
production compose stack.

## Apply

```bash
cd ~/wienerlog
docker compose \
  -f infra/hetzner/compose.prod.yml \
  -f infra/monitor/compose.monitor.yml \
  up -d
```

The monitor stack joins the `wlog-prod_default` network so it can
scrape the daemon (`daemon:9789/metrics`) and the web service
(`web:8088/metrics`) by service name.

## What you get

- `http://<host>/grafana` (proxied via Caddy): Grafana 11.x with a
  pre-loaded `WienerLog Overview` dashboard (socket / CC / GH event
  rates, LLM USD today, synthesis p95, daemon logs, tasks by status,
  calibration MAPE).
- Loki retains 30 days of logs (file backend, bind-mounted to
  `/home/wlog/state/loki`).
- Prometheus retains 30 days of TSDB data; scrapes daemon, web, NATS,
  cadvisor (if running), node-exporter (if running).
- Promtail discovers Docker containers and ships their JSON logs
  directly to Loki with `service`, `container`, and `stream` labels.

## Secrets

Before first up:
```bash
ssh wlog@<host> -p 2222 << 'EOF'
  printf "$(openssl rand -base64 24)" > ~/state/secrets/grafana_admin
  chmod 0600 ~/state/secrets/grafana_admin
EOF
```

## Caddy patch

Append to the production `Caddyfile`:
```
@grafana path /grafana/*
handle @grafana {
    reverse_proxy grafana:3000
}
```

The dashboards use metric names exported by the daemon (when the
`--prometheus-listen` flag lands; tracked separately). Until then,
the dashboards render empty for those panels but Loki log panels and
infrastructure metrics still work.
