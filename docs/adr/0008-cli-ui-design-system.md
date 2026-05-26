# 0008: CLI UI design system

- **Status**: Accepted
- **Date**: 2026-05-27
- **Deciders**: @virjilakrum
- **Tags**: cli, ux, tooling

## Context and Problem Statement

`wlog` started as a thin clap CLI with printf-aligned tables and
ad-hoc error messages. As the subcommand surface grew past fifteen
(adding `status`, `where`, `about`, `doctor`, `admin tail/users/
workspaces`, `log`, `tree`, `setup`, `banner`, ...), the visual
language drifted: some output used `+`/`x` markers, others printed
plain text, error formatting varied per call site. We needed a single
UI source of truth so every new subcommand inherits the same colors,
table style, and error format.

## Decision Drivers

- Operator velocity: errors should look like rustc / cargo so the
  user immediately recognizes "this is the actionable bit."
- Brand: the cream-on-near-black banner exists; the CLI palette
  should reinforce it without overwhelming.
- Cross-environment: must degrade gracefully on dumb terminals, in
  CI logs, and behind `NO_COLOR`.
- Test surface: helpers must be deterministic so we can snapshot
  representative output.

## Considered Options

1. **`owo-colors` + ad-hoc tables.** Quick to adopt, but each
   subcommand still rolls its own table writer.
2. **`anstyle` + `comfy-table`.** anstyle is the cargo-team-standard
   ANSI primitive; comfy-table handles auto-width, borders, and
   header bolding.
3. **`indicatif` + `console`.** Heavyweight; pulls in tty machinery
   we don't need for non-interactive subcommands.
4. **Hand-rolled module.** Full control, zero new dependencies for
   colors (we already had truecolor escapes in `banner.rs`).

## Decision Outcome

**Chosen**: Option 4 for colors/symbols/headers (zero dependency
beyond truecolor escapes), Option 2's `comfy-table` for boxed
tables.

### Rationale

- The color palette is small (six semantic colors); a one-file
  module is easier to audit than threading anstyle through every
  call.
- `comfy-table` is well-maintained, ships UTF-8 border presets, and
  handles dynamic width without bringing crossterm-style raw mode.
- Hand-rolled module makes `WLOG_COLOR=always|never` + `NO_COLOR`
  + `AtomicI8` runtime override trivial.

### Consequences

- **Positive**: every new subcommand calls `ui::line()`,
  `ui::banner_heading()`, `ui::section()`, `ui::kv()`,
  `ui::table()`. Visual consistency is automatic.
- **Positive**: errors flow through `ui::error()` + `ui::hint()`,
  matching rustc style verbatim.
- **Negative**: truecolor escapes won't render on terminals stuck
  in 8-color mode (e.g. some Windows cmd.exe variants). Acceptable;
  primary target is macOS / Linux modern terminals.

## Visual contract

| Concept | Truecolor | ASCII fallback |
| --- | --- | --- |
| Success | `#22c55e` + `✓` | `[ok]` |
| Failure | `#ef4444` + `✗` | `[fail]` |
| Warning | `#f59e0b` + `⚠` | `[warn]` |
| Info    | `#06b6d4` + `ℹ` | `[info]` |
| Neutral | `#9ca3af` + `·` | `[--]` |
| Brand   | `#fff4dd` bg / `#0e0e0e` fg | `=== text ===` |

| Helper | Use for |
| --- | --- |
| `ui::banner_heading()` | First line of any subcommand output. |
| `ui::section()` | Mid-output subheading; underlines the label. |
| `ui::kv(label, value)` | Aligned key/value rows inside a section. |
| `ui::line(status, label, value)` | Status row in `wlog status` / `doctor`. |
| `ui::divider()` | Horizontal rule between sub-blocks. |
| `ui::table(headers)` | Boxed comfy-table for data rows. |
| `ui::kv_table(rows)` | Borderless two-column summary. |
| `ui::error()` + `ui::hint()` | Failure path mirroring rustc. |
| `ui::warning()` | Soft warning (process continues). |
| `ui::success()` | Short success message. |

## Behavioral contract

- `should_color()` order: runtime override > `NO_COLOR` env >
  `WLOG_COLOR=always|never` > TTY detection on stdout.
- Quiet mode (`--quiet` / `WLOG_QUIET=1`) suppresses informational
  output; errors still print to stderr.
- All color helpers must accept `impl Display` so JSON IDs and
  paths can be passed without `.to_string()`.

## Validation

- New subcommands MUST go through `ui::*` for any user-facing
  output. Code review rejects raw `println!("error: ...")` or
  table-by-printf.
- Em dash sweep (project-wide rule from feedback_no_em_dash.md)
  applies to all ui::* output strings too.
- If we add a TUI mode in the future (e.g. `wlog tui`), it
  reuses this module's color constants for consistency.

## Updates

_None yet._
