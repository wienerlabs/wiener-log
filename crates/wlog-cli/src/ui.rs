//! Terminal UI helpers shared across `wlog` subcommands.
//!
//! All output respects three knobs:
//! - `NO_COLOR` env var (any value): disables ANSI escapes globally.
//! - `WLOG_COLOR=always|never`: explicit override.
//! - TTY detection: pipes and non-tty stdout fall back to plain text.
//!
//! Semantic color palette (truecolor; modern terminals only):
//! - success: `#22c55e` (green)
//! - danger:  `#ef4444` (red)
//! - warning: `#f59e0b` (amber)
//! - info:    `#06b6d4` (cyan)
//! - dim:     `#9ca3af` (gray)
//! - brand:   `#fff4dd` cream background with `#0e0e0e` foreground.

use std::io::IsTerminal;
use std::sync::atomic::{AtomicI8, Ordering};

/// Runtime color override:
/// - `0` = honor env/TTY (default)
/// - `1` = force colors on
/// - `-1` = force colors off
static COLOR_OVERRIDE: AtomicI8 = AtomicI8::new(0);
/// Runtime quiet override: 0 (default) or 1 (quiet).
static QUIET_OVERRIDE: AtomicI8 = AtomicI8::new(0);

/// Force color output on (1), off (-1), or restore env-driven default (0).
pub fn set_color_override(value: i8) {
    COLOR_OVERRIDE.store(value, Ordering::SeqCst);
}

/// Switch quiet mode on (1) or off (0).
pub fn set_quiet(value: bool) {
    QUIET_OVERRIDE.store(i8::from(value), Ordering::SeqCst);
}

/// True when informational output should be suppressed.
pub fn is_quiet() -> bool {
    QUIET_OVERRIDE.load(Ordering::SeqCst) != 0 || std::env::var_os("WLOG_QUIET").is_some()
}

const FG_SUCCESS: &str = "\x1b[38;2;34;197;94m";
const FG_DANGER: &str = "\x1b[38;2;239;68;68m";
const FG_WARN: &str = "\x1b[38;2;245;158;11m";
const FG_INFO: &str = "\x1b[38;2;6;182;212m";
const FG_DIM: &str = "\x1b[38;2;156;163;175m";
const FG_BRAND: &str = "\x1b[38;2;14;14;14m";
const BG_BRAND: &str = "\x1b[48;2;255;244;221m";
const BOLD: &str = "\x1b[1m";
const DIM_TEXT: &str = "\x1b[2m";
const RESET: &str = "\x1b[0m";

/// One semantic status used by the status / doctor / hooks views.
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
pub enum Status {
    /// Healthy / installed / online.
    Ok,
    /// Hard failure that needs operator attention.
    Fail,
    /// Soft warning; functional but degraded.
    Warn,
    /// Informational; not a pass/fail signal.
    Info,
    /// Intentionally skipped or not-applicable.
    Neutral,
}

/// True when the active stdout should carry ANSI escapes.
pub fn should_color() -> bool {
    match COLOR_OVERRIDE.load(Ordering::SeqCst) {
        1 => return true,
        -1 => return false,
        _ => {}
    }
    if std::env::var_os("NO_COLOR").is_some() {
        return false;
    }
    match std::env::var("WLOG_COLOR").as_deref() {
        Ok("never") => return false,
        Ok("always") => return true,
        _ => {}
    }
    std::io::stdout().is_terminal()
}

/// Pretty status glyph with ASCII fallback when colors are off.
pub fn symbol(status: Status) -> String {
    let colored = should_color();
    if colored {
        let (glyph, color) = match status {
            Status::Ok => ("✓", FG_SUCCESS),
            Status::Fail => ("✗", FG_DANGER),
            Status::Warn => ("⚠", FG_WARN),
            Status::Info => ("ℹ", FG_INFO),
            Status::Neutral => ("·", FG_DIM),
        };
        format!("{color}{glyph}{RESET}")
    } else {
        match status {
            Status::Ok => "[ok]".to_string(),
            Status::Fail => "[fail]".to_string(),
            Status::Warn => "[warn]".to_string(),
            Status::Info => "[info]".to_string(),
            Status::Neutral => "[--]".to_string(),
        }
    }
}

/// One labeled status line, e.g. `+  daemon socket    /run/wlog.sock`.
pub fn line(status: Status, label: &str, value: &str) {
    println!("{}  {:<18}  {}", symbol(status), label, value);
}

/// Long-form heading printed at the very top of a command output.
///
/// Rendered as a cream-on-near-black band when colored, falls back to
/// `=== text ===` on dumb terminals.
pub fn banner_heading(text: &str) {
    if should_color() {
        let padded = format!("  {text}  ");
        println!("{BG_BRAND}{FG_BRAND}{BOLD}{padded}{RESET}");
    } else {
        println!("=== {text} ===");
    }
}

/// Mid-output section heading; bolds + underlines the label.
pub fn section(text: &str) {
    println!();
    if should_color() {
        println!("{BOLD}{text}{RESET}");
        println!("{}", divider_line(text.chars().count().max(8)));
    } else {
        println!("{text}");
        println!("{}", "-".repeat(text.len().max(8)));
    }
}

/// Aligned key/value row inside a `section`.
pub fn kv(label: &str, value: impl std::fmt::Display) {
    if should_color() {
        println!("  {DIM_TEXT}{label:<14}{RESET}  {value}");
    } else {
        println!("  {label:<14}  {value}");
    }
}

/// Horizontal rule. Width is intentional and constant so multi-line
/// outputs visually align.
pub fn divider() {
    let line = divider_line(72);
    if should_color() {
        println!("{DIM_TEXT}{line}{RESET}");
    } else {
        println!("{}", "-".repeat(72));
    }
}

fn divider_line(len: usize) -> String {
    "─".repeat(len.max(8))
}

/// Pretty error printed to stderr in the `error: ...` / `hint: ...`
/// style of rustc and cargo.
pub fn error(msg: impl std::fmt::Display) {
    if should_color() {
        eprintln!("{FG_DANGER}{BOLD}error{RESET}{DIM_TEXT}:{RESET} {msg}");
    } else {
        eprintln!("error: {msg}");
    }
}

/// Indented hint paired with an `error` or `warning` above it.
pub fn hint(msg: impl std::fmt::Display) {
    if should_color() {
        eprintln!("    {FG_INFO}hint{RESET}{DIM_TEXT}:{RESET} {msg}");
    } else {
        eprintln!("    hint: {msg}");
    }
}

/// Soft warning printed to stderr.
pub fn warning(msg: impl std::fmt::Display) {
    if should_color() {
        eprintln!("{FG_WARN}{BOLD}warning{RESET}{DIM_TEXT}:{RESET} {msg}");
    } else {
        eprintln!("warning: {msg}");
    }
}

/// Inline success marker for short success messages.
pub fn success(msg: impl std::fmt::Display) {
    if should_color() {
        println!("{FG_SUCCESS}✓{RESET} {msg}");
    } else {
        println!("[ok] {msg}");
    }
}

/// Dim text (used for trailing parentheticals like UUIDs).
#[must_use]
pub fn dim(text: &str) -> String {
    if should_color() {
        format!("{DIM_TEXT}{text}{RESET}")
    } else {
        text.to_string()
    }
}

/// Bold text.
#[must_use]
pub fn bold(text: &str) -> String {
    if should_color() {
        format!("{BOLD}{text}{RESET}")
    } else {
        text.to_string()
    }
}

/// Highlight in info color.
#[must_use]
pub fn info(text: &str) -> String {
    if should_color() {
        format!("{FG_INFO}{text}{RESET}")
    } else {
        text.to_string()
    }
}

/// Highlight in success color.
#[must_use]
pub fn green(text: &str) -> String {
    if should_color() {
        format!("{FG_SUCCESS}{text}{RESET}")
    } else {
        text.to_string()
    }
}

/// Highlight in danger color.
#[must_use]
pub fn red(text: &str) -> String {
    if should_color() {
        format!("{FG_DANGER}{text}{RESET}")
    } else {
        text.to_string()
    }
}

/// Construct a styled `comfy_table::Table` ready for data rows.
///
/// Defaults:
/// - UTF-8 borders, dim corner glyphs
/// - bold header row
/// - left-aligned cells
/// - 200-col content width cap so wide URLs don't wrap unpredictably
pub fn table(headers: &[&str]) -> comfy_table::Table {
    use comfy_table::presets::UTF8_FULL_CONDENSED;
    use comfy_table::{Attribute, Cell, ContentArrangement, Table};

    let mut table = Table::new();
    table
        .load_preset(UTF8_FULL_CONDENSED)
        .set_content_arrangement(ContentArrangement::Dynamic)
        .set_width(200);

    let header_cells: Vec<Cell> = headers
        .iter()
        .map(|h| Cell::new(h).add_attribute(Attribute::Bold))
        .collect();
    table.set_header(header_cells);
    table
}

/// Print a key/value group as a bordered two-column table. Useful for
/// `wlog where` and similar summary outputs.
pub fn kv_table(rows: &[(&str, String)]) {
    use comfy_table::{Cell, ContentArrangement, Table, presets::UTF8_BORDERS_ONLY};
    let mut t = Table::new();
    t.load_preset(UTF8_BORDERS_ONLY)
        .set_content_arrangement(ContentArrangement::Dynamic);
    for (k, v) in rows {
        t.add_row(vec![Cell::new(k), Cell::new(v)]);
    }
    println!("{t}");
}

/// Redact the user-info portion of a URL (e.g. `postgres://u:pw@h`).
/// Returns `scheme://user:***@host`. Used by `wlog where` so screenshots
/// don't leak Postgres passwords. Idempotent on non-URLs.
#[must_use]
pub fn redact_url(raw: &str) -> String {
    if let Some((scheme, rest)) = raw.split_once("://")
        && let Some(at) = rest.find('@')
        && let Some((user, _pw)) = rest[..at].split_once(':')
    {
        return format!("{scheme}://{user}:***@{}", &rest[at + 1..]);
    }
    raw.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redact_url_masks_password() {
        let masked = redact_url("postgres://wlog:secret123@db.example.com:5432/wlog");
        assert_eq!(masked, "postgres://wlog:***@db.example.com:5432/wlog");
    }

    #[test]
    fn redact_url_passthrough_when_no_creds() {
        assert_eq!(
            redact_url("postgres://db.example.com/wlog"),
            "postgres://db.example.com/wlog"
        );
    }

    #[test]
    fn redact_url_passthrough_when_not_url() {
        assert_eq!(redact_url("<unset>"), "<unset>");
        assert_eq!(redact_url("just-a-string"), "just-a-string");
    }

    #[test]
    fn color_override_force_off() {
        set_color_override(-1);
        assert!(!should_color());
        set_color_override(0);
    }

    #[test]
    fn color_override_force_on() {
        set_color_override(1);
        assert!(should_color());
        set_color_override(0);
    }

    #[test]
    fn symbols_have_ascii_fallback() {
        set_color_override(-1);
        assert_eq!(symbol(Status::Ok), "[ok]");
        assert_eq!(symbol(Status::Fail), "[fail]");
        assert_eq!(symbol(Status::Warn), "[warn]");
        assert_eq!(symbol(Status::Info), "[info]");
        assert_eq!(symbol(Status::Neutral), "[--]");
        set_color_override(0);
    }

    #[test]
    fn symbols_use_unicode_when_colored() {
        set_color_override(1);
        let ok = symbol(Status::Ok);
        assert!(ok.contains('✓'), "expected check mark, got {ok:?}");
        let fail = symbol(Status::Fail);
        assert!(fail.contains('✗'), "expected ballot x, got {fail:?}");
        set_color_override(0);
    }

    #[test]
    fn dim_passthrough_when_no_color() {
        set_color_override(-1);
        assert_eq!(dim("hello"), "hello");
        set_color_override(0);
    }

    #[test]
    fn quiet_toggles_via_atomic_and_env() {
        set_quiet(true);
        assert!(is_quiet());
        set_quiet(false);
        // Env should still flip it independently.
        // (Test guard: not all environments allow safe env mutation
        // mid-test; we just verify the atomic path here.)
    }
}
