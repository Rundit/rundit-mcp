# Development

## Architecture

`rundit-mcp` is a NestJS process that registers every method on
`@rundit-sdk/client` as an MCP tool and speaks the stdio transport. The tool
list is **generated from the SDK's `openapi.json` at build time**, so updating
the SDK is the only step needed when new endpoints are added.

Key files:

- [src/main.ts](src/main.ts) — Nest bootstrap + stdio transport
- [src/rundit/rundit.service.ts](src/rundit/rundit.service.ts) — constructs the
  `@rundit-sdk/client` instance from env vars
- [src/rundit/rundit-tools.service.ts](src/rundit/rundit-tools.service.ts) —
  iterates `TOOLS` and registers each one with the MCP server
- [src/rundit/json-schema-to-zod.ts](src/rundit/json-schema-to-zod.ts) —
  converts the generated JSON-Schema input definitions to Zod shapes at runtime
- [src/generated/tools.ts](src/generated/tools.ts) — **generated**, do not
  edit by hand
- [scripts/generate-tools.mjs](scripts/generate-tools.mjs) — the generator

## Codegen

`scripts/generate-tools.mjs` reads
`node_modules/@rundit-sdk/client/openapi.json` and rewrites
`src/generated/tools.ts` — one `ToolSpec` per SDK operation, with a
JSON-Schema input and an `invoke` thunk that calls the corresponding method on
`RunditClient`.

The generated file is committed so SDK upgrades show up as a reviewable diff.

| Command                  | Effect                                                                                  |
|--------------------------|-----------------------------------------------------------------------------------------|
| `npm run codegen`        | Regenerates `src/generated/tools.ts` from the installed SDK.                            |
| `npm run codegen:check`  | Exits non-zero if the committed file differs from what the installed SDK would produce. |
| `npm run build`          | Runs `codegen` then `tsc`. Docker's build stage runs the same script.                   |

Because `npm run build` re-runs codegen, the Docker image is always built
against the SDK version pinned in `package-lock.json` — there's no way to
ship a stale tool list as long as the lockfile is honored.

## Keeping tools in sync with SDK releases

1. Add `@rundit-sdk/client` to your dependency-update bot (Renovate /
   Dependabot). Example Renovate rule:

   ```json
   {
     "packageRules": [
       { "matchPackageNames": ["@rundit-sdk/client"], "groupName": "rundit sdk" }
     ]
   }
   ```

2. In CI, after `npm ci`, run:

   ```bash
   npm run codegen:check
   ```

   Or, equivalently:

   ```bash
   npm run codegen
   git diff --exit-code src/generated/tools.ts \
     || (echo "::error::Run 'npm run codegen' and commit" && exit 1)
   ```

3. When the bot opens an SDK-bump PR, push a follow-up commit regenerating
   tools (or have CI auto-commit). A green CI signals the new tool surface is
   wired up and ready to ship.

## Wire into your MCP client and test against test env

**Claude Code (CLI):**

```bash
claude mcp add rundit \
  --scope user \
  -- docker run -i --rm \
       -e RUNDIT_API_KEY=rdt_ten_your_key \
       -e RUNDIT_BASE_URL=https://test.rundit.com/api/v2/sdk \
       rundit-mcp
```

## Run without Docker

```bash
npm install
npm run build

RUNDIT_API_KEY=rdt_ten_your_key \
RUNDIT_BASE_URL=https://test.rundit.com/api/v2/sdk \
npm start
```

The process reads MCP JSON-RPC from stdin and writes responses to stdout. For
interactive testing, use the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector).


## Smoke test

Send `initialize` + `tools/list` to the running container and verify all 12
tools come back:

```bash
printf '%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| docker run -i --rm -e RUNDIT_API_KEY=rdt_ten_dummy rundit-mcp
```

Stderr will print `[rundit-mcp] registering N tools from @rundit-sdk/client vX.Y.Z`.
