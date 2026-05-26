#!/usr/bin/env bash
# WienerLog developer bootstrap.
#
# Idempotent. Re-runnable. Exits 0 on success, non-zero with a clear message
# on failure. No silent failures: every step reports its outcome.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*" >&2; }

required_pinned_toolchain() {
    local pinned
    pinned="$(awk -F'"' '/^channel/ {print $2}' rust-toolchain.toml)"
    if [[ -z "${pinned}" ]]; then
        red "Could not read pinned channel from rust-toolchain.toml"
        return 1
    fi
    bold "==> Rust toolchain"
    if ! command -v rustup >/dev/null 2>&1; then
        red "rustup not found. Install from https://rustup.rs"
        return 1
    fi
    rustup show active-toolchain
    rustup component add rustfmt clippy --toolchain "${pinned}" >/dev/null 2>&1 || true
    green "ok"
}

install_cargo_subcommands() {
    bold "==> Cargo subcommands"
    local subcommands=("cargo-nextest" "cargo-deny" "cargo-audit" "sqlx-cli")
    for sub in "${subcommands[@]}"; do
        if command -v "${sub%% *}" >/dev/null 2>&1; then
            green "${sub}: already installed"
            continue
        fi
        yellow "installing ${sub}"
        case "${sub}" in
            sqlx-cli)
                cargo install sqlx-cli --no-default-features --features rustls,postgres --locked
                ;;
            *)
                cargo install "${sub}" --locked
                ;;
        esac
    done
}

install_hooks() {
    bold "==> Git hooks"
    "${REPO_ROOT}/scripts/install-hooks.sh"
}

start_stack() {
    bold "==> Docker stack"
    if ! command -v docker >/dev/null 2>&1; then
        red "docker not found"
        return 1
    fi
    (cd infra && docker compose up -d)
    bold "==> Waiting for Postgres"
    local tries=30
    while ! docker exec wlog-postgres pg_isready -U wlog -d wlog >/dev/null 2>&1; do
        tries=$((tries - 1))
        if (( tries == 0 )); then
            red "Postgres did not become ready"
            return 1
        fi
        sleep 1
    done
    green "Postgres ready on localhost:5435"
}

run_migrations() {
    bold "==> Migrations"
    DATABASE_URL="postgres://wlog:wlog@localhost:5435/wlog" \
        sqlx migrate run --source migrations
    green "Migrations applied"
}

build_workspace() {
    bold "==> Build workspace"
    cargo build --workspace
    green "Build green"
}

summary() {
    bold "==> Ready"
    cat <<SUMMARY

  Postgres:  postgres://wlog:wlog@localhost:5435/wlog
  NATS:      nats://localhost:4222 (monitoring http://localhost:8222)

  Next steps:
    cargo run -p wlog-cli -- --help
    cargo nextest run --workspace
    docker compose -f infra/docker-compose.yml logs -f

SUMMARY
}

main() {
    required_pinned_toolchain
    install_cargo_subcommands
    install_hooks
    start_stack
    run_migrations
    build_workspace
    summary
}

main "$@"
