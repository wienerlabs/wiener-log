# Hetzner deployment

Production deployment of WienerLog on a Hetzner CX22 (or larger) host.

## Files

- `cloud-init.yml` - first-boot provisioning (Docker, ufw, fail2ban,
  port 2222 ssh-only, wlog user).
- `Dockerfile` - multi-stage build that produces a single image
  containing both `wlog` and `wlog-web` binaries.
- `compose.prod.yml` - Postgres + NATS + daemon + web + Caddy with
  pinned image digests and bind-mount state under `/home/wlog/state`.
- `../caddy/Caddyfile` - reverse proxy for the GH webhook, the
  read-only API, and the healthcheck endpoint.

## Bootstrap

1. Provision the server with cloud-init:
   ```bash
   hcloud server create \
     --name wlog-prod-1 \
     --image debian-12 \
     --type cx22 \
     --location nbg1 \
     --user-data-from-file infra/hetzner/cloud-init.yml
   ```

2. Replace the SSH key placeholder in `cloud-init.yml` with the real
   `~/.ssh/id_ed25519.pub` before first apply.

3. After the host comes up, copy the repo and seed secrets:
   ```bash
   ssh wlog@<host> -p 2222 mkdir -p ~/wienerlog ~/state/secrets
   rsync -azP --exclude target . wlog@<host>:~/wienerlog/
   ssh wlog@<host> -p 2222 << 'EOF'
     printf wlog > ~/state/secrets/pg_user
     printf "$(openssl rand -hex 24)" > ~/state/secrets/pg_password
     chmod 0600 ~/state/secrets/*
     cat <<'ENV' > ~/state/daemon.env
   ANTHROPIC_API_KEY=
   OPENAI_API_KEY=
   WLOG_GH_SECRET=
   WLOG_CC_PROJECTS_DIR=/var/lib/wlog/cc
   ENV
     touch ~/state/web.env
   EOF
   ```

4. Build the image locally and push to GHCR (or build on the host):
   ```bash
   docker build -t ghcr.io/wienerlabs/wienerlog:0.1.0 -f infra/hetzner/Dockerfile .
   docker push ghcr.io/wienerlabs/wienerlog:0.1.0
   ```

5. Start the stack:
   ```bash
   ssh wlog@<host> -p 2222
   cd ~/wienerlog
   docker compose -f infra/hetzner/compose.prod.yml --env-file ~/state/wlog.env up -d
   ```

6. Verify:
   ```bash
   curl -s https://wlog.example.com/healthz
   curl -s https://wlog.example.com/api/workspaces
   ```

## State layout

```
/home/wlog/state/
├── postgres/   # Postgres data dir (bind mount, NOT in Docker volume)
├── nats/       # JetStream store
├── socket/     # Unix socket for hook -> daemon
├── cc/         # CC cursor + scratch
├── caddy/      # Caddy TLS certs and state
├── caddy-config/
└── secrets/
    ├── pg_user
    └── pg_password
```

## Backups

- Postgres: nightly `pg_dump` to a Hetzner Storage Box via cron on the
  host. Restore by re-applying the dump before bringing the daemon up.
- NATS: JetStream stream is replayable from the Postgres events table.
  Stream loss is acceptable.
- Secrets: stored in 1Password; cloud-init seed file rotates yearly.

## Monitoring

- `caddy` writes JSON access logs to stdout; ship via `journald` to
  Grafana Loki.
- The daemon's `tracing` output goes to stdout in JSON when
  `RUST_LOG=info` plus `RUST_LOG_FORMAT=json` (env in `daemon.env`).
- Healthchecks.io: configure a passive check on
  `https://wlog.example.com/healthz` every 5 minutes.
