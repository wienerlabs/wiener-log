# Contributing to WienerLog

Thank you for your interest in WienerLog. This document captures the
conventions that keep the codebase coherent across phases.

## Ground rules

1. WienerLog is built phase by phase. Do not start work on Phase N+1 until
   Phase N is signed off. Doing so silently breaks the dogfood loop.
2. Every PR delivers a thin end-to-end slice. Layer-only PRs are rejected
   unless they explicitly enable an upcoming vertical slice.
3. Trunk-based development. Branches live at most 48 hours of wall time.
4. Architectural decisions belong in ADRs (`docs/adr/`). Code changes that
   would surprise a future reader without an ADR are pushed back.

## Toolchain

The Rust toolchain is pinned in [`rust-toolchain.toml`](rust-toolchain.toml).
Local development additionally requires:

- Docker and Docker Compose
- `sqlx-cli` (`cargo install sqlx-cli --no-default-features --features rustls,postgres`)
- `cargo-deny`, `cargo-audit`, `cargo-nextest` (installed by
  `scripts/dev-bootstrap.sh`)

## Branching and commits

Branch names use one of:

- `feat/<short-slug>`
- `fix/<short-slug>`
- `refactor/<short-slug>`
- `chore/<short-slug>`
- `docs/<short-slug>`
- `test/<short-slug>`

Commit messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/).
Allowed types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`,
`ci`, `chore`, `revert`. Scopes match crate names (`cli`, `engine`,
`storage`, `ingest-git`, `ingest-cc`, `ingest-gh`, `proto`, `infra`).

Examples:

```text
feat(cli): wlog add accepts repo flag
fix(engine): debounce duplicate session events
refactor(storage)!: rename events.kind -> events.event_kind
```

Breaking changes use `!` after the type/scope and include a `BREAKING CHANGE:`
footer.

All commits MUST be GPG-signed.

## Pull requests

- Use the PR template (`.github/PULL_REQUEST_TEMPLATE.md`).
- Link the issue you are addressing.
- Squash-merge only. The default merge strategy on the repo enforces this.
- CI must be green. Lint, test, audit, build all required before merge.
- Update [`CHANGELOG.md`](CHANGELOG.md) under `[Unreleased]` for any user-visible change.

## Tests

- Unit tests live alongside source as `#[cfg(test)] mod tests`.
- Integration tests live in `tests/` per crate and use `testcontainers` for
  Postgres and NATS dependencies.
- Snapshot tests use [`insta`](https://insta.rs). Always review snapshot diffs
  with `cargo insta review`; do not blanket-accept.

Coverage targets:

- Phase 0–1: ≥ 60%
- Phase 2+: ≥ 75%
- Phase 4 release: ≥ 85% on `engine` and `storage`, ≥ 70% elsewhere

## ADR process

1. Open a discussion in the "Decisions" category if the decision is novel and
   contested.
2. Author an ADR under `docs/adr/NNNN-title.md` using the
   [`template`](docs/adr/template.md). Use the next available number.
3. Open a PR titled `docs(adr): NNNN <title>` with status `Proposed`.
4. Once merged, flip status to `Accepted` in a follow-up commit.
5. ADRs are immutable once accepted. Supersede via a new ADR.

## Security

Security issues do NOT go in public issues. See [SECURITY.md](SECURITY.md).

## License

By submitting a PR you agree to license your contribution under
[AGPL-3.0-or-later](LICENSE).
