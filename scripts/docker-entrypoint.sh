#!/bin/sh
# Installs @rundit-sdk/client at the configured dist-tag, regenerates the MCP
# tool manifest from its openapi.json, compiles, and execs the server.
#
# Env:
#   RUNDIT_SDK_DIST_TAG  npm dist-tag to install (default: latest).
#                        Use `rc` for the test/staging stream.

set -e

DIST_TAG="${RUNDIT_SDK_DIST_TAG:-latest}"

echo "==> Installing @rundit-sdk/client@${DIST_TAG}" >&2
# --include=dev so npm doesn't prune typescript (NODE_ENV=production at runtime).
npm install --no-save --include=dev --no-audit --no-fund --loglevel=error \
  "@rundit-sdk/client@${DIST_TAG}"

echo "==> Regenerating tools and compiling" >&2
npm run build --silent

exec node dist/main.js "$@"
