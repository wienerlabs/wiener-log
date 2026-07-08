#!/bin/sh
# Role dispatcher for the Railway VPS-less deployment. All three
# services build the same image and share this entrypoint; they differ
# only by the WLOG_ROLE environment variable, so the whole stack can be
# provisioned with `railway add --variables` and no per-service custom
# start command. See docs/deploy-railway.md.
#
# Roles:
#   ingest (default) - GitHub webhook receiver + socket + CC worker,
#                      writing straight to Postgres (PgSink).
#   engine           - synthesis poll loop over the events table.
#   web              - read-only HTML dashboard + JSON API.
#
# This runs under /bin/sh, so ${PORT} expands here (unlike the tini
# exec-form CMD), and Railway's injected PORT is honored with an 8080
# fallback.

set -eu

role="${WLOG_ROLE:-ingest}"
port="${PORT:-8080}"

case "$role" in
    ingest)
        exec wlog daemon run \
            --socket /tmp/wlog.sock \
            --gh-listen "0.0.0.0:${port}"
        ;;
    engine)
        exec wlog engine run \
            --interval "${WLOG_ENGINE_INTERVAL:-60}" \
            --batch-min "${WLOG_ENGINE_BATCH_MIN:-3}"
        ;;
    web)
        exec wlog-web --listen "0.0.0.0:${port}"
        ;;
    *)
        echo "wlog-entrypoint: unknown WLOG_ROLE='$role' (want ingest|engine|web)" >&2
        exit 2
        ;;
esac
