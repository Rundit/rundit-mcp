# rundit-mcp

An [MCP](https://modelcontextprotocol.io) server (Docker, stdio) that exposes the [`@rundit-sdk/client`](https://www.npmjs.com/package/@rundit-sdk/client) package as tools, so any MCP-capable LLM can query Rundit with a personal API key.

## Quick start

**You need:** [Docker](https://docs.docker.com/get-docker/) running, and a Rundit
API key (`rdt_ten_…`) from your
[account privacy & security settings](https://app.rundit.com/#/investor/settings/security).

**1. Build the image** — only needed when rundit-mcp itself changes; SDK updates
are picked up automatically on each start.

```bash
git clone https://github.com/Rundit/rundit-mcp.git && cd rundit-mcp
docker build -t rundit-mcp .
```

**2. Register with your MCP client.**

Claude Code (CLI):

```bash
claude mcp add rundit --scope user \
  -- docker run -i --rm -e RUNDIT_API_KEY=rdt_ten_your_key rundit-mcp
```

Claude Desktop — add to `claude_desktop_config.json` (`~/Library/Application Support/Claude/`
on macOS, `%APPDATA%\Claude\` on Windows):

```json
{
  "mcpServers": {
    "rundit": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "RUNDIT_API_KEY=rdt_ten_your_key", "rundit-mcp"]
    }
  }
}
```

**3. Verify** — restart the session and run `/mcp`. `rundit` should be connected
with **18 tools** (the count tracks the installed SDK).

That's it. Everything below is reference.

---

## Configuration

| Env var               | Required | Default                             | Notes                                                                                              |
|-----------------------|----------|-------------------------------------|----------------------------------------------------------------------------------------------------|
| `RUNDIT_API_KEY`      | yes      | —                                   | Personal Rundit API key (`rdt_ten_…`).                                                             |
| `RUNDIT_BASE_URL`     | no       | `https://api.rundit.com/api/v2/sdk` | Set to `https://test.rundit.com/api/v2/sdk` for the test environment.                              |
| `RUNDIT_SDK_DIST_TAG` | no       | `latest`                            | npm dist-tag for `@rundit-sdk/client`, installed fresh each start. Use `rc` to track test/staging. |

To target the test stream, pass both `RUNDIT_SDK_DIST_TAG=rc` and the test
`RUNDIT_BASE_URL`.

## Tools

One MCP tool per SDK operation, generated from the SDK's `openapi.json` at
container start — so the set always matches your installed SDK version. They
cover companies, funds (company groups), positions, transactions, metrics, and
reports. For the live list, run `/mcp` or read the startup line `registering N
tools from @rundit-sdk/client vX.Y.Z`; see the
[`@rundit-sdk/client` README](https://www.npmjs.com/package/@rundit-sdk/client)
for each tool's inputs and outputs.

## Troubleshooting

- **401 from a tool call** — wrong API key, or the key/`RUNDIT_BASE_URL` mix prod
  and test.
- **404 from every call** — the SDK API is disabled on the target backend; point
  `RUNDIT_BASE_URL` at an environment where it's enabled.
- **Disconnected in `/mcp`** — run the same `docker run` command in your shell;
  Docker daemon, missing image, or env typos surface there.
- **Slow start** — expected: each boot does an `npm install` + `tsc` (~5–10 s) and
  needs npm registry access. Pin/cache the SDK if outbound network is blocked.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for the codegen pipeline, running without
Docker, and contributor docs.
