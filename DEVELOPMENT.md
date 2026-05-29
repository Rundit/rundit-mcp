# Development

## Architecture

`rundit-mcp` is a NestJS process that registers every `@rundit-sdk/client` method as an MCP tool over stdio. The tool list is **generated from the SDK's `openapi.json` at build time**.

```
@rundit-sdk/client (openapi.json)
        |
        v  npm run codegen
src/generated/tools.ts
        |
        v  npm run build
dist/main.js  ──stdin/stdout──>  MCP client (Claude Code)
```

Key files:

| File | Purpose |
|------|---------|
| `src/generated/tools.ts` | **Generated** — one `ToolSpec` per SDK operation |
| `scripts/generate-tools.mjs` | Reads `openapi.json`, writes `tools.ts` |
| `src/rundit/rundit.service.ts` | Creates the SDK client from env vars |
| `src/rundit/rundit-tools.service.ts` | Registers tools with the MCP server |
| `src/rundit/json-schema-to-zod.ts` | Converts JSON Schema inputs to Zod at runtime |

## Local Development

### 1. Build the SDK client from your local backend

```bash
cd ../rundit-back
npm run sdk:generate
```

### 2. Register the local MCP server

```bash
./scripts/setup-local.sh
```

This links the local SDK, regenerates tools, builds, and registers `rundit-local` pointing to `localhost:3000`.

```bash
./scripts/setup-local.sh --port=4000          # custom backend port
./scripts/setup-local.sh --api-key=rdt_xxx    # custom API key
./scripts/setup-local.sh --remove             # unregister
```

### 3. Restart Claude Code

Tools appear as `mcp__rundit-local__*`.

### Iteration loop

```
Edit controllers/DTOs  →  npm run sdk:generate (rundit-back)
                       →  ./scripts/setup-local.sh (rundit-mcp)
                       →  Restart Claude Code
```

## Production (Docker)

### Build and register

```bash
docker build -t rundit-mcp .

claude mcp add rundit \
  -- docker run -i --rm \
       -e RUNDIT_API_KEY=rdt_ten_your_key \
       -e RUNDIT_BASE_URL=https://test.rundit.com/api/v2/sdk \
       rundit-mcp
```

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
