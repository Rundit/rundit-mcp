# Development

## Architecture

`rundit-mcp` is a NestJS process that registers every `@rundit-sdk/client` method as an MCP tool. It speaks two transports, selected by `MCP_TRANSPORT`: **stdio** (default — one process per user, key from `RUNDIT_API_KEY`) and **http** (stateless Streamable HTTP for the hosted deployment — a fresh MCP server per `POST /mcp`, bound to the API key from that request's headers; see `src/http-server.ts`). The tool list is **generated from the SDK's `openapi.json`** — at container start in production, and via `npm run build` locally.

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

**Locally**, `build-local.sh` links the client generated in the sibling `rundit-sdk` checkout, regenerates `tools.ts`, and compiles — see the iteration workflow below.

Key files:

| File | Purpose |
|------|---------|
| `src/generated/tools.ts` | **Generated** — one `ToolSpec` per SDK operation |
| `scripts/generate-tools.mjs` | Reads `openapi.json`, writes `tools.ts` |
| `src/rundit/rundit.service.ts` | SDK-client factory (`clientFor(apiKey)`; env-key default for stdio) |
| `src/rundit/rundit-tools.service.ts` | Precomputes tool schemas, builds MCP servers bound to a client |
| `src/http-server.ts` | http mode: stateless Streamable HTTP endpoint, key pass-through |
| `src/rundit/json-schema-to-zod.ts` | Converts JSON Schema inputs to Zod at runtime |

## Local Development

The API lives in `rundit-back`, the client is generated in `rundit-sdk`, and this repo turns the client into tools. One iteration of an API change walks all three:

```
rundit-back            rundit-sdk                      rundit-mcp
npm run sdk:openapi -> spec/sdk.openapi.json         -> npm link @rundit-sdk/client
                       npm run sdk:generate            npm run build (codegen + tsc)
                       packages/client (npm link)      npm start / register-mcp.sh
```

| npm script | What it does |
|------------|--------------|
| `npm run build:local -- --regen-sdk` | Emits the spec in `../rundit-back`, syncs it into `../rundit-sdk/spec`, regenerates `packages/client`, links it here, regenerates `tools.ts`, runs `tsc` |
| `npm run build:local` | Links the already-generated client, regenerates `tools.ts`, runs `tsc` |
| `npm run build:local -- --skip-link` | Only regenerates `tools.ts` + `tsc` (link already in place) |
| `npm run build:local -- --remove` | Drops the link and reinstalls the pinned published SDK |
| `npm start` | Runs the http transport on `:3002` against `http://localhost:3000/api/v2/sdk` |
| `npm run register:local` | Registers the stdio build with Claude Code (idempotent; prompts for API key) |

Prerequisites: `rundit-back` and `rundit-sdk` checked out as siblings (`--back-dir=` / `--sdk-dir=` override), each with `npm install` done, and your local backend reachable on port 3000.

### Iteration workflow (every API change)

```bash
# 1. Edit src/sdk-api/* in rundit-back (the watcher on :3000 restarts the backend).
# 2. Regenerate spec -> client -> tools.ts -> dist in one call:
npm run build:local -- --regen-sdk
# 3. Restart the MCP server (`npm start`, or restart Claude Code for a stdio registration).
```

`node_modules/@rundit-sdk/client` is a **symlink** into `rundit-sdk/packages/client` — that is what lets `npm run sdk:generate` over there show up here without a reinstall. Verify with `ls -la node_modules/@rundit-sdk/client` (entry starts with `l`); rerun `npm run build:local` to repair a copy. Note that regenerating dirties `rundit-sdk/packages/client` and `spec/` in that public checkout; those are published from CI, so do not commit them by hand.

### Smoke-testing as an agent

Point a headless Claude Code session at the local http server with only the MCP tools enabled and read its tool calls:

```bash
cat > /tmp/mcp-loop.json <<'JSON'
{"mcpServers":{"rundit-loop":{"type":"http","url":"http://localhost:3002/mcp","headers":{"Authorization":"Bearer rdt_ten_..."}}}}
JSON
claude -p --mcp-config /tmp/mcp-loop.json --strict-mcp-config --allowedTools "mcp__rundit-loop__*" \
  --output-format stream-json --verbose "Answer ... and finish with a 'Friction log' section" > run.jsonl
```

Each `tool_use` / `tool_result` line in `run.jsonl` carries the arguments and the result size, so oversized responses, validation errors, and wasted discovery calls are easy to spot. Run it from a directory outside the repos so the agent has no insider knowledge.

### Less common cases

- **I only changed MCP code (not the SDK):** `npm run build:local -- --skip-link` → restart the server.
- **I want to change the registration (port, API key, name):** `npm run register:local -- --port=4000` (or `--api-key=…`, `--name=…`) → restart Claude Code. No rebuild needed.
- **I want to point at another checkout:** `npm run build:local -- --sdk-dir=<path> --back-dir=<path>`.

### Troubleshooting

- **A tool that should exist is missing from `tools.ts`.** The linked client is stale. Confirm `node_modules/@rundit-sdk/client` is a symlink; then rerun `npm run build:local -- --regen-sdk`.
- **`dist/main.js not found` when registering.** Run `npm run build:local` first.
- **Claude Code can't reach the MCP server.** Run `npm run register:local:show`; verify `RUNDIT_BASE_URL` (it must include `/api/v2/sdk`) and that your backend is up on that port.
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

### Hosted deployment sync (Cloud 66)

The hosted image bakes the SDK at image-build time from an npm dist-tag. There
is one Dockerfile per stack, identical except for the tag:

| Stack | Dockerfile | Installs |
|-------|------------|----------|
| production | [`Dockerfile.hosted`](Dockerfile.hosted) | `@rundit-sdk/client@latest` |
| test | [`Dockerfile.hosted.test`](Dockerfile.hosted.test) | `@rundit-sdk/client@rc` |

Each Cloud 66 stack selects its file via `dockerfile_path` in its service.yml
(`mcp` service). No build args, Habitus secrets, or stack env vars are
involved — the tag is literally in the file. The build log prints
`==> Baked @rundit-sdk/client@<version>`; check that line first when the
running server reports an unexpected tool count. Layer caching cannot pin a
stale version: each Dockerfile `ADD`s the npm registry manifest for its
dist-tag (`registry.npmjs.org/@rundit-sdk/client/<tag>`) before the install,
and Docker re-fetches ADD URLs on every build and keys the cache on their
content, so a moved tag rebuilds the install layer automatically. The build
log also prints `==> Target @rundit-sdk/client@<tag> = <version>` from that
manifest; if Target and Baked disagree, the build reached the registry but
`npm install` did not resolve the same tag.

Deployments follow SDK releases automatically: after every publish,
`rundit-sdk`'s publish workflow waits for npm to serve the new version on the
channel's dist-tag, then calls the matching stack's Cloud 66 redeployment
hook — `rc` publish → test stack, `latest` publish → prod stack. The rebuild
installs the fresh tag; no commit in this repo is involved. A failed or
skipped redeploy is recovered by re-running the publish workflow run, or by
hitting the stack's redeploy hook manually.

Required configuration (in the **rundit-sdk** repo's secrets):
`CLOUD66_MCP_REDEPLOY_HOOK_TEST` and `CLOUD66_MCP_REDEPLOY_HOOK_PROD` — each
stack's redeployment hook URL from its Cloud 66 stack page.

Consequences of tracking dist-tags:
- The `@rundit-sdk/client` pin in `package.json`/`package-lock.json` and the
  committed `tools.ts` describe local development, not what production runs —
  bump them periodically so review diffs stay meaningful.
- Any Cloud 66 rebuild (e.g. a config redeploy) picks up whatever the tag
  points at at that moment — `rc` on test, `latest` on production.
- The deploy gate for a new SDK is the image build itself (codegen + `tsc`);
  the vitest suite only runs in this repo's CI against the pinned version.

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

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes to `main`
and on every PR: `npm ci` → `codegen:check` (committed `tools.ts` matches the
installed SDK) → `lint` ([oxlint](https://oxc.rs/docs/guide/usage/linter)) →
`build` (codegen + `tsc`) → `test` ([vitest](https://vitest.dev), specs in
`test/`). Run the same locally:

```bash
npm run codegen:check && npm run lint && npm run build && npm test
```

## Smoke test

stdio:

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| docker run -i --rm -e RUNDIT_API_KEY=rdt_ten_dummy rundit-mcp
```

http (`MCP_TRANSPORT=http PORT=3001 npm start`, or the `Dockerfile.hosted` image):

```bash
curl http://localhost:3001/health
# 401 without a key:
curl -i -X POST http://localhost:3001/mcp -H 'Content-Type: application/json' -d '{}'
# minimal tools/list endpoint smoke check with a key:
curl -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer rdt_ten_dummy' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Stderr prints `[rundit-mcp] registering N tools from @rundit-sdk/client vX.Y.Z`.
