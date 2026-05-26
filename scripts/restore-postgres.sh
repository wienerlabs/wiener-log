#!/usr/bin/env bash
# Restore a WienerLog Postgres backup created by scripts/backup-postgres.sh.
# Usage: ./scripts/restore-postgres.sh <path-to-backup.sql.gz>

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "usage: $0 <path-to-backup.sql.gz>" >&2
    exit 2
fi
backup="$1"
if [[ ! -r "$backup" ]]; then
    echo "backup file not readable: $backup" >&2
    exit 2
fi

: "${PGDATABASE:=wlog}"
: "${PGHOST:=localhost}"
: "${PGPORT:=5435}"
if [[ -n "${PGUSER_FILE:-}" && -r "$PGUSER_FILE" ]]; then PGUSER="$(<"$PGUSER_FILE")"; fi
if [[ -n "${PGPASSWORD_FILE:-}" && -r "$PGPASSWORD_FILE" ]]; then PGPASSWORD="$(<"$PGPASSWORD_FILE")"; fi
export PGUSER PGPASSWORD PGHOST PGPORT PGDATABASE

read -rp "Restoring will DROP and recreate database $PGDATABASE. Continue? [y/N] " ans
case "$ans" in y|Y|yes) ;; *) echo aborted; exit 1;; esac

docker exec -e PGPASSWORD="$PGPASSWORD" wlog-postgres \
    psql --username="$PGUSER" --dbname=postgres \
    -c "DROP DATABASE IF EXISTS $PGDATABASE;" \
    -c "CREATE DATABASE $PGDATABASE OWNER $PGUSER;"

gunzip -c "$backup" | docker exec -i -e PGPASSWORD="$PGPASSWORD" wlog-postgres \
    psql --quiet --single-transaction --username="$PGUSER" --dbname="$PGDATABASE"

echo "restore complete"
