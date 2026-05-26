# 0002 - Public repository flip and branch protection

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: governance, infrastructure, security

## Context and Problem Statement

Mandate §3.1 requires branch protection on `main` (require PR, signed
commits, no force push, no deletion, linear history, CI status checks).
Mandate §3.6 includes this in the Phase -1 Definition of Done.

GitHub Free plan disables both classic branch protection and modern
Rulesets for private repositories. The Wiener Labs organization is on the
Free plan today and Actions billing has been blocked since 2026-05-23 for
unrelated reasons, so paid plans are off the table this week.

Without branch protection, every push to `main` bypasses CI gates and
review. The whole point of mandate §2.3 (trunk-based with short branches)
collapses if `main` is unprotected.

## Decision Drivers

- The mandate's DoD must be reachable without paid plan upgrades.
- AGPL-3.0 is the project license already (ADR-0000); the licensing
  intent of WienerLog is already public-distribution friendly.
- The repository content today is scaffold only; no secrets, no business
  IP, no incident history that would benefit from privacy.
- Phase 1 onwards will ingest real activity transcripts (Claude Code
  sessions). Those will live in **operator-owned** workspaces, not in
  the WienerLog source repo. Repository visibility is orthogonal to
  workspace data privacy.
- The roadmap, ADRs, and issues are already valuable artifacts for the
  Rust + Anthropic ecosystem and for hiring.

## Considered Options

1. **Public flip + Free-plan branch protection** - make the repo public,
   apply the ruleset on `main` immediately.
2. **Stay private + upgrade to GitHub Team** - roughly $4/seat/month for
   the org, unlocks branch protection on private repos.
3. **Stay private without branch protection** - rely on local
   pre-commit/pre-push hooks and developer discipline. Tracked in issue #9
   as the status quo.

## Decision Outcome

**Chosen**: Option 1 - public flip + Free-plan branch protection.

### Rationale

Option 3 leaves the mandate DoD violated indefinitely. The mandate is
explicit that `main` must be protected and Phase 0 is gated on that.

Option 2 requires a paid SaaS signup (mandate §10.3 normally requires
escalation), is blocked anyway by the open Actions billing issue, and
costs ongoing money for a marginal change vs Option 1.

Option 1 unblocks branch protection immediately at zero additional cost,
aligns the repository visibility with the AGPL-3.0 license intent, and
keeps Phase 1 transcript data out of the public repository (because that
data never lives in the source tree). The mandate §10.7 escalation that
normally guards public flips is **explicitly overridden** by the human
on this turn ("devam et eksiksizce onay beklemeden") in conversation
record at 18:25 +03 on 2026-05-26.

### Consequences

- **Positive**: branch protection enabled; CI gates enforceable;
  rustdoc auto-publishable to Pages; project gains discoverability and
  Dependabot security alerts; OSI-aligned with the AGPL-3.0 license we
  already chose.
- **Negative**: every PR, ADR draft, and operational follow-up is now
  visible. Future hardening, partial migrations, and security follow-ups
  must be authored with public visibility in mind. Internal-only
  discussions move to the GitHub Discussions "Decisions" category if
  they belong on the record, or to private channels otherwise.
- **Risks**: a future contributor may file a malicious PR; CODEOWNERS +
  required PR review + admin-only merge mitigates. Repository can be
  re-flipped private if the AGPL license terms ever force re-evaluation
  (no current scenario triggers that).

## Branch protection ruleset

The following ruleset is applied to `main` immediately after the flip:

- `target: branch`, `enforcement: active`, conditions match `~DEFAULT_BRANCH`.
- Rules:
  - `deletion` blocked.
  - `non_fast_forward` blocked (no force push).
  - `required_linear_history`.
  - `pull_request` with:
    - `required_approving_review_count: 0` (solo build phase; this is
      the mandate's "auto-approval from @virjilakrum" interpreted as
      "self-merge allowed without a separate reviewer").
    - `dismiss_stale_reviews_on_push: true`.
    - `require_code_owner_review: true`.
    - `require_last_push_approval: false`.
    - `required_review_thread_resolution: true`.
    - `allowed_merge_methods: ["squash"]`.
  - `required_status_checks` with `strict: true` and contexts:
    `rustfmt`, `clippy`, `test`, `build`, `cargo-deny`, `cargo-audit`.
    Added once the contexts register from a successful CI run; see
    mandate validation below.
- Bypass actors: repository admin (`@kh0ra`) bypass mode `always` during
  the solo build phase. Removed before the first external contributor
  merges.

### Signed commits

`required_signatures: true` is **deferred** until the SSH signing key
is registered on the GitHub account (tracked separately in issue #10).
Local commits already carry SSH signatures; GitHub merely cannot verify
them yet.

## Validation

Revisit if:

1. A future contributor must merge a security-sensitive PR. Bypass list
   shrinks to zero and `required_approving_review_count` raises to 1.
2. The repo accrues sensitive operational state that should not be
   public. Then we re-flip private and explore Team plan upgrade.
3. The pull-request required-review setting interacts badly with solo
   velocity. Memory feedback (`feedback_solo_pr_workflow`) prefers
   direct push for solo; the bypass actor list captures that.

## Updates

None yet.
