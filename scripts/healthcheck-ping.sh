#!/usr/bin/env bash
# Pings healthchecks.io after probing the local wlog-web /health endpoint.
# Reads from /home/wlog/state/healthcheck.env:
#   HEALTHCHECKS_URL=https://hc-ping.com/<uuid>
#   WLOG_PING_TARGET=http://127.0.0.1:8088/health

set -euo pipefail

: "${HEALTHCHECKS_URL:?HEALTHCHECKS_URL not set}"
: "${WLOG_PING_TARGET:=http://127.0.0.1:8088/health}"

start="$(date +%s)"
if ! response="$(curl -fsS -m 10 "$WLOG_PING_TARGET")"; then
    curl -fsS -m 10 --retry 3 "${HEALTHCHECKS_URL}/fail" > /dev/null || true
    echo "wlog-web /health failed" >&2
    exit 1
fi
elapsed_ms=$(( ( $(date +%s) - start ) * 1000 ))

curl -fsS -m 10 --retry 3 \
    -H "Content-Type: application/json" \
    --data-binary "$(printf '{"latency_ms":%d,"response":%s}' "$elapsed_ms" "$response")" \
    "$HEALTHCHECKS_URL" > /dev/null
