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

// MCP Streamable HTTP servers must validate Origin to prevent DNS-rebinding.
// MCP clients (Claude Code, claude.ai, …) send no Origin header and are
// unaffected; browser-initiated requests carry one and are rejected unless
// allowlisted via MCP_ALLOWED_ORIGINS (comma-separated, exact match).
const ALLOWED_ORIGINS = new Set(
  (process.env.MCP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

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

  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    sendJson(res, 403, jsonRpcError(-32000, 'Forbidden: origin not allowed'));
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
      // Refuse immediately and drop the connection once the response is
      // flushed, so an oversized or slow upload can't keep the socket busy.
      res.setHeader('Connection', 'close');
      res.once('finish', () => req.destroy());
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
  // Auth scheme names are case-insensitive (RFC 9110 §11.1).
  const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i);
  if (bearer) {
    const token = bearer[1].trim();
    if (token) return token;
  }
  const apiKeyHeader = req.headers['x-api-key'];
  const apiKey = (Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader)?.trim();
  return apiKey || undefined;
}

class BodyTooLargeError extends Error {}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tooLarge = new BodyTooLargeError(`Request body exceeds ${MAX_BODY_BYTES} bytes`);

    const declaredLength = Number(req.headers['content-length']);
    if (declaredLength > MAX_BODY_BYTES) {
      reject(tooLarge);
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Reject as soon as the threshold is crossed — don't wait for the
        // client to finish uploading. The caller closes the connection.
        settled = true;
        chunks.length = 0;
        req.pause();
        reject(tooLarge);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new SyntaxError('Request body is not valid JSON'));
      }
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
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
