#!/usr/bin/env bash
# Registers the local MCP server with Claude Code, pointing at a backend
# running on localhost. Idempotent — re-running replaces an existing entry.
#
# Usage:
#   ./scripts/register-mcp.sh                            # register; prompts for API key (Enter = default)
#   ./scripts/register-mcp.sh --port=4000                # custom backend port
#   ./scripts/register-mcp.sh --api-key=rdt_xxx          # custom API key (skips the prompt)
#   ./scripts/register-mcp.sh --name=rundit-staging      # custom MCP name
#   ./scripts/register-mcp.sh --remove                   # unregister
#   ./scripts/register-mcp.sh --show                     # show current registration
#
# Prerequisites:
#   - claude CLI on PATH
#   - dist/main.js built — run ./scripts/build-local.sh first
#
# Tools are exposed as mcp__<name>__* after restarting Claude Code.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_NAME="rundit-local"
DEFAULT_PORT=3000
DEFAULT_API_KEY=""

name="$DEFAULT_NAME"
port="$DEFAULT_PORT"
api_key="$DEFAULT_API_KEY"
api_key_from_flag=false
action="register"

for arg in "$@"; do
  case "$arg" in
    --name=*)    name="${arg#*=}" ;;
    --port=*)    port="${arg#*=}" ;;
    --api-key=*) api_key="${arg#*=}"; api_key_from_flag=true ;;
    --remove)    action="remove" ;;
    --show)      action="show" ;;
    --help|-h)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

prompt_for_api_key() {
  if ! [ -t 0 ]; then
    echo "==> Using default API key (stdin is not a TTY; pass --api-key= to override)" >&2
    return
  fi
  printf "API key (Enter to use default %s...%s): " "${DEFAULT_API_KEY:0:12}" "${DEFAULT_API_KEY: -4}" >&2
  local input=""
  IFS= read -r input || true
  if [ -n "$input" ]; then
    api_key="$input"
  fi
}

command -v claude >/dev/null 2>&1 || {
  echo "ERROR: 'claude' CLI not found on PATH" >&2
  exit 1
}

case "$action" in
  remove)
    echo "Removing MCP server '$name'..."
    claude mcp remove "$name" 2>/dev/null || echo "  (not registered)"
    echo "Done."
    ;;
  show)
    claude mcp get "$name" 2>/dev/null || {
      echo "MCP server '$name' is not registered." >&2
      exit 1
    }
    ;;
  register)
    if [ ! -f "$MCP_DIR/dist/main.js" ]; then
      echo "ERROR: $MCP_DIR/dist/main.js not found." >&2
      echo "Run ./scripts/build-local.sh first." >&2
      exit 1
    fi

    if ! $api_key_from_flag; then
      prompt_for_api_key
    fi

    echo "==> Registering MCP server '$name' (localhost:$port)"
    claude mcp remove "$name" 2>/dev/null || true
    claude mcp add "$name" \
      -e RUNDIT_API_KEY="$api_key" \
      -e RUNDIT_BASE_URL="http://localhost:${port}/api/v2/sdk" \
      -- node "$MCP_DIR/dist/main.js"

    echo ""
    echo "Done. Tools will appear as mcp__${name}__* after restarting Claude Code."
    echo "Make sure your local backend is running on port $port."
    ;;
esac
