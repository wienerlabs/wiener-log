# systemd units

Install on a Hetzner host that already ran `cloud-init.yml`.

## Bootstrap

```bash
ssh wlog@<host> -p 2222
cd ~/wienerlog
sudo install -m 0644 infra/systemd/wlog-daemon.service     /etc/systemd/system/
sudo install -m 0644 infra/systemd/wlog-backup.service     /etc/systemd/system/
sudo install -m 0644 infra/systemd/wlog-backup.timer       /etc/systemd/system/
sudo install -m 0644 infra/systemd/wlog-healthcheck.service /etc/systemd/system/
sudo install -m 0644 infra/systemd/wlog-healthcheck.timer  /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wlog-daemon.service
sudo systemctl enable --now wlog-backup.timer
sudo systemctl enable --now wlog-healthcheck.timer
```

## Required env files (under `/home/wlog/state/`)

`daemon.env`: env vars for the compose stack (Anthropic key, GH
secret, NATS workspace).

`backup.env`:
```
WLOG_BACKUP_DIR=/home/wlog/state/backups
WLOG_BACKUP_RETENTION_DAYS=14
PGHOST=localhost
PGPORT=5435
PGUSER_FILE=/home/wlog/state/secrets/pg_user
PGPASSWORD_FILE=/home/wlog/state/secrets/pg_password
PGDATABASE=wlog
```

`healthcheck.env`:
```
HEALTHCHECKS_URL=https://hc-ping.com/<your-uuid>
WLOG_PING_TARGET=http://127.0.0.1:8088/health
```

## Verify

```bash
systemctl status wlog-daemon
journalctl -u wlog-daemon -f
systemctl list-timers wlog-*
```
