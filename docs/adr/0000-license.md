# 0000 — License

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: governance, licensing

## Context and Problem Statement

WienerLog is a developer-productivity system that ingests private activity
(commits, Claude Code transcripts, GitHub events) and synthesizes them with
an LLM pipeline. Wiener Labs wants WienerLog to be usable by anyone, but
also wants to ensure that improvements made by hosted forks return to the
community. The mandate fixes AGPL-3.0-or-later as the default unless
explicitly contested; this ADR records why that default stands.

## Decision Drivers

- Network use is the dominant deployment mode (single tenant per workspace,
  but typically reachable over a tunnel). A weak copyleft would not bind
  service operators.
- We want the synthesis prompts and calibration improvements that downstream
  operators make to flow back into the upstream.
- We do not need patent grants from contributors strong enough to require
  Apache-2.0; the AGPL-3.0 patent retaliation clause is sufficient.
- We want compatibility with the Solana ecosystem (which is largely Apache /
  MIT). AGPL is compatible *into* WienerLog from those licenses, not the
  other way around. That is acceptable: WienerLog consumes Solana libraries,
  not vice versa.
- We do not want a Source-Available license (BSL, FSL). They fragment the
  ecosystem and exclude WienerLog from the Free Software Foundation's
  definition of free software.

## Considered Options

1. **AGPL-3.0-or-later** — strong copyleft including network use.
2. **GPL-3.0-or-later** — strong copyleft but with the well-known SaaS
   loophole.
3. **Apache-2.0** — permissive with patent grant.
4. **MIT** — minimal permissive.
5. **BSL-1.1 (Business Source License)** — Source-Available with a delayed
   conversion to a permissive license.

## Decision Outcome

**Chosen**: AGPL-3.0-or-later.

### Rationale

WienerLog's value is in observing private developer activity and producing
synthesized intelligence; the system will typically run as a service inside
an organization's perimeter. Under GPL-3.0 a hosted fork could withhold its
modifications by never distributing binaries; under AGPL-3.0 that fork must
offer its source to the users of the service. That is the exact
externality-internalization we want.

Apache and MIT would maximize adoption but provide no return obligation. For
a tool whose value compounds with each operator's prompt tuning and
calibration data, that is the wrong default. We can dual-license individual
crates later if a clear commercial demand emerges (see Validation).

BSL was rejected because the conversion date never actually arrives in
practice for projects that lose momentum, and because the OSI considers it
non-free. We prefer to live within an OSI-approved license.

The `-or-later` suffix lets users adopt any future AGPL that the Free
Software Foundation publishes. We accept the FSF's stewardship of the
license itself.

### Consequences

- **Positive**: hosted forks must publish their improvements; synthesis
  prompt evolution stays public; we remain OSI-approved.
- **Negative**: some commercial users will not adopt AGPL software at all.
  We accept this trade-off in exchange for the copyleft guarantee.
- **Risks**: a contributor may submit code under an incompatible license; we
  mitigate via the contributor agreement embedded in `CONTRIBUTING.md`
  (submission grants AGPL-3.0-or-later license).

## Validation

Revisit if:

1. A commercial user demonstrates a willingness to pay for a commercial
   license to ship WienerLog inside a proprietary product. In that case we
   can dual-license under a commercial license while keeping AGPL as the
   default.
2. The FSF publishes AGPL-4.0 with terms we cannot support. The `-or-later`
   suffix can be removed in a clarifying ADR.

## Updates

None yet.
