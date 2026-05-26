#!/usr/bin/env bash
# Install the WienerLog git hooks. Idempotent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -d .git ]]; then
    echo "Not a git repository: ${REPO_ROOT}" >&2
    exit 1
fi

git config core.hooksPath .githooks
chmod +x .githooks/*

echo "Git hooks installed (core.hooksPath = .githooks)"
