# Webhook and secret rotation runbook

How to rotate the GitHub webhook HMAC secret, the Anthropic API
key, the OpenAI API key, and the Postgres password without
downtime.

## When to use

- Quarterly rotation cadence (every 90 days).
- A secret leaked (commit, screenshot, log file).
- An employee with access offboarded.
- A provider revoked the credential.
- Suspicious webhook traffic suggests HMAC compromise.

## Preconditions

- SSH access to the Hetzner host.
- Admin in the GitHub org (`wienerlabs`) for webhook secret
  changes.
- Anthropic console access (`cloudmelon74@gmail.com`).
- OpenAI console access (`asesenep15@gmail.com`).
- A backup of `/home/wlog/state/` (or at least of the secret
  files you are about to overwrite).

## Steps

### GitHub webhook secret

The webhook receiver (`wlog-ingest-gh`) verifies the
`X-Hub-Signature-256` header with HMAC-SHA256 using
`WLOG_GH_WEBHOOK_SECRET`. The router supports two-key rollover:

```
WLOG_GH_WEBHOOK_SECRET=<new>
WLOG_GH_WEBHOOK_SECRET_PREV=<old>
```

While both are set, incoming requests verify against either.

1. Generate the new secret:
   ```bash
   openssl rand -hex 32
   ```
2. On the host, write the new secret and keep the old as
   `_PREV`:
   ```bash
   ssh wlog@<host> -p 2222
   sudo -u wlog vim /home/wlog/state/daemon.env
   # set:
   # WLOG_GH_WEBHOOK_SECRET=<new>
   # WLOG_GH_WEBHOOK_SECRET_PREV=<old>
   sudo systemctl restart wlog-daemon.service
   ```
3. Update each GitHub webhook to the new secret:
   - Org webhook: `https://github.com/organizations/wienerlabs/settings/hooks`
   - Per-repo webhooks (loop with `gh api`):
     ```bash
     for repo in $(gh repo list wienerlabs --limit 100 --json name -q '.[].name'); do
         gh api -X PATCH "/repos/wienerlabs/$repo/hooks/<hook-id>" \
             -f config[secret]="$NEW_SECRET"
     done
     ```
4. After 24h (long enough for any in-flight retries to
   succeed against either secret), drop the `_PREV` key:
   ```bash
   sudo -u wlog vim /home/wlog/state/daemon.env
   # remove WLOG_GH_WEBHOOK_SECRET_PREV
   sudo systemctl restart wlog-daemon.service
   ```

### Anthropic API key

1. Anthropic console → API keys → "Create key" → name it
   `wlog-prod-<UTC-stamp>`.
2. Copy the key into the host env file:
   ```bash
   sudo -u wlog vim /home/wlog/state/daemon.env
   # set: WLOG_ANTHROPIC_API_KEY=<new>
   sudo systemctl restart wlog-daemon.service
   ```
3. Confirm the daemon picks up the new key:
   ```bash
   journalctl -u wlog-daemon -n 50 --no-pager | grep -i anthropic
   docker exec wlog-prod-daemon-1 wlog cost --today
   ```
4. Revoke the old key in the Anthropic console.

### OpenAI API key (embeddings)

Same as Anthropic, but the env var is
`WLOG_OPENAI_API_KEY` and the dashboard is `platform.openai.com`.

### Postgres password

1. Pick a new password:
   ```bash
   openssl rand -base64 32
   ```
2. Rotate inside Postgres without downtime:
   ```bash
   docker exec -i wlog-prod-postgres-1 psql -U wlog -d wlog <<EOF
   ALTER USER wlog WITH PASSWORD '<new>';
   EOF
   ```
3. Update the secret file:
   ```bash
   printf "%s" '<new>' | sudo tee /home/wlog/state/secrets/pg_password
   sudo chmod 0600 /home/wlog/state/secrets/pg_password
   ```
4. The daemon and web service read the file at startup. Restart
   them (Postgres itself does not need to restart):
   ```bash
   sudo systemctl restart wlog-daemon.service
   ```
5. Verify both services reconnect cleanly:
   ```bash
   docker logs --tail 80 wlog-prod-daemon-1 | grep -i postgres
   docker logs --tail 80 wlog-prod-web-1    | grep -i postgres
   ```

### Grafana admin password

1. Generate:
   ```bash
   openssl rand -base64 24 | sudo tee /home/wlog/state/secrets/grafana_admin
   sudo chmod 0600 /home/wlog/state/secrets/grafana_admin
   ```
2. Restart Grafana:
   ```bash
   docker compose \
       -f infra/hetzner/compose.prod.yml \
       -f infra/monitor/compose.monitor.yml \
       restart grafana
   ```
3. Log in once with the new password to confirm.

## Verification

- For the GH webhook: send a test ping from the GitHub UI and
  confirm `wlog_gh_events_received_total{result="ok"}`
  increments. Confirm
  `wlog_gh_events_received_total{result="bad_sig"}` stays flat.
- For LLM keys: `wlog cost --today` shows new calls landing.
  Synthesis output continues in Grafana.
- For Postgres: `psql -U wlog -h localhost -p 5435 -c "select 1"`
  succeeds with the new password and the daemon writes a new row
  to `events` within 5 minutes.
- For Grafana: log out and back in with the new admin password.

## Rollback

- If the GitHub webhook verification fails after rotation:
  - Re-enable the old secret as `WLOG_GH_WEBHOOK_SECRET` (move it
    back from `_PREV`).
  - Restart the daemon.
  - File a postmortem to find out why the new secret did not
    propagate to all webhooks.
- If the LLM key is wrong, restore the previous value into
  `daemon.env` and restart. Old keys keep working until you
  explicitly revoke them, so keep them around until you have
  validated the new one for 1h.
- If Postgres password rotation breaks the daemon, restore the
  previous value into the secret file, restart the daemon, and
  run `ALTER USER wlog WITH PASSWORD '<previous>';` to roll the
  database back. (This is why we never delete the previous
  password until both services are confirmed green.)
