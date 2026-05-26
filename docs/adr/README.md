# Architecture Decision Records

This directory holds the Architecture Decision Records (ADRs) for WienerLog.
Every non-obvious architectural or technological choice gets a record so that
future contributors can trace **why** the codebase is shaped the way it is,
not just **what** it does.

## Format

We use [MADR 3.0](https://adr.github.io/madr/). The template lives in
[`template.md`](template.md).

## Lifecycle

1. **Proposed**: PR opened, status set to `Proposed`. Discussion happens in
   the PR or the matching GitHub Discussion.
2. **Accepted**: PR merged. Status flipped to `Accepted` in a follow-up
   commit. The ADR is now binding.
3. **Superseded**: a later ADR replaces this one. Both records keep a
   bidirectional link.

ADRs are immutable once accepted. Corrections that do not change the
decision land as `### Updates` sections appended at the bottom.

## Index

| ID | Title | Status | Date |
| --- | ----- | ------ | ---- |
| [0000](0000-license.md) | License | Accepted | 2026-05-26 |
| [0001](0001-rust-as-primary-language.md) | Rust as primary language | Accepted | 2026-05-26 |

## Numbering

Use the next available four-digit number. Do not reuse retired numbers; if
ADR-0007 is later superseded, keep the file and add a `Status: Superseded by
ADR-NNNN` line.

## Upcoming

The following ADRs are anticipated by phase. Open them when the work begins,
not earlier:

| ID | Topic | Expected phase |
| --- | --- | --- |
| 0002 | Task DAG schema design | Phase 0 |
| 0003 | LLM client crate selection | Phase 1 |
| 0004 | Prompt versioning strategy | Phase 1 |
| 0005 | NATS subject hierarchy | Phase 1 |
| 0006 | Embedding model + dimensionality | Phase 1 |
| 0007 | Estimation model (log-normal vs gamma) | Phase 2 |
| 0008 | Dispatcher decision boundaries | Phase 3 |
| 0009 | Covenant integration model | Phase 3 |
| 0010 | Web framework decision retrospective | Phase 4 |
| 0011 | Solana program reuse vs new program | Phase 4 |
