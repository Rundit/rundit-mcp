# rundit-mcp

An [MCP](https://modelcontextprotocol.io) server (Docker, stdio) that exposes the [`@rundit-sdk/client`](https://www.npmjs.com/package/@rundit-sdk/client) package as tools, so MCP-capable AI apps can use Rundit through hosted OAuth connections or a personal API key.

## Quick start (local Docker with an API key)

**You need:** [Docker](https://docs.docker.com/get-docker/) running, [git client](https://git-scm.com/install) and a Rundit API key (`rdt_ten_…`) from your
[Integrations → API / MCP](https://app.rundit.com/#/investor/integrations/api).

**1. Build the image** — only needed when rundit-mcp itself changes; SDK updates
are picked up automatically on each start. Open command line and run the following command:

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
with the tools available in the installed SDK.

That's it. Everything below is reference.

---

## Configuration

| Env var               | Required   | Default                             | Notes                                                                                              |
|-----------------------|------------|-------------------------------------|----------------------------------------------------------------------------------------------------|
| `RUNDIT_API_KEY`      | stdio mode | —                                   | Personal Rundit API key (`rdt_ten_…`). Unused in http mode — callers send their own credential per request. |
| `RUNDIT_BASE_URL`     | no         | `https://api.rundit.com/api/v2/sdk` | Set to `https://test.rundit.com/api/v2/sdk` for the test environment.                              |
| `RUNDIT_SDK_DIST_TAG` | no         | `latest`                            | npm dist-tag for `@rundit-sdk/client`, installed fresh each start. Use `rc` to track test/staging. |
| `MCP_TRANSPORT`       | no         | `stdio`                             | `http` serves MCP over stateless Streamable HTTP instead of stdio (see below).                     |
| `PORT`                | no         | `3001`                              | Listen port in http mode.                                                                          |
| `OAUTH_ISSUER` | OAuth mode | — | Public HTTPS authorization-server issuer. |
| `OAUTH_RESOURCE` | OAuth mode | — | Public HTTPS MCP resource URL, including `/mcp`. |
| `MCP_AUTH_EXCHANGE_URL` | OAuth mode | — | Private credential-exchange endpoint; HTTP is allowed on the service network. |
| `OAUTH_EXCHANGE_SECRET` | OAuth mode | — | Deployment secret of at least 32 characters, authenticating exchange requests. Never a user credential. |
| `MCP_ALLOWED_ORIGINS` | no         | — (all browser origins rejected)    | http mode: comma-separated `Origin` allowlist. MCP clients send no `Origin` and are unaffected.    |

To target the test stream, pass both `RUNDIT_SDK_DIST_TAG=rc` and the test
`RUNDIT_BASE_URL`.

## Hosted image releases

`Dockerfile.hosted.test` installs the SDK from `rc` during the image build;
`Dockerfile.hosted` installs from `latest`. These images run compiled code and do
not install dependencies at startup. `RUNDIT_SDK_DIST_TAG` applies only to the
generic `Dockerfile`, not these hosted images.

Both hosted Dockerfiles fetch npm tag metadata with remote `ADD` before installing
dependencies. When the tag metadata changes, Docker invalidates that layer and
rebuilds the install and compilation layers. A container restart alone keeps the
old SDK: rebuild and deploy the image, then verify the build log's
`Baked @rundit-sdk/client@<version>` against the intended release.

Publish the SDK with delegation support before deploying OAuth-enabled MCP.
Update `package.json` and `package-lock.json` to the exact published SDK version
and pass clean-install CI. The hosted tag must also contain that support;
updating the lockfile alone does not change what `rc` or `latest` points to.

## HTTP mode (remote server)

With `MCP_TRANSPORT=http` the same process serves MCP over stateless
[Streamable HTTP](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http):
`POST /mcp` handles every MCP message, `GET /health` reports liveness. Each
request carries the caller's credential. Without OAuth configuration, API keys are
forwarded to the backend as before. With OAuth enabled, bearer access tokens and
API keys are validated through the private exchange endpoint, and tools are
filtered to the returned permissions. The backend enforces authorization on every
API call. OAuth access tokens are exchanged for short-lived SDK delegations;
they are never forwarded as API keys.

Set all four OAuth variables together; partial or invalid configuration prevents
startup. Public HTTP issuer/resource URLs are allowed only for local development
on loopback or `.localhost` hosts. The process holds an exchange secret but no
user sessions or persistent per-user credentials. Supply this secret using your
deployment secret store; never put it in source code, client setup instructions,
Docker images, or logs. The delegation signing key stays exclusively in the
backend and must not be provided to this service. Registration and browser sign-in
require no user-supplied API key or exchange secret.

The private exchange must use its canonical URL: redirects are rejected so
credentials cannot be forwarded to another destination.

Authentication-service outages and exchange-secret mismatches return 503, with a
sanitized diagnostic category in stderr. A rejected user credential returns 401;
insufficient tool permissions return 403. Empty permission sets produce an empty
tool list.

Register with Claude Code:

```bash
claude mcp add --transport http rundit https://your-rundit-host/mcp \
  --header "Authorization: Bearer rdt_ten_your_key"
```

Or in `.mcp.json` (env expansion keeps the key out of the file):

```json
{
  "mcpServers": {
    "rundit": {
      "type": "http",
      "url": "https://your-rundit-host/mcp",
      "headers": { "Authorization": "Bearer ${RUNDIT_API_KEY}" }
    }
  }
}
```

## Tools

One MCP tool per SDK operation, generated from the SDK's `openapi.json` at
container start — so the set always matches your installed SDK version. They
cover companies, funds (company groups), positions, transactions, metrics, and
reports. For the live list, run `/mcp` or read the startup line `prepared N
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
