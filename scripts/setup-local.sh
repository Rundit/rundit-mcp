#!/usr/bin/env bash
# Sets up a local MCP server (rundit-local) that uses the locally-built
# @rundit-sdk/client and points to a backend on localhost:3000.
#
# Usage:
#   ./scripts/setup-local.sh                          # uses default test API key
#   ./scripts/setup-local.sh --api-key=rdt_xxx        # uses custom API key
#   ./scripts/setup-local.sh --port=4000              # uses custom backend port
#   ./scripts/setup-local.sh --remove                 # removes the rundit-local MCP server
#
# Prerequisites:
#   - rundit-back must have run `npm run sdk:generate` so sdk-packages/client/ is up to date
#   - claude CLI must be installed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SDK_CLIENT_DIR="$(cd "$MCP_DIR/../rundit-back/sdk-packages/client" 2>/dev/null && pwd)" || true
MCP_NAME="rundit-local"
DEFAULT_PORT=3000
DEFAULT_API_KEY="rdt_ten_54fdc7d64db5afbbc6801463a4d9f79d35c8f49bf8132d8913e883ae7c090606"

port="$DEFAULT_PORT"
api_key="$DEFAULT_API_KEY"
remove=false

for arg in "$@"; do
  case "$arg" in
    --api-key=*) api_key="${arg#*=}" ;;
    --port=*)    port="${arg#*=}" ;;
    --remove)    remove=true ;;
    --help|-h)
      head -10 "$0" | tail -7
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if $remove; then
  echo "Removing MCP server '$MCP_NAME'..."
  claude mcp remove "$MCP_NAME" 2>/dev/null || true
  echo "Done."
  exit 0
fi

# 1. Verify SDK client exists
if [ -z "$SDK_CLIENT_DIR" ] || [ ! -f "$SDK_CLIENT_DIR/package.json" ]; then
  echo "ERROR: SDK client not found at ../rundit-back/sdk-packages/client/" >&2
  echo "Run 'npm run sdk:generate' in rundit-back first." >&2
  exit 1
fi

echo "==> Linking local SDK client from $SDK_CLIENT_DIR"
cd "$MCP_DIR"
npm install "$SDK_CLIENT_DIR" --install-links

# 2. Regenerate tools + build
echo ""
echo "==> Regenerating MCP tools from local SDK openapi.json"
npm run build

# 3. Register MCP server
echo ""
echo "==> Registering MCP server '$MCP_NAME' (localhost:$port)"

# Remove existing registration if present
claude mcp remove "$MCP_NAME" 2>/dev/null || true

claude mcp add "$MCP_NAME" \
  -e RUNDIT_API_KEY="$api_key" \
  -e RUNDIT_BASE_URL="http://localhost:${port}/api/v2/sdk" \
  -- node "$MCP_DIR/dist/main.js"

echo ""
echo "Done! MCP server '$MCP_NAME' is registered."
echo ""
echo "Tools will be available as mcp__${MCP_NAME}__* in your next Claude Code session."
echo "Make sure your local backend is running on port $port."
