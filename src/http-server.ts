import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { RunditToolsService } from './rundit/rundit-tools.service.js';
import type { RunditService } from './rundit/rundit.service.js';

const MCP_PATH = '/mcp';
// The gateway caps request bodies further out; this is a local backstop since
// the MCP SDK transport does not enforce one.
const MAX_BODY_BYTES = 4 * 1024 * 1024;

type HttpServerDeps = {
  port: number;
  tools: RunditToolsService;
  rundit: RunditService;
};

/**
 * Hosted (remote) transport: MCP over stateless Streamable HTTP.
 *
 * Every POST /mcp must carry a Rundit API key, which is forwarded verbatim to
 * the SDK API on each tool call. Nothing is validated or cached here — an
 * invalid key simply comes back as a 401 from the SDK API inside the tool
 * result. This process holds no secrets and no cross-request state.
 */
export function startHttpServer({ port, tools, rundit }: HttpServerDeps): Promise<Server> {
  const server = createServer((req, res) => {
    handleRequest(req, res, tools, rundit).catch((err) => {
      process.stderr.write(
        `[rundit-mcp] request error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
      );
      if (res.headersSent) {
        res.end();
      } else {
        sendJson(res, 500, jsonRpcError(-32603, 'Internal server error'));
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => {
      process.stderr.write(
        `[rundit-mcp] http transport listening on :${port} (POST ${MCP_PATH})\n`,
      );
      resolve(server);
    });
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  tools: RunditToolsService,
  rundit: RunditService,
): Promise<void> {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname.replace(/\/+$/, '') || '/';

  if (path === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (path !== MCP_PATH) {
    sendJson(res, 404, jsonRpcError(-32000, 'Not found'));
    return;
  }

  // Stateless mode has no SSE channel and no sessions, so GET and DELETE
  // (which serve those in stateful deployments) have nothing to do.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, jsonRpcError(-32000, 'Method not allowed'));
    return;
  }

  const apiKey = extractApiKey(req);
  if (!apiKey) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    sendJson(
      res,
      401,
      jsonRpcError(
        -32001,
        'Unauthorized: pass a Rundit API key as "Authorization: Bearer <key>" or "X-API-Key: <key>"',
      ),
    );
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      sendJson(res, 413, jsonRpcError(-32000, err.message));
    } else {
      sendJson(res, 400, jsonRpcError(-32700, 'Request body is not valid JSON'));
    }
    return;
  }

  // Fresh server + transport per request, with the SDK client bound to this
  // request's API key (the documented stateless pattern).
  const mcpServer = tools.createServer(rundit.clientFor(apiKey));
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on('close', () => {
    void transport.close();
    void mcpServer.close();
  });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, body);
}

function extractApiKey(req: IncomingMessage): string | undefined {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    if (token) return token;
  }
  const apiKeyHeader = req.headers['x-api-key'];
  const apiKey = (Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader)?.trim();
  return apiKey || undefined;
}

class BodyTooLargeError extends Error {}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new BodyTooLargeError(`Request body exceeds ${MAX_BODY_BYTES} bytes`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new SyntaxError('Request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function jsonRpcError(code: number, message: string): unknown {
  return { jsonrpc: '2.0', error: { code, message }, id: null };
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}
