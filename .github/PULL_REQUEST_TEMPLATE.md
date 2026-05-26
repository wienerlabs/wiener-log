<!-- Title format: type(scope): short imperative summary (Conventional Commits) -->

## Why

<!-- Link to issue + business motivation. -->
Fixes #

## What

<!-- One-sentence summary, then bullet list of substantive changes. -->

## How

<!-- Implementation approach, notable design decisions, links to relevant ADRs. -->

## Verification

<!-- Specific steps a reviewer can take to verify behavior. Include exact
     commands so the reviewer does not have to invent them. -->

```bash
# example
cargo nextest run -p wlog-storage
```

## Risk

<!-- What could break? Migration concerns? Performance? Security?
     Be explicit about blast radius. -->

## Checklist

- [ ] Tests added or updated (`cargo nextest run --workspace` green)
- [ ] `cargo fmt --all -- --check` green
- [ ] `cargo clippy --workspace --all-targets -- -D warnings` green
- [ ] Documentation updated where behavior changed
- [ ] `CHANGELOG.md` entry added under `[Unreleased]`
- [ ] ADR created if architecturally significant
- [ ] No secrets in diff
- [ ] Commit messages follow Conventional Commits
- [ ] Commits are GPG-signed
