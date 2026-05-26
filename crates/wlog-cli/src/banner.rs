use std::io::{self, Write};

const LOGO_LINES: &[&str] = &[
    "                                                                  ",
    "   ██╗    ██╗██╗      ██████╗  ██████╗                            ",
    "   ██║    ██║██║     ██╔═══██╗██╔════╝          ▄▄▄▄▄▄    ▄▄▄    ",
    "   ██║ █╗ ██║██║     ██║   ██║██║  ███╗         █    █    █  █   ",
    "   ██║███╗██║██║     ██║   ██║██║   ██║         █    █    █  █   ",
    "   ╚███╔███╔╝███████╗╚██████╔╝╚██████╔╝         ▀▄▄▄▄█▄▄▄▄█▄▄█   ",
    "    ╚══╝╚══╝ ╚══════╝ ╚═════╝  ╚═════╝                            ",
    "                                                                  ",
];

const TAGLINE: &str = "  Activity-aware task synthesis. The system watches; you confirm.";
const FOOTER: &str = "  Wiener Labs  ·  AGPL-3.0  ·  https://github.com/wienerlabs/wienerlog";

const FG_BLACK: &str = "\x1b[38;5;232m";
const BG_CREAM: &str = "\x1b[48;5;230m";
const RESET: &str = "\x1b[0m";
const BOLD: &str = "\x1b[1m";
const DIM: &str = "\x1b[2m";

pub fn print_banner<W: Write>(out: &mut W, colored: bool) -> io::Result<()> {
    let version = env!("CARGO_PKG_VERSION");
    if colored {
        for line in LOGO_LINES {
            writeln!(out, "{BG_CREAM}{FG_BLACK}{BOLD}{line}{RESET}")?;
        }
        writeln!(out, "{BG_CREAM}{FG_BLACK}{TAGLINE:<70}{RESET}")?;
        let footer = format!("{FOOTER}  v{version}");
        writeln!(out, "{BG_CREAM}{FG_BLACK}{DIM}{footer:<70}{RESET}")?;
    } else {
        for line in LOGO_LINES {
            writeln!(out, "{line}")?;
        }
        writeln!(out, "{TAGLINE}")?;
        writeln!(out, "{FOOTER}  v{version}")?;
    }
    Ok(())
}

pub fn should_color() -> bool {
    if std::env::var_os("NO_COLOR").is_some() {
        return false;
    }
    if std::env::var("WLOG_COLOR").as_deref() == Ok("never") {
        return false;
    }
    if std::env::var("WLOG_COLOR").as_deref() == Ok("always") {
        return true;
    }
    is_tty()
}

fn is_tty() -> bool {
    use std::io::IsTerminal;
    std::io::stdout().is_terminal()
}
