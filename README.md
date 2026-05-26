<!-- markdownlint-disable MD041 -->
<div align="center">

# WienerLog

**Activity-aware task synthesis. The system watches; you confirm.**

[![CI](https://github.com/wienerlabs/wienerlog/actions/workflows/ci.yml/badge.svg)](https://github.com/wienerlabs/wienerlog/actions/workflows/ci.yml)
[![Security audit](https://github.com/wienerlabs/wienerlog/actions/workflows/security.yml/badge.svg)](https://github.com/wienerlabs/wienerlog/actions/workflows/security.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![MSRV](https://img.shields.io/badge/MSRV-1.95-orange)](rust-toolchain.toml)
[![ADRs](https://img.shields.io/badge/ADRs-3-purple)](docs/adr/)
[![Phase](https://img.shields.io/badge/phase--1-genesis-lightgrey)](docs/adr/)

</div>

---

## What this is

WienerLog inverts the conventional ticket-first workflow: developers do not
keep records. The system passively observes git activity, Claude Code
sessions, and GitHub events; an LLM pipeline converts those signals into task
nodes retrospectively. The developer only confirms or corrects.

Built for [Wiener Labs](https://wienerlabs.xyz) and for itself: WienerLog
tracks WienerLog's own development.

## Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│  Ingestion        git hooks │ Claude Code probe │ GitHub webhooks │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ NATS JetStream
┌─────────────────────────────────▼────────────────────────────────┐
│  Storage          Postgres 16 + pgvector │ Cloudflare R2 │ Solana │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│  Engine           Synthesis │ Task DAG │ Calibration │ Dispatcher │
└─────────────────────────────────┬────────────────────────────────┘
                                  │
┌─────────────────────────────────▼────────────────────────────────┐
│  Surface          wlog CLI │ Editor LSP probe │ Web dashboard     │
└──────────────────────────────────────────────────────────────────┘
```

Read the long form in [docs/architecture.md](docs/architecture.md).

## Quickstart

> Phase -1 ships scaffolding only. The CLI subcommands print placeholder
> messages; real behavior arrives in Phase 0.

```bash
# Toolchain (pinned in rust-toolchain.toml)
rustup show

# Build the workspace
cargo build --workspace

# Run the CLI
cargo run -p wlog-cli -- --help
```

When you are ready to develop, run the bootstrap script which provisions the
local stack:

```bash
./scripts/dev-bootstrap.sh
```

## Workspace layout

| Crate | Purpose |
| ----- | ------- |
| [`wlog-cli`](crates/wlog-cli) | `wlog` command, the primary surface |
| [`wlog-engine`](crates/wlog-engine) | Synthesis, calibration, dispatch |
| [`wlog-storage`](crates/wlog-storage) | Postgres + pgvector access layer |
| [`wlog-ingest-git`](crates/wlog-ingest-git) | git hook installer + event publisher |
| [`wlog-ingest-cc`](crates/wlog-ingest-cc) | Claude Code session probe |
| [`wlog-ingest-gh`](crates/wlog-ingest-gh) | GitHub webhook receiver |
| [`wlog-proto`](crates/wlog-proto) | Shared types and event contracts |
| [`wlog-testutil`](crates/wlog-testutil) | Internal test helpers, not published |

## Project status

WienerLog is built in five phases over roughly eight weeks. The roadmap lives
in the GitHub Projects board and is summarized below.

| Phase | Goal | Status |
| ----- | ---- | ------ |
| -1 | Genesis: scaffold, CI, ADRs, governance | in progress |
| 0 | Skeleton: storage, CLI surface, manual tasks | planned |
| 1 | Synthesis pipeline from real activity | planned |
| 2 | Calibration: estimation accuracy tracking | planned |
| 3 | Agent dispatch + Covenant integration | planned |
| 4 | Web dashboard + Solana audit checkpoints | planned |

## Decisions

All non-obvious architectural decisions are recorded in
[`docs/adr/`](docs/adr/). Two ADRs ship with the genesis commit:

- [ADR-0000: License](docs/adr/0000-license.md): why AGPL-3.0-or-later.
- [ADR-0001: Primary language](docs/adr/0001-rust-as-primary-language.md): why Rust.
- [ADR-0002: Public repository + branch protection](docs/adr/0002-public-repository-and-branch-protection.md): why public, and the ruleset on `main`.

## Contributing

WienerLog is developed primarily by [Virjilakrum](https://github.com/kh0ra)
under the Wiener Labs umbrella. External contributions are welcome subject to
the AGPL-3.0 terms and the [contributor guide](CONTRIBUTING.md). Security
issues belong in [SECURITY.md](SECURITY.md).

## License

Distributed under the [GNU Affero General Public License v3.0 or later](LICENSE).
Network use is conveyed use: if you run WienerLog as a service you must offer
its source to your users.
