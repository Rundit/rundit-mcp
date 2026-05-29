#!/usr/bin/env bash
# Installs the locally-built @rundit-sdk/client (as a symlink, so subsequent
# sdk:generate runs in rundit-back propagate without re-installing),
# regenerates the MCP tool manifest from its openapi.json, and compiles the
# MCP server.
#
# Usage:
#   ./scripts/build-local.sh                       # install local SDK + build
#   ./scripts/build-local.sh --regen-sdk           # also runs sdk:generate in rundit-back first
#   ./scripts/build-local.sh --skip-install        # only regen tools + tsc (no npm install)
#   ./scripts/build-local.sh --sdk-path=<path>     # override SDK client location
#   ./scripts/build-local.sh --back-dir=<path>     # override rundit-back location (used with --regen-sdk)
#   ./scripts/build-local.sh --remove              # uninstall the locally-linked SDK
#
# After this finishes successfully, register the MCP server with:
#   ./scripts/register-mcp.sh
#
# Prerequisites:
#   - rundit-back has run `npm run sdk:generate` (or pass --regen-sdk)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_BACK_DIR="$MCP_DIR/../rundit-back"

regen_sdk=false
skip_install=false
remove=false
sdk_path=""
back_dir=""

for arg in "$@"; do
  case "$arg" in
    --regen-sdk)        regen_sdk=true ;;
    --skip-install)     skip_install=true ;;
    --remove)           remove=true ;;
    --sdk-path=*)       sdk_path="${arg#*=}" ;;
    --back-dir=*)       back_dir="${arg#*=}" ;;
    --help|-h)
      sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

resolved_back_dir=""
if [ -n "$back_dir" ]; then
  resolved_back_dir="$(cd "$back_dir" 2>/dev/null && pwd)" || {
    echo "ERROR: --back-dir does not exist: $back_dir" >&2
    exit 1
  }
elif [ -d "$DEFAULT_BACK_DIR" ]; then
  resolved_back_dir="$(cd "$DEFAULT_BACK_DIR" && pwd)"
fi

resolve_sdk_path() {
  if [ -n "$sdk_path" ]; then
    cd "$sdk_path" 2>/dev/null && pwd
    return
  fi
  [ -n "$resolved_back_dir" ] || return 1
  cd "$resolved_back_dir/sdk-packages/client" 2>/dev/null && pwd
}

cd "$MCP_DIR"

if $remove; then
  echo "==> Removing locally-linked @rundit-sdk/client"
  npm uninstall @rundit-sdk/client
  echo "Done. Reinstall a published version with 'npm install' if needed."
  exit 0
fi

if $regen_sdk; then
  [ -n "$resolved_back_dir" ] || {
    echo "ERROR: cannot run --regen-sdk: rundit-back not found at $DEFAULT_BACK_DIR (use --back-dir)" >&2
    exit 1
  }
  echo "==> Regenerating SDK in $resolved_back_dir"
  ( cd "$resolved_back_dir" && npm run sdk:generate )
fi

if ! $skip_install; then
  SDK_CLIENT_DIR="$(resolve_sdk_path || true)"
  if [ -z "$SDK_CLIENT_DIR" ] || [ ! -f "$SDK_CLIENT_DIR/package.json" ]; then
    echo "ERROR: SDK client not found." >&2
    echo "  Looked for: ${sdk_path:-${resolved_back_dir:-$DEFAULT_BACK_DIR}/sdk-packages/client}" >&2
    echo "  Run with --regen-sdk to build it, or pass --sdk-path=<path>." >&2
    exit 1
  fi

  # Drop any prior install so npm re-resolves cleanly. We intentionally do *not*
  # pass --install-links — symlinking lets subsequent `sdk:generate` runs in
  # rundit-back show up in node_modules immediately (the codegen reads
  # node_modules/@rundit-sdk/client/openapi.json), so the user does not need to
  # reinstall after every SDK regen.
  echo "==> Installing local SDK client from $SDK_CLIENT_DIR"
  rm -rf "$MCP_DIR/node_modules/@rundit-sdk/client"
  npm install "$SDK_CLIENT_DIR"

  if [ ! -L "$MCP_DIR/node_modules/@rundit-sdk/client" ]; then
    echo "WARN: node_modules/@rundit-sdk/client is not a symlink." >&2
    echo "      Future SDK regens in rundit-back will not propagate until you re-run this script." >&2
  fi
fi

echo "==> Regenerating tools.ts and compiling MCP server"
npm run build

echo ""
echo "Build complete. Register with: ./scripts/register-mcp.sh"
