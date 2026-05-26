# Deploy runbook

How to ship a new WienerLog version to the Hetzner host.

## When to use

- A new tag (`vX.Y.Z`) has been pushed to `wienerlabs/wienerlog`.
- A hotfix needs to land on `prod` outside of the normal tag cadence.
- Image rebuild after a base image security patch.

## Preconditions

- You can `ssh wlog@<host> -p 2222` (kh0ra SSH key authorized).
- `/home/wlog/state/` exists with `daemon.env`, `web.env`,
  `secrets/pg_user`, `secrets/pg_password`.
- `infra/systemd/wlog-daemon.service` is installed and enabled.
- GHCR image `ghcr.io/wienerlabs/wienerlog:<tag>` is pushed (Actions
  release pipeline, or local `docker buildx` if Actions billing is
  blocked).
- Backup of the current Postgres state taken within the last 24 hours
  (see [backup.md](./backup.md)).

## Steps

1. SSH into the host and move to the repo checkout:
   ```bash
   ssh wlog@<host> -p 2222
   cd ~/wienerlog
   git fetch origin
   git checkout vX.Y.Z
   ```
2. Confirm the target version's compose file and Caddyfile match the
   running config (`git diff HEAD origin/main -- infra/hetzner/`).
3. Pin the image tag in the environment:
   ```bash
   echo "WLOG_VERSION=vX.Y.Z" | sudo tee /home/wlog/state/version.env
   ```
   `wlog-daemon.service` sources this via `EnvironmentFile=`.
4. Pull the image and restart the stack:
   ```bash
   sudo systemctl restart wlog-daemon.service
   ```
   The unit's `ExecStartPre` runs `docker compose pull`; the
   `ExecStart` brings the stack up with the new tag.
5. Tail logs until `daemon` reports `socket bound` and `web` reports
   `listening on 0.0.0.0:8088`:
   ```bash
   journalctl -u wlog-daemon -f
   ```

## Verification

- `curl -fsS http://127.0.0.1:8088/health` returns `200 OK`.
- `docker compose -f infra/hetzner/compose.prod.yml ps` shows all
  services `Up (healthy)`.
- Grafana `WienerLog Overview` dashboard panels populate within 60s.
- Last synthesis cycle landed (check `tasks` table latest
  `created_at` is fresh).
- `wlog --version` from the host's installed binary matches the
  deployed tag.

## Rollback

1. Restore the previous tag:
   ```bash
   echo "WLOG_VERSION=vPREV" | sudo tee /home/wlog/state/version.env
   sudo systemctl restart wlog-daemon.service
   ```
2. If the new release shipped a Postgres migration that the previous
   binary cannot read, restore from backup (see
   [backup.md](./backup.md) and [incident.md](./incident.md)).
3. File a postmortem issue in `wienerlabs/wienerlog` tagged
   `incident:deploy` with the failing logs attached.
