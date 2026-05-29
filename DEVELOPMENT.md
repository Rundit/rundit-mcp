# Development

## Architecture

`rundit-mcp` is a NestJS process that registers every `@rundit-sdk/client` method as an MCP tool over stdio. The tool list is **generated from the SDK's `openapi.json`** — at container start in production, and via `npm run build` locally.

```
@rundit-sdk/client (openapi.json)
        |
        v  npm run codegen
src/generated/tools.ts
        |
        v  npm run build
dist/main.js  ──stdin/stdout──>  MCP client (Claude Code)
```

**In Docker**, the entrypoint runs `npm install @rundit-sdk/client@$RUNDIT_SDK_DIST_TAG` (defaults to `latest`), then `npm run build` (codegen + `tsc`), then `node dist/main.js`. This means each MCP session boot pulls the freshest SDK from npm without an image rebuild. Stale SDK ↔ src drift now surfaces at startup as a `tsc` error instead of silently in a stale image. See [`scripts/docker-entrypoint.sh`](scripts/docker-entrypoint.sh).

**Locally**, `build-local.sh` symlinks the SDK from `../rundit-back/sdk-packages/client`, regenerates `tools.ts`, and compiles — see the iteration workflow below.

Key files:

| File | Purpose |
|------|---------|
| `src/generated/tools.ts` | **Generated** — one `ToolSpec` per SDK operation |
| `scripts/generate-tools.mjs` | Reads `openapi.json`, writes `tools.ts` |
| `src/rundit/rundit.service.ts` | Creates the SDK client from env vars |
| `src/rundit/rundit-tools.service.ts` | Registers tools with the MCP server |
| `src/rundit/json-schema-to-zod.ts` | Converts JSON Schema inputs to Zod at runtime |

## Local Development

There are two workflows. Use **Initial bootstrap** once per checkout; **Iteration** is what you'll run on every backend change after that.

| npm script | What it does |
|------------|--------------|
| `npm run build:local` | Symlinks the local SDK into `node_modules`, regenerates `tools.ts`, runs `tsc` |
| `npm run register:local` | Registers `rundit-local` with Claude Code (idempotent; prompts for API key) |
| `npm run register:local:show` | Shows the current registration |
| `npm run register:local:remove` | Unregisters |

Each wraps the matching shell script in `scripts/`. Pass underlying-script flags after `--` (e.g. `npm run build:local -- --regen-sdk`).

### Initial bootstrap (run once per checkout)

Prerequisites: `rundit-back` checked out as a sibling at `../rundit-back`; the `claude` CLI on `PATH`; your local backend reachable on port 3000 (or pass `--port=<n>` in step 3).

```bash
# 1. Install MCP deps.
npm install

# 2. Build the SDK in rundit-back, symlink it into rundit-mcp/node_modules,
#    regen tools.ts, compile dist/main.js — all in one call.
npm run build:local -- --regen-sdk

# 3. Register the MCP server with Claude Code. Prompts for API key; press
#    Enter to accept the redacted default test key shown in the prompt.
npm run register:local

# 4. Restart Claude Code. Tools appear as mcp__rundit-local__*.
```

After step 2, `node_modules/@rundit-sdk/client` is a **symlink** to `rundit-back/sdk-packages/client`. That's load-bearing — it's what lets the iteration workflow below skip reinstall. Verify with `ls -la node_modules/@rundit-sdk/client`: the entry should start with `l` (symlink), not `d` (copy). If it's a copy, rerun `npm run build:local` to repair.

### Iteration workflow (every API change after bootstrap)

```bash
# 1. Regen the SDK + tools.ts + dist in one call.
npm run build:local -- --regen-sdk

# 2. Restart Claude Code so it re-spawns the MCP subprocess with the new dist/main.js.
```

That's it. The symlink means `sdk:generate` writes straight through to `node_modules/@rundit-sdk/client/openapi.json`, the codegen reads it, `tsc` compiles, the restarted MCP loads the new `dist/main.js`. Your backend must be up on the configured port at tool-call time.

Splitting the steps (e.g. if you're already in `rundit-back`):

```bash
# In rundit-back:
npm run sdk:generate

# In rundit-mcp:
npm run build:local -- --skip-install     # regen tools + tsc only — symlink keeps openapi.json fresh
# restart Claude Code
```

### Less common cases

- **I only changed MCP code (not the SDK):** `npm run build:local -- --skip-install` → restart Claude Code.
- **I want to change the registration (port, API key, name):** `npm run register:local -- --port=4000` (or `--api-key=…`, `--name=…`) → restart Claude Code. No rebuild needed.
- **I want to point at a different SDK location:** `npm run build:local -- --sdk-path=<path>`.
- **I want to unlink the local SDK:** `npm run build:local -- --remove`.

### Troubleshooting

- **A tool that should exist is missing from `tools.ts`.** The SDK in `node_modules` is stale. Confirm `node_modules/@rundit-sdk/client` is a symlink (`ls -la`); if it's a copy, run `npm run build:local` to repair. Then rerun the iteration workflow.
- **`dist/main.js not found` when registering.** Run `npm run build:local` first.
- **Claude Code can't reach the MCP server.** Run `npm run register:local:show`; verify `RUNDIT_BASE_URL` and that your backend is up on that port.
- **Tool calls return 401/403.** The registered API key doesn't match an active key for the backend. Re-register with `npm run register:local -- --api-key=<correct_key>`.

## Production (Docker)

### Build and register

```bash
docker build -t rundit-mcp .

# Prod (latest published SDK, prod API):
claude mcp add rundit \
  -- docker run -i --rm \
       -e RUNDIT_API_KEY=rdt_ten_your_key \
       rundit-mcp

# Test stream (rc SDK, test API):
claude mcp add rundit-test \
  -- docker run -i --rm \
       -e RUNDIT_API_KEY=rdt_ten_your_test_key \
       -e RUNDIT_BASE_URL=https://test.rundit.com/api/v2/sdk \
       -e RUNDIT_SDK_DIST_TAG=rc \
       rundit-mcp
```

The image bakes only `rundit-mcp` source and its own deps. The SDK is installed
fresh on every container start via [`scripts/docker-entrypoint.sh`](scripts/docker-entrypoint.sh),
which runs:

```sh
npm install --no-save --include=dev @rundit-sdk/client@$RUNDIT_SDK_DIST_TAG
npm run build      # codegen + tsc
exec node dist/main.js
```

Two consequences:
- New SDK releases are picked up on the next session restart — no rebuild, no
  re-registration.
- The container needs outbound access to the npm registry at start. Sessions
  in offline/restricted environments need a different strategy (pin the SDK in
  the image, or pre-populate an npm cache).

### Run without Docker

```bash
npm install && npm run build

RUNDIT_API_KEY=rdt_ten_your_key \
RUNDIT_BASE_URL=https://test.rundit.com/api/v2/sdk \
npm start
```

## Codegen

| Command | Effect |
|---------|--------|
| `npm run codegen` | Regenerates `tools.ts` from installed SDK |
| `npm run codegen:check` | Exits non-zero if `tools.ts` is stale |
| `npm run build` | Runs codegen + `tsc` |

The generated file is committed so SDK upgrades show as a reviewable diff.

## CI

After `npm ci`, verify tools are in sync:

```bash
npm run codegen:check
```

## Smoke test

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| docker run -i --rm -e RUNDIT_API_KEY=rdt_ten_dummy rundit-mcp
```

Stderr prints `[rundit-mcp] registering N tools from @rundit-sdk/client vX.Y.Z`.
