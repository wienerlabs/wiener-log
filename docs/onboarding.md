# Employee onboarding

How a new Wiener Labs developer installs WienerLog on their machine.
Takes about ten minutes start to finish, no LLM cost, no Anthropic key.

## What gets installed

| Component | Location | Purpose |
| --- | --- | --- |
| `wlog` binary | `/usr/local/bin/wlog` | CLI + daemon entry point |
| Config file | `~/.config/wlog/wlog.toml` | Workspace + Postgres URL (read-only replica) |
| Daemon unit | `~/Library/LaunchAgents/io.wienerlabs.wlog-daemon.plist` (macOS) or `~/.config/systemd/user/wlog-daemon.service` (Linux) | Runs `wlog daemon run` at login |
| Git hooks | `.git/hooks/post-commit`, `post-merge`, `pre-push` | Forward commit / merge / push events to the local socket |

The daemon publishes to the shared Hetzner NATS at
`nats.wlog.wienerlabs.io:4222`. The Postgres URL points at a
read-only replica for `wlog ls`, `wlog show`, `wlog daily`, etc.

## Preconditions

- macOS 13+ or Debian 12 / Ubuntu 22.04+.
- `git` 2.40+ on `$PATH`.
- The founder has issued you a per-user workspace slug (e.g. `kh0ra`)
  and a personal Postgres role on the production database.
- The founder shared the read replica URL in 1Password as
  `wlog-replica/<your-handle>`.

## Install steps

### 1. Run the installer

From any directory:

```bash
curl -fsSL https://wlog.wienerlabs.io/install.sh \
  | WLOG_USER=kh0ra \
    WLOG_EMAIL=you@wienerlabs.io \
    WLOG_SERVER=wlog.wienerlabs.io \
    bash
```

The script does the following, idempotently:

1. Detects your OS and downloads the matching `wlog` binary from
   `https://wlog.wienerlabs.io/dl/<os>/wlog-v0.1.0`.
2. Installs to `/usr/local/bin/wlog` (sudo prompt once).
3. Writes `~/.config/wlog/wlog.toml` from the per-user template.
4. Installs the launchd / systemd-user unit for `wlog daemon run`.
5. Starts the daemon.
6. Runs `wlog status` to verify everything came up.

If you already have a checkout of `wienerlabs/wienerlog`, set
`WLOG_SOURCE_DIR=~/wienerlog` to skip the binary download and
`cargo install` from source.

### 2. Hook your repositories

For each repository where you want WienerLog to observe activity,
run from the repo root:

```bash
wlog hooks install
```

That writes `post-commit`, `post-merge`, and `pre-push` hooks that
forward events to your local daemon via Unix socket. Foreign hooks
(if any) are preserved in `.git/hooks/<name>.wlog-bak`.

To remove, run `wlog hooks uninstall` in the same directory.

### 3. Verify

```bash
wlog status
```

Expected output:

```
wlog status
===========
+ daemon socket    /Users/you/Library/Caches/wlog/wlog.sock
+ git hooks        /Users/you/code/some-repo
+ NATS             nats://nats.wlog.wienerlabs.io:4222 (round-trip 42ms)
+ Postgres         postgres://reader@wlog.wienerlabs.io/wlog

OK: wlog is healthy on this machine.
```

If anything shows `x`, follow the hint printed below it. The most
common cause is the daemon not running; see "Daemon lifecycle"
below.

### 4. First task

```bash
wlog daily
```

This will be empty on day one. As you commit, open PRs, and run
Claude Code sessions, the founder's engine will synthesize
candidate tasks; they show up in `wlog ls --status proposed`. You
ack the ones that match what you actually did:

```bash
wlog ack <task-id>
wlog ack <task-id> --edit   # opens $EDITOR to refine title/body
wlog ack <task-id> --reject --reason "wrong attribution"
```

## Daily workflow

```bash
wlog daily               # morning: see proposed tasks
wlog ack <id>            # confirm
wlog ack <id> --edit     # confirm with edits (feeds calibration)
wlog show <id>           # inspect a task with edges
wlog search "auth flow"  # semantic search across all your work
wlog stats               # personal calibration accuracy
wlog cost --days 7       # your share of LLM spend (rolling)
```

## Daemon lifecycle

The daemon is what watches the socket + NATS. It runs under your
user, not root.

### macOS

```bash
# status
launchctl print gui/$(id -u)/io.wienerlabs.wlog-daemon

# stop temporarily
launchctl bootout gui/$(id -u)/io.wienerlabs.wlog-daemon

# start
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/io.wienerlabs.wlog-daemon.plist

# logs
tail -F ~/Library/Logs/wlog-daemon.{out,err}.log
```

### Linux (systemd user unit)

```bash
systemctl --user status wlog-daemon.service
systemctl --user stop wlog-daemon.service
systemctl --user start wlog-daemon.service
journalctl --user -u wlog-daemon -f
```

### Run by hand (one-off)

```bash
wlog daemon run --nats-url nats://nats.wlog.wienerlabs.io:4222
```

Ctrl-C stops it.

## Uninstall

```bash
# stop the daemon first
launchctl bootout gui/$(id -u)/io.wienerlabs.wlog-daemon   # macOS
systemctl --user disable --now wlog-daemon.service         # Linux

# remove hooks from any repo where they were installed
cd ~/some-repo && wlog hooks uninstall

# remove binary, config, and unit
sudo rm /usr/local/bin/wlog
rm -rf ~/.config/wlog ~/.cache/wlog ~/.local/share/wlog
rm ~/Library/LaunchAgents/io.wienerlabs.wlog-daemon.plist   # macOS
rm ~/.config/systemd/user/wlog-daemon.service               # Linux
```

The shared Postgres + NATS keep your historical tasks intact; ask
the founder if you want them purged.

## Privacy

- The daemon publishes only **event metadata** (repo URL, commit
  SHA, branch, CC session id) over TLS to NATS. It never reads
  source diffs, file contents, or your terminal scrollback.
- LLM synthesis runs centrally on Hetzner against the founder's
  Anthropic + OpenAI keys; your machine never makes LLM calls.
- See `docs/architecture.md#privacy` for the full data flow.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `wlog status` shows `x daemon socket` | Restart the daemon unit (see Daemon lifecycle). |
| `x NATS` with connect error | Check VPN; the production NATS is firewall-restricted. |
| `x git hooks` after `wlog hooks install` | Re-run from the repo root; hooks live in `.git/hooks/`. |
| `wlog ack` says "task not found" | Use the full UUID or at least 8 leading hex chars. |
| Daemon CPU spikes | Restart it; if it recurs, share `journalctl --user -u wlog-daemon -n 500` with the founder. |
