#!/usr/bin/env bash
# Install WienerLog webhooks across wienerlabs repositories.
#
# Usage:
#   # Dry run over repos pushed in the last 60 days:
#   ./scripts/github-org-integrate.sh --active-days 60 --dry-run
#
#   # Apply to an explicit list:
#   ./scripts/github-org-integrate.sh --repos "wienerlog cortexagent condorcet"
#
#   # Attempt a single org-level hook instead of per-repo hooks
#   # (requires `gh auth refresh -h github.com -s admin:org_hook`):
#   ./scripts/github-org-integrate.sh --org-hook
#
# Env:
#   WLOG_WEBHOOK_URL     (default https://wlog.wienerlabs.io/github-webhook)
#   WLOG_GH_WEBHOOK_SECRET or WLOG_GH_WEBHOOK_SECRET_FILE (required for apply)
#   WLOG_GH_ORG          (default wienerlabs)
#
# Events subscribed: push, pull_request, pull_request_review, issues,
# issue_comment, workflow_run, member, organization, repository, release.
# These map 1:1 onto GhEventKind in crates/wlog-ingest-gh/src/event.rs.

set -euo pipefail

ORG="${WLOG_GH_ORG:-wienerlabs}"
URL="${WLOG_WEBHOOK_URL:-https://wlog.wienerlabs.io/github-webhook}"
EVENTS='["push","pull_request","pull_request_review","issues","issue_comment","workflow_run","member","organization","repository","release"]'

dry_run=0
org_hook=0
active_days=0
explicit_repos=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)     dry_run=1; shift ;;
        --org-hook)    org_hook=1; shift ;;
        --active-days) active_days="$2"; shift 2 ;;
        --repos)       explicit_repos="$2"; shift 2 ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
warn() { printf "\033[33m%s\033[0m\n" "$*" >&2; }
die()  { printf "\033[31merror:\033[0m %s\n" "$*" >&2; exit 1; }

secret=""
if [[ "$dry_run" == "0" ]]; then
    if [[ -n "${WLOG_GH_WEBHOOK_SECRET:-}" ]]; then
        secret="$WLOG_GH_WEBHOOK_SECRET"
    elif [[ -n "${WLOG_GH_WEBHOOK_SECRET_FILE:-}" && -r "$WLOG_GH_WEBHOOK_SECRET_FILE" ]]; then
        secret="$(<"$WLOG_GH_WEBHOOK_SECRET_FILE")"
    else
        die "set WLOG_GH_WEBHOOK_SECRET or WLOG_GH_WEBHOOK_SECRET_FILE (or pass --dry-run)"
    fi
fi

hook_config() {
    printf '{"url":"%s","content_type":"json","secret":"%s","insecure_ssl":"0"}' "$URL" "$secret"
}

# ---------------------------------------------------------------- org hook

if [[ "$org_hook" == "1" ]]; then
    bold "==> Installing ONE org-level hook on $ORG -> $URL"
    if [[ "$dry_run" == "1" ]]; then
        echo "DRY RUN: would POST /orgs/$ORG/hooks (events: $EVENTS)"
        exit 0
    fi
    existing="$(gh api "/orgs/$ORG/hooks" --jq \
        "[.[] | select(.config.url == \"$URL\")] | length" 2>/dev/null || echo "ERR")"
    if [[ "$existing" == "ERR" ]]; then
        die "cannot list org hooks; run: gh auth refresh -h github.com -s admin:org_hook"
    fi
    if [[ "$existing" != "0" ]]; then
        bold "==> Org hook already exists; nothing to do"
        exit 0
    fi
    gh api -X POST "/orgs/$ORG/hooks" \
        -f name=web \
        -F active=true \
        --input <(printf '{"name":"web","active":true,"events":%s,"config":%s}' \
                  "$EVENTS" "$(hook_config)")
    bold "==> Org hook installed"
    exit 0
fi

# ---------------------------------------------------------------- repo list

repos=()
if [[ -n "$explicit_repos" ]]; then
    read -ra repos <<< "$explicit_repos"
elif [[ "$active_days" -gt 0 ]]; then
    cutoff="$(date -u -v-"${active_days}"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
              || date -u -d "-${active_days} days" +%Y-%m-%dT%H:%M:%SZ)"
    bold "==> Selecting repos pushed since $cutoff"
    while IFS= read -r name; do
        repos+=("$name")
    done < <(gh repo list "$ORG" --limit 200 --json name,pushedAt \
             --jq ".[] | select(.pushedAt > \"$cutoff\") | .name")
else
    die "pass --repos \"a b c\" or --active-days N (or --org-hook)"
fi

[[ "${#repos[@]}" -gt 0 ]] || die "no repos matched"

bold "==> Target: ${#repos[@]} repo(s) in $ORG -> $URL"
printf '    %s\n' "${repos[@]}"

# ---------------------------------------------------------------- apply

installed=0
skipped=0
for repo in "${repos[@]}"; do
    existing="$(gh api "/repos/$ORG/$repo/hooks" --jq \
        "[.[] | select(.config.url == \"$URL\")] | length" 2>/dev/null || echo 0)"
    if [[ "$existing" != "0" ]]; then
        echo "  = $repo (hook already present)"
        skipped=$((skipped+1))
        continue
    fi
    if [[ "$dry_run" == "1" ]]; then
        echo "  + $repo (would install)"
        installed=$((installed+1))
        continue
    fi
    printf '{"name":"web","active":true,"events":%s,"config":%s}' \
        "$EVENTS" "$(hook_config)" \
        | gh api -X POST "/repos/$ORG/$repo/hooks" --input - > /dev/null
    echo "  + $repo (installed)"
    installed=$((installed+1))
done

bold "==> Done: $installed installed/planned, $skipped already present"
if [[ "$dry_run" == "1" ]]; then
    warn "dry-run: nothing was written; re-run without --dry-run to apply"
fi
