# 0006: Prompt versioning strategy

- **Status**: Accepted
- **Date**: 2026-05-26
- **Deciders**: @virjilakrum
- **Tags**: engine, synthesis, prompts, provenance

## Context and Problem Statement

Mandate §1 closes a calibration loop on synthesis: every ack, edit, or
reject is a label on a specific prompt's output. To learn from labels,
each task row must remember the prompt version that produced it. If we
silently mutate prompts, the loop accumulates noise that looks like
behavior change but is actually authorship drift.

## Decision Drivers

- Prompts will evolve weekly during Phase 1. Each evolution must be
  traceable.
- Calibration analytics must be able to filter labels by prompt
  version.
- Local testing must catch unintended prompt diffs before merge.
- Multiple prompts (synthesis, triage, classify, summarize) coexist
  and evolve at different cadences.
- The CLI surface should let an operator dump the rendered prompt for
  a given input so that "why did the model do X?" stays answerable.

## Considered Options

1. **Files with numeric version in filename, selected via config**.
2. **Files identified by content hash; version is the hash prefix**.
3. **Prompts inlined into Rust source with `include_str!`**.
4. **External prompt management service (PromptLayer / Helicone)**.

## Decision Outcome

**Chosen**: Option 1, file-per-version with numeric suffixes and a
config-driven selection. Snapshot tests pin the rendered output.

### Rationale

Option 2 (content hash) makes log reading harder ("which prompt is
ab12cd?"), and forces an extra lookup in the analytics layer. We
prefer monotonic ordering for quick mental indexing.

Option 3 (inlined) prevents non-Rust contributors from iterating on
prompts and forces a Rust recompile per change. Disqualifying for the
weekly-cadence requirement.

Option 4 (external service) introduces a paid SaaS dependency and a
network hop in the synthesis hot path. Rejected on principle.

### Layout

Prompts live as Tera templates under `crates/wlog-engine/prompts/`:

```
crates/wlog-engine/prompts/
├── synthesis_v1.tera          # ships with Phase 1
├── synthesis_v2.tera          # added when iteration starts
├── triage_v1.tera
├── classify_dispatch_v1.tera  # Phase 3
└── summarize_outcome_v1.tera  # Phase 3
```

Filename pattern: `<purpose>_v<N>.tera` where N is an unbroken
integer sequence per purpose.

### Selection

`wlog.toml`:

```toml
[engine.prompts]
synthesis = "synthesis_v1"
triage = "triage_v1"
classify_dispatch = "classify_dispatch_v1"
```

The engine resolves the template at startup, fails loudly if a
referenced file is missing. Hot-swap requires a daemon restart so
that running batches do not mix versions.

### Provenance on tasks

Phase 1 adds a `prompt_provenance` JSONB column on `tasks`:

```json
{
  "prompt_purpose": "synthesis",
  "prompt_version": "v3",
  "model": "claude-sonnet-4-6-20260301",
  "rendered_input_hash": "sha256:..."
}
```

Calibration analytics aggregate ack/edit/reject rates per
`(prompt_purpose, prompt_version, model)`.

### Testing

Every prompt has an insta snapshot:

```
crates/wlog-engine/tests/snapshots/synthesis_v1__rendered.snap
```

The snapshot test renders the template against a fixed `wlog-testutil`
fixture. PRs that change the template must `cargo insta accept` the
new snapshot, leaving a diff in the PR that the reviewer can read.

### Bumping a version

1. Copy `synthesis_vN.tera` to `synthesis_v{N+1}.tera`. Edit the copy.
2. Add a snapshot test for the new version (`cargo insta test`).
3. Update the config in any dev workspace and run a shadow batch:
   render both versions in parallel and diff the proposals on a
   replay tape.
4. Once shadowing looks healthy, flip the production config.
5. Old versions remain on disk so that historical task rows still
   reference a real file (provenance never dangles).

### Consequences

- **Positive**: monotonic version readability; calibration cuts cleanly
  by version; old prompts remain available for audit and replay.
- **Negative**: prompts/ grows over time. Acceptable; templates are
  small text files.
- **Risks**: an operator forgets to bump the version and the engine
  silently changes behavior. Snapshot tests catch this: rendering a
  modified template against the fixture produces a snapshot diff that
  fails CI.

## Validation

Revisit if:

1. Snapshot-only testing turns out to miss subtle behavior changes
   (e.g. logical equivalence but textual diff). Add semantic-diff
   tooling that compares prompt structure rather than bytes.
2. The number of live versions exceeds 20. Archive older snapshots
   into `prompts/archive/` and recompile the test target.

## Updates

None yet.
