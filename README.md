# rundit-mcp

A minimal [MCP](https://modelcontextprotocol.io) server that exposes the
[`@rundit-sdk/client`](https://www.npmjs.com/package/@rundit-sdk/client) npm
package as MCP tools, so any MCP-capable LLM can query Rundit using a personal
API key. Ships as a Docker image, speaks the standard **stdio** transport.

The container **installs `@rundit-sdk/client` and regenerates its tool list on
every start**, so each MCP session boots against the latest published SDK
without rebuilding the image. Pick the dist-tag (`latest` for prod, `rc` for
test) via `RUNDIT_SDK_DIST_TAG`.

## Tools

The tool list is generated from the SDK's `openapi.json` at container start —
one MCP tool per SDK operation. The exact set depends on the installed SDK
version; on the current `latest` it's:

| Tool                                    | SDK method                                       |
|-----------------------------------------|--------------------------------------------------|
| `companies_get_one`                     | `companies.getOne(id)`                           |
| `companies_get_all`                     | `companies.getAll(query)`                        |
| `company_groups_get_all`                | `companyGroups.getAll(query)`                    |
| `company_groups_get_one`                | `companyGroups.getOne(id)`                       |
| `positions_get_company_positions`       | `positions.getCompanyPositions(id, query)`       |
| `positions_get_portfolio_positions`     | `positions.getPortfolioPositions(query)`         |
| `transactions_get_company_transactions` | `transactions.getCompanyTransactions(id, query)` |
| `transactions_get_transactions`         | `transactions.getTransactions(query)`            |
| `metrics_get_types`                     | `metrics.getTypes()`                             |
| `metrics_search`                        | `metrics.search(body)`                           |
| `company_reports_list`                  | `companyReports.list(query)`                     |
| `company_reports_get_one`               | `companyReports.getOne(id)`                      |

See the [`@rundit-sdk/client` README](https://www.npmjs.com/package/@rundit-sdk/client)
for input/output type details. The startup log line
`registering N tools from @rundit-sdk/client vX.Y.Z` confirms which version
booted.

## Configuration

| Env var                | Required | Default                                | Notes                                                                          |
|------------------------|----------|----------------------------------------|--------------------------------------------------------------------------------|
| `RUNDIT_API_KEY`       | yes      | —                                      | Personal Rundit API key (`rdt_ten_...`). Create one from your account settings. |
| `RUNDIT_BASE_URL`      | no       | `https://api.rundit.com/api/v2/sdk`    | Set to `https://test.rundit.com/api/v2/sdk` to target the test environment.    |
| `RUNDIT_SDK_DIST_TAG`  | no       | `latest`                               | npm dist-tag for `@rundit-sdk/client`, installed fresh on each container start. Use `rc` to track the test/staging stream. |

## Quick start

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) running locally, and a personal Rundit API key (`rdt_ten_…`) from [your account privacy & security settings.](https://app.rundit.com/#/investor/settings/security)

### 1. Clone and build the image

```bash
git clone https://github.com/Rundit/rundit-mcp.git
cd rundit-mcp
docker build -t rundit-mcp .
```

You only need to rebuild this image when **rundit-mcp itself** changes. SDK
updates are picked up automatically: the entrypoint runs
`npm install @rundit-sdk/client@$RUNDIT_SDK_DIST_TAG` and regenerates the tool
list on every start, adding a few seconds of latency per session boot.

### 2. Wire into your MCP client

**Claude Code (CLI):**

```bash
claude mcp add rundit \
  --scope user \
  -- docker run -i --rm \
       -e RUNDIT_API_KEY=rdt_ten_your_key \
       rundit-mcp
```

Start (or restart) a session, then type `/mcp` — you should see `rundit`
connected with 12 tools.

**Claude Desktop:**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "rundit": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "RUNDIT_API_KEY=rdt_ten_your_key",
        "rundit-mcp"
      ]
    }
  }
}
```

To track the test stream instead, add
`"-e", "RUNDIT_SDK_DIST_TAG=rc"` and
`"-e", "RUNDIT_BASE_URL=https://test.rundit.com/api/v2/sdk"` to `args`.

Restart Claude Desktop; the Rundit tools appear in the connectors panel.

Any other stdio-capable MCP client uses the same `docker run -i --rm ...`
command — adapt the syntax to your client's config.

## Troubleshooting

- **401 from a tool call**: wrong API key, or the key targets prod while
  `RUNDIT_BASE_URL` points at test (or vice versa).
- **Server shows disconnected in `/mcp`**: run the same `docker run` command
  from your shell — Docker daemon, missing image, or env typos surface there.
- **Updating to a new SDK version**: just restart your MCP session — the
  container reinstalls `@rundit-sdk/client@$RUNDIT_SDK_DIST_TAG` and regenerates
  tools on each start. No image rebuild, no `git pull`, no client
  re-registration. The startup stderr line reports the resolved version.
- **Container takes longer to start than before**: expected. Each boot does an
  `npm install` for the SDK and a `tsc` compile (~5–10 s). Requires network
  access to the npm registry; if outbound network is blocked, set
  `RUNDIT_SDK_DIST_TAG` to a tag you've already cached or pre-populate the
  image with a pinned SDK.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for the codegen pipeline that keeps tools
in sync with the SDK, running the server without Docker, and other contributor
docs.
