#!/usr/bin/env bash
# Nightly Postgres backup for WienerLog.
# Reads env vars from /home/wlog/state/backup.env (see infra/systemd/README.md).
# Writes pg_dump output gzipped to $WLOG_BACKUP_DIR/YYYY-MM-DD-HHMM.sql.gz,
# prunes anything older than $WLOG_BACKUP_RETENTION_DAYS.

set -euo pipefail

: "${WLOG_BACKUP_DIR:?WLOG_BACKUP_DIR not set}"
: "${WLOG_BACKUP_RETENTION_DAYS:=14}"
: "${PGHOST:=localhost}"
: "${PGPORT:=5435}"
: "${PGDATABASE:=wlog}"

if [[ -n "${PGUSER_FILE:-}" && -r "$PGUSER_FILE" ]]; then
    PGUSER="$(<"$PGUSER_FILE")"
fi
if [[ -n "${PGPASSWORD_FILE:-}" && -r "$PGPASSWORD_FILE" ]]; then
    PGPASSWORD="$(<"$PGPASSWORD_FILE")"
fi
export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE

mkdir -p "$WLOG_BACKUP_DIR"
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
out="$WLOG_BACKUP_DIR/wlog-$stamp.sql.gz"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }

bold "==> Dumping $PGDATABASE@$PGHOST:$PGPORT -> $out"
docker exec -e PGPASSWORD="$PGPASSWORD" wlog-postgres \
    pg_dump --no-owner --no-privileges --format=plain --dbname="$PGDATABASE" --username="$PGUSER" \
    | gzip --best > "$out.tmp"
mv "$out.tmp" "$out"
size="$(du -h "$out" | cut -f1)"
bold "==> Wrote $out ($size)"

bold "==> Pruning backups older than ${WLOG_BACKUP_RETENTION_DAYS} days"
find "$WLOG_BACKUP_DIR" -type f -name 'wlog-*.sql.gz' \
    -mtime "+${WLOG_BACKUP_RETENTION_DAYS}" -print -delete

if [[ -n "${HEALTHCHECKS_BACKUP_URL:-}" ]]; then
    curl -fsS -m 10 --retry 3 "$HEALTHCHECKS_BACKUP_URL" > /dev/null || true
fi

bold "==> Backup complete"
