#!/usr/bin/env bash
# Local iteration loop for API changes across the three repos:
#
#   rundit-back  (npm run sdk:openapi)  ->  sdk-packages/openapi/sdk.openapi.json
#   rundit-sdk   (spec/ + npm run sdk:generate)  ->  packages/client
#   rundit-mcp   (npm link @rundit-sdk/client + codegen + tsc)  ->  dist/main.js
#
# Usage:
#   ./scripts/build-local.sh                       # link ../rundit-sdk/packages/client, regen tools.ts, tsc
#   ./scripts/build-local.sh --regen-sdk           # first regenerate the spec in rundit-back and the client in rundit-sdk
#   ./scripts/build-local.sh --skip-link           # only regen tools.ts + tsc (link already in place)
#   ./scripts/build-local.sh --sdk-dir=<path>      # override rundit-sdk checkout (default ../rundit-sdk)
#   ./scripts/build-local.sh --back-dir=<path>     # override rundit-back checkout (default ../rundit-back)
#   ./scripts/build-local.sh --remove              # drop the link and reinstall the pinned published SDK
#
# After this finishes successfully, run the server with `npm start` (http on :3002)
# or register the stdio build with ./scripts/register-mcp.sh.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_BACK_DIR="$MCP_DIR/../rundit-back"
DEFAULT_SDK_DIR="$MCP_DIR/../rundit-sdk"

regen_sdk=false
skip_link=false
remove=false
sdk_dir=""
back_dir=""

for arg in "$@"; do
  case "$arg" in
    --regen-sdk)        regen_sdk=true ;;
    --skip-link)        skip_link=true ;;
    --remove)           remove=true ;;
    --sdk-dir=*)        sdk_dir="${arg#*=}" ;;
    --back-dir=*)       back_dir="${arg#*=}" ;;
    --help|-h)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

resolve_dir() {
  local override="$1" fallback="$2" label="$3"
  local candidate="${override:-$fallback}"
  cd "$candidate" 2>/dev/null && pwd || {
    echo "ERROR: $label not found at $candidate" >&2
    exit 1
  }
}

cd "$MCP_DIR"

if $remove; then
  echo "==> Unlinking @rundit-sdk/client and reinstalling the pinned version"
  npm unlink --no-save @rundit-sdk/client >/dev/null 2>&1 || true
  npm install
  exit 0
fi

resolved_sdk_dir="$(resolve_dir "$sdk_dir" "$DEFAULT_SDK_DIR" "rundit-sdk")"
SDK_CLIENT_DIR="$resolved_sdk_dir/packages/client"

if $regen_sdk; then
  resolved_back_dir="$(resolve_dir "$back_dir" "$DEFAULT_BACK_DIR" "rundit-back")"
  echo "==> Emitting the OpenAPI spec in $resolved_back_dir"
  ( cd "$resolved_back_dir" && npm run sdk:openapi )
  echo "==> Syncing the spec into $resolved_sdk_dir/spec and regenerating the client"
  cp "$resolved_back_dir/sdk-packages/openapi/sdk.openapi.json" "$resolved_sdk_dir/spec/sdk.openapi.json"
  ( cd "$resolved_sdk_dir" && npm run sdk:generate )
fi

if ! $skip_link; then
  [ -f "$SDK_CLIENT_DIR/package.json" ] || {
    echo "ERROR: generated client not found at $SDK_CLIENT_DIR" >&2
    echo "  Run with --regen-sdk, or 'npm run sdk:generate' in $resolved_sdk_dir." >&2
    exit 1
  }
  # A symlink, so later `sdk:generate` runs in rundit-sdk are visible here without
  # reinstalling — the codegen reads node_modules/@rundit-sdk/client/openapi.json.
  echo "==> Linking $SDK_CLIENT_DIR into node_modules"
  ( cd "$SDK_CLIENT_DIR" && npm link >/dev/null )
  npm link --no-save @rundit-sdk/client >/dev/null
  [ -L "$MCP_DIR/node_modules/@rundit-sdk/client" ] || {
    echo "WARN: node_modules/@rundit-sdk/client is not a symlink; later SDK regens will not propagate." >&2
  }
fi

echo "==> Regenerating tools.ts and compiling the MCP server"
npm run build

echo ""
echo "Build complete. Run with 'npm start' (http, :3002) or register stdio via ./scripts/register-mcp.sh"
