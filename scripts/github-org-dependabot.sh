#!/usr/bin/env bash
# Roll a standard .github/dependabot.yml out to wienerlabs repositories
# that do not have one yet. Auto-detects the ecosystems present in each
# repo (cargo, npm, pip, gomod, gradle, github-actions) and generates a
# matching config. Dry-run by default; pass --apply to write commits.
#
# Usage:
#   ./scripts/github-org-dependabot.sh --active-days 60
#   ./scripts/github-org-dependabot.sh --repos "wienerlog cortexagent" --apply
#
# Env:
#   WLOG_GH_ORG (default wienerlabs)

set -euo pipefail

ORG="${WLOG_GH_ORG:-wienerlabs}"

apply=0
active_days=0
explicit_repos=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply)       apply=1; shift ;;
        --active-days) active_days="$2"; shift 2 ;;
        --repos)       explicit_repos="$2"; shift 2 ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
warn() { printf "\033[33m%s\033[0m\n" "$*" >&2; }
die()  { printf "\033[31merror:\033[0m %s\n" "$*" >&2; exit 1; }

repos=()
if [[ -n "$explicit_repos" ]]; then
    read -ra repos <<< "$explicit_repos"
elif [[ "$active_days" -gt 0 ]]; then
    cutoff="$(date -u -v-"${active_days}"d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
              || date -u -d "-${active_days} days" +%Y-%m-%dT%H:%M:%SZ)"
    bold "==> Selecting repos pushed since $cutoff"
    while IFS= read -r name; do
        repos+=("$name")
    done < <(gh repo list "$ORG" --limit 200 --json name,pushedAt,isArchived \
             --jq ".[] | select(.pushedAt > \"$cutoff\" and (.isArchived | not)) | .name")
else
    die "pass --repos \"a b c\" or --active-days N"
fi

[[ "${#repos[@]}" -gt 0 ]] || die "no repos matched"
bold "==> Target: ${#repos[@]} repo(s) in $ORG"

file_exists() { # repo path
    gh api "/repos/$ORG/$1/contents/$2" --jq .sha 2>/dev/null || true
}

detect_ecosystems() { # repo -> newline list
    local repo="$1"
    local out=""
    [[ -n "$(file_exists "$repo" "Cargo.toml")" ]]           && out+="cargo\n"
    [[ -n "$(file_exists "$repo" "package.json")" ]]         && out+="npm\n"
    [[ -n "$(file_exists "$repo" "requirements.txt")" ]]     && out+="pip\n"
    [[ -n "$(file_exists "$repo" "pyproject.toml")" ]]       && out+="pip\n"
    [[ -n "$(file_exists "$repo" "go.mod")" ]]               && out+="gomod\n"
    [[ -n "$(file_exists "$repo" "build.gradle.kts")" ]]     && out+="gradle\n"
    [[ -n "$(file_exists "$repo" "build.gradle")" ]]         && out+="gradle\n"
    if gh api "/repos/$ORG/$repo/contents/.github/workflows" --jq 'length' >/dev/null 2>&1; then
        out+="github-actions\n"
    fi
    printf '%b' "$out" | sort -u
}

render_config() { # ecosystems... -> yaml on stdout
    echo "version: 2"
    echo "updates:"
    local eco
    for eco in "$@"; do
        local dir="/"
        cat <<YAML
  - package-ecosystem: "$eco"
    directory: "$dir"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
YAML
    done
}

created=0
skipped_has=0
skipped_none=0

for repo in "${repos[@]}"; do
    if [[ -n "$(file_exists "$repo" ".github/dependabot.yml")" ]]; then
        echo "  = $repo (dependabot.yml already present)"
        skipped_has=$((skipped_has+1))
        continue
    fi
    ecos=()
    while IFS= read -r eco_line; do
        [[ -n "$eco_line" ]] && ecos+=("$eco_line")
    done < <(detect_ecosystems "$repo")
    if [[ "${#ecos[@]}" -eq 0 ]]; then
        echo "  - $repo (no known ecosystem; skipped)"
        skipped_none=$((skipped_none+1))
        continue
    fi
    if [[ "$apply" == "0" ]]; then
        echo "  + $repo (would add: ${ecos[*]})"
        created=$((created+1))
        continue
    fi
    content="$(render_config "${ecos[@]}" | base64)"
    gh api -X PUT "/repos/$ORG/$repo/contents/.github/dependabot.yml" \
        -f message="ci: add dependabot config (${ecos[*]})" \
        -f content="$content" > /dev/null
    echo "  + $repo (added: ${ecos[*]})"
    created=$((created+1))
done

bold "==> Done: $created added/planned, $skipped_has already had one, $skipped_none no ecosystem"
if [[ "$apply" == "0" ]]; then
    warn "dry-run: nothing was written; re-run with --apply to commit"
fi
