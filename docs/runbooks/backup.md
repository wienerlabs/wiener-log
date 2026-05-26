# Backup and restore runbook

How to back up and restore the WienerLog Postgres database.

## When to use

- **Backup**: nightly via `wlog-backup.timer` (03:23 UTC). Manual
  before a risky migration or destructive operation.
- **Restore**: after data loss, corruption, a failed migration, or
  when bootstrapping a new host from a known-good snapshot.

## Preconditions

- `infra/systemd/wlog-backup.{service,timer}` installed and the
  timer is enabled (`systemctl list-timers wlog-backup.timer`).
- `/home/wlog/state/backup.env` populated (see
  [infra/systemd/README.md](../../infra/systemd/README.md)).
- `/home/wlog/state/secrets/{pg_user,pg_password}` exist with mode
  `0600`.
- `scripts/backup-postgres.sh` and `scripts/restore-postgres.sh` are
  executable in the checkout.
- For restore: enough free space on `WLOG_BACKUP_DIR` to hold the
  uncompressed dump (roughly 4x the gzip).

## Steps

### Manual backup

```bash
ssh wlog@<host> -p 2222
cd ~/wienerlog
set -a; source /home/wlog/state/backup.env; set +a
./scripts/backup-postgres.sh
```

The script:
1. Reads `PGUSER`/`PGPASSWORD` from the secret files.
2. Dumps `wlog` from the `wlog-postgres` container with `pg_dump
   --no-owner --no-privileges --format=plain`.
3. Gzips to `$WLOG_BACKUP_DIR/wlog-<UTC-stamp>.sql.gz` via an atomic
   `.tmp` + `mv`.
4. Prunes anything older than `WLOG_BACKUP_RETENTION_DAYS` (default
   14).
5. Pings `HEALTHCHECKS_BACKUP_URL` on success if set.

### Off-host copy

Pull the latest dump to your workstation:
```bash
rsync -avz --progress \
    -e "ssh -p 2222" \
    wlog@<host>:/home/wlog/state/backups/ \
    ~/backups/wienerlog/
```

Or push to S3/B2 from the host:
```bash
aws s3 sync /home/wlog/state/backups/ s3://wienerlabs-backups/wienerlog/ \
    --storage-class STANDARD_IA
```

### Restore

```bash
ssh wlog@<host> -p 2222
cd ~/wienerlog
set -a; source /home/wlog/state/backup.env; set +a
./scripts/restore-postgres.sh /home/wlog/state/backups/wlog-<stamp>.sql.gz
```

The script will:
1. Prompt for `y/N` confirmation (typing anything else aborts).
2. `DROP DATABASE IF EXISTS wlog; CREATE DATABASE wlog OWNER wlog;`
3. Stream `gunzip -c <file> | psql --single-transaction`.

Stop the daemon before restoring so it does not race against the
recreated schema:
```bash
sudo systemctl stop wlog-daemon.service
```

After restore completes:
```bash
sudo systemctl start wlog-daemon.service
journalctl -u wlog-daemon -f
```

## Verification

- `ls -lh /home/wlog/state/backups/` shows the new file with a
  non-empty size.
- `gunzip -t /home/wlog/state/backups/wlog-<stamp>.sql.gz` exits 0.
- Healthchecks.io ping for `wlog-backup` shows `up`.
- Restore: `SELECT count(*) FROM tasks;` returns the expected row
  count, `SELECT max(created_at) FROM events;` matches the dump
  window, `SELECT * FROM _sqlx_migrations ORDER BY version DESC
  LIMIT 1;` shows the expected schema version.
- Daemon comes up healthy and the synthesis cycle completes.

## Rollback

- A botched restore should be re-run from a different (earlier)
  backup. The `--single-transaction` flag ensures `psql` rolls the
  whole stream back on any error, so a failed restore leaves the
  freshly created empty database in place.
- If the wrong backup was applied, restore again from the correct
  file; there is no in-place undo.
- If `DROP DATABASE` blocked because of an active session, list
  with `SELECT pid, usename, application_name FROM
  pg_stat_activity WHERE datname='wlog';` and `pg_terminate_backend`
  the rogue connections, then re-run the restore.
