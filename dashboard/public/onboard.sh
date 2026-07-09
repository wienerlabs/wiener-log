#!/usr/bin/env bash
set -uo pipefail

: "${WLOG_HANDLE:?Set WLOG_HANDLE=your-github-handle}"
: "${WLOG_BASE:?Set WLOG_BASE=https://wienerlog-dashboard.vercel.app}"
: "${WLOG_INGEST_TOKEN:?Set WLOG_INGEST_TOKEN}"
WLOG_MCP_TOKEN="${WLOG_MCP_TOKEN:-}"

DIR="$HOME/.wlog"
mkdir -p "$DIR/githooks"

cat > "$DIR/config" <<EOF
WLOG_HANDLE="$WLOG_HANDLE"
WLOG_BASE="$WLOG_BASE"
WLOG_INGEST_TOKEN="$WLOG_INGEST_TOKEN"
EOF
chmod 600 "$DIR/config"

cat > "$DIR/report.sh" <<'RPT'
#!/usr/bin/env bash
. "$HOME/.wlog/config"
curl -fsS -m 5 -X POST "$WLOG_BASE/api/ingest" \
  -H "authorization: Bearer $WLOG_INGEST_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"handle\":\"$WLOG_HANDLE\",\"source\":\"$1\",\"kind\":\"$2\",$3}" >/dev/null 2>&1 || true
RPT
chmod +x "$DIR/report.sh"

cat > "$DIR/githooks/post-commit" <<'GIT'
#!/usr/bin/env bash
REPO=$(git config --get remote.origin.url 2>/dev/null | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
SHA=$(git rev-parse --short HEAD 2>/dev/null)
MSG=$(git log -1 --pretty=%s 2>/dev/null | sed 's/"/'"'"'/g')
"$HOME/.wlog/report.sh" git commit "\"repository\":\"$REPO\",\"branch\":\"$BRANCH\",\"sha\":\"$SHA\",\"message\":\"$MSG\""
GIT
chmod +x "$DIR/githooks/post-commit"
git config --global core.hooksPath "$DIR/githooks"
echo "Git commit reporting installed."

cat > "$DIR/cc-hook.sh" <<'CC'
#!/usr/bin/env bash
IN=$(cat 2>/dev/null || true)
CWD=$(printf '%s' "$IN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null || true)
REPO=""
if [ -n "$CWD" ] && [ -d "$CWD/.git" ]; then
  REPO=$(git -C "$CWD" config --get remote.origin.url 2>/dev/null | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
fi
"$HOME/.wlog/report.sh" claude_code session_start "\"cwd\":\"$CWD\",\"repository\":\"$REPO\""
CC
chmod +x "$DIR/cc-hook.sh"

python3 - "$DIR" <<'PY'
import json, os, sys
d = sys.argv[1]
p = os.path.expanduser("~/.claude/settings.json")
cfg = json.load(open(p)) if os.path.exists(p) else {}
arr = cfg.setdefault("hooks", {}).setdefault("SessionStart", [])
cmd = d + "/cc-hook.sh"
present = any(x.get("command") == cmd for h in arr for x in h.get("hooks", []))
if not present:
    arr.append({"hooks": [{"type": "command", "command": cmd}]})
os.makedirs(os.path.dirname(p), exist_ok=True)
json.dump(cfg, open(p, "w"), indent=2)
print("Claude Code activity hook installed.")
PY

if [ -n "$WLOG_MCP_TOKEN" ]; then
  M="$DIR/mcp"
  mkdir -p "$M"
  curl -fsSL "$WLOG_BASE/wlog-mcp.mjs" -o "$M/index.mjs"
  curl -fsSL "$WLOG_BASE/wlog-mcp-package.json" -o "$M/package.json"
  if ( cd "$M" && npm install --silent >/dev/null 2>&1 ); then
    echo "WienerLog MCP installed."
  else
    echo "MCP install skipped (need node + npm on PATH)."
  fi
  python3 - "$M" "$WLOG_BASE" "$WLOG_MCP_TOKEN" <<'PY'
import json, os, sys
m, base, tok = sys.argv[1], sys.argv[2], sys.argv[3]
server = {
    "command": "node",
    "args": [m + "/index.mjs"],
    "env": {"WLOG_MCP_URL": base + "/api/mcp", "WLOG_MCP_TOKEN": tok},
}
dp = os.path.expanduser("~/Library/Application Support/Claude/claude_desktop_config.json")
if os.path.isdir(os.path.dirname(dp)):
    d = json.load(open(dp)) if os.path.exists(dp) else {}
    d.setdefault("mcpServers", {})["wienerlog"] = server
    json.dump(d, open(dp, "w"), indent=2)
    print("Claude Desktop MCP configured.")
cp = os.path.expanduser("~/.claude.json")
c = json.load(open(cp)) if os.path.exists(cp) else {}
c.setdefault("mcpServers", {})["wienerlog"] = server
json.dump(c, open(cp, "w"), indent=2)
print("Claude Code MCP configured.")
PY
fi

echo ""
echo "Setup complete for @$WLOG_HANDLE."
echo "Restart Claude Desktop to load the MCP."
echo "Your commits and Claude Code sessions now flow into WienerLog."
