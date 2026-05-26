# macOS launchd unit

For local-only `wlog daemon` install on a developer Mac.

```bash
sudo cp infra/macos/io.wienerlabs.wlog-daemon.plist /Library/LaunchDaemons/
sudo launchctl bootstrap system /Library/LaunchDaemons/io.wienerlabs.wlog-daemon.plist
sudo launchctl enable system/io.wienerlabs.wlog-daemon

# Verify
sudo launchctl print system/io.wienerlabs.wlog-daemon
tail -F ~/Library/Logs/wlog-daemon.{out,err}.log

# Unload
sudo launchctl bootout system/io.wienerlabs.wlog-daemon
```

Adjust the `wlog` binary path and log paths inside the plist if your
install lives elsewhere (e.g. `~/.cargo/bin/wlog`).
