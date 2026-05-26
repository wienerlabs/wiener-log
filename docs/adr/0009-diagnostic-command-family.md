# 0009: Diagnostic command family

- **Status**: Accepted
- **Date**: 2026-05-27
- **Deciders**: @virjilakrum
- **Tags**: cli, ux, operations

## Context and Problem Statement

WienerLog runs as a daemon on every developer machine, publishes
to shared NATS, and reads from shared Postgres. When a developer
hits a problem ("daemon isn't picking up my commits"), they need
a single command to identify which leg is broken. Founder needs a
similar lens for their own machine plus cross-workspace visibility.
Without a structured diagnostic surface, the failure mode is
"please share `journalctl --user -u wlog-daemon -n 200`," which
loses everyone half a day.

## Decision Drivers

- One-command answer to "is wlog healthy on this machine?"
- Distinct command for "what paths does wlog use?" (no probes;
  fast).
- Distinct command for "extended health check" (probes + container
  detection + version + uptime).
- Distinct command for "version / build metadata".
- Sensitive URLs (Postgres with password) MUST be redacted in any
  diagnostic output that may be screenshotted.

## Considered Options

1. **Single `wlog status` with flags** (`--paths`, `--detailed`,
   `--version`). Discoverability is poor; users grep `--help`.
2. **Multiple top-level subcommands**: `status`, `where`, `about`,
   `doctor`. More commands, cleaner mental model.
3. **`wlog diag <action>` nested family**. Three more keystrokes
   per command; no UX gain.

## Decision Outcome

**Chosen**: Option 2.

| Subcommand | Cost | Probes? | Audience |
| --- | --- | --- | --- |
| `wlog status` | <1s | yes (NATS + Postgres + socket + hooks) | employee |
| `wlog where` | instant | no (paths only) | employee |
| `wlog about` | instant | no (version + target + license) | anyone |
| `wlog doctor` | 1-3s | yes + docker scan + extended | operator |

### Rationale

- `where` is so cheap it should never trigger a network call. Users
  invoke it to share their config layout in a bug report.
- `status` is the daily self-check; it's a strict subset of
  `doctor`.
- `doctor` is the operator's deep dive; includes Docker container
  status and section dividers for readability.
- `about` exists so users have a clean way to share version info
  without dumping `--help`.

### Consequences

- **Positive**: each command has one clear job. Help text fits in
  one line each.
- **Positive**: `wlog where` produces a screenshot-safe summary
  with passwords redacted, suitable for Slack support threads.
- **Negative**: four commands instead of one. Acceptable; clap's
  help groups them visually and `wlog --help` lists all four
  with one-line descriptions.

## Exit code conventions

| Code | Meaning |
| --- | --- |
| 0 | All checks passed (or N/A for `where`/`about`). |
| 1 | One or more checks failed; hints printed to stderr. |
| 2 | Daemon not running (specific to `wlog daemon status`). |

## Redaction policy

`wlog where` calls `redact_url()` on any value containing
`scheme://user:pw@host`. Result: `scheme://user:***@host`. We
redact for the screenshot use case even though the URL might leak
elsewhere; in-band Postgres URLs in `.config/wlog/wlog.toml`
remain plaintext (user-readable file).

`wlog doctor` inherits the same redaction via `status_cmd` reuse.

## Offline mode (`wlog doctor --offline`)

When the network is uncertain (e.g. user is on a plane), the
operator can skip remote probes:

```
wlog doctor --offline
```

This is equivalent to `wlog status --no-nats --no-db` plus the
docker / version sections.

## Validation

- A new failure mode that takes more than 10 minutes to triage
  is a signal to extend `doctor` with a new section. Document the
  pattern in `docs/runbooks/incident.md`.
- If any of the four commands grow past 30 lines of output on a
  green system, split.

## Updates

_None yet._
