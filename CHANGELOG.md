# Changelog

All notable changes to WienerLog are documented in this file. The format is
based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once it reaches v1.0.0.

## [Unreleased]

### Added

- Workspace scaffolding for all eight crates (`wlog-cli`, `wlog-engine`,
  `wlog-storage`, `wlog-ingest-{git,cc,gh}`, `wlog-proto`, `wlog-testutil`).
- Root governance documents: README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
- ADR template plus ADR-0000 (license) and ADR-0001 (primary language).
- CI workflows: lint, test, build, audit, deny, release, docs, security scan.
- `.github/` issue and PR templates, CODEOWNERS, Dependabot policy.
- Local development stack: Docker Compose with Postgres 16 + pgvector + NATS.
- Dev bootstrap and git hook installation scripts.

### Notes

This is the genesis release. No user-facing behavior yet; the CLI surface
prints placeholders. Phase 0 begins after sign-off.
