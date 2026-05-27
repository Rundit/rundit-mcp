# rundit-mcp

A minimal [MCP](https://modelcontextprotocol.io) server that exposes the
[`@rundit-sdk/client`](https://www.npmjs.com/package/@rundit-sdk/client) npm
package as MCP tools, so any MCP-capable LLM can query Rundit using a personal
API key. Ships as a Docker image, speaks the standard **stdio** transport.

## Tools

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
for input/output type details.

## Configuration

| Env var           | Required | Default                                | Notes                                                                          |
|-------------------|----------|----------------------------------------|--------------------------------------------------------------------------------|
| `RUNDIT_API_KEY`  | yes      | —                                      | Personal Rundit API key (`rdt_ten_...`). Create one from your account settings. |
| `RUNDIT_BASE_URL` | no       | `https://api.rundit.com/api/v2/sdk`    | Set to `https://test.rundit.com/api/v2/sdk` to target the test environment.    |

## Quick start

**Prerequisites:** [Docker](https://docs.docker.com/get-docker/) running locally, and a personal Rundit API key (`rdt_ten_…`) from [your account privacy and security settings.](https://app.rundit.com/#/investor/settings/security)

### 1. Clone and build the image

```bash
git clone https://github.com/Rundit/rundit-mcp.git
cd rundit-mcp
docker build -t rundit-mcp .
```

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

Restart Claude Desktop; the Rundit tools appear in the connectors panel.

Any other stdio-capable MCP client uses the same `docker run -i --rm ...`
command — adapt the syntax to your client's config.

## Troubleshooting

- **401 from a tool call**: wrong API key, or the key targets prod while
  `RUNDIT_BASE_URL` points at test (or vice versa).
- **Server shows disconnected in `/mcp`**: run the same `docker run` command
  from your shell — Docker daemon, missing image, or env typos surface there.
- **Updating to a new SDK version**: `git pull`, rebuild the image, restart
  your Claude session. No client re-registration needed.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for the codegen pipeline that keeps tools
in sync with the SDK, running the server without Docker, and other contributor
docs.
