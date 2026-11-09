import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { RunditToolsService } from './rundit/rundit-tools.service.js';
import { McpAuthenticationError, McpAuthenticationServiceError, type RunditService } from './rundit/rundit.service.js';

import { TOOLS } from './generated/tools.js';

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
      const address = server.address();
      const actualPort = address && typeof address !== 'string' ? address.port : port;
      process.stderr.write(
        `[rundit-mcp] http transport listening on :${actualPort} (POST ${MCP_PATH})\n`,
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

  if (['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].includes(path) && rundit.oauth) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    sendJson(res, 200, { resource: rundit.oauth.resource, authorization_servers: [rundit.oauth.issuer], bearer_methods_supported: ['header'], scopes_supported: [...new Set(TOOLS.flatMap(tool => tool.scopes))] });
    return;
  }

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
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, MCP-Protocol-Version',
    });
    res.end();
    return;
  }

  const credential = extractApiKey(req);
  const resourceMetadata = !!rundit.oauth;
  const challenge = rundit.oauth?.challenge ?? 'Bearer';
  if (!credential) {
    res.setHeader('WWW-Authenticate', challenge);
    sendJson(res, 401, jsonRpcError(-32001, 'Connect to Rundit to authorize this application'));
    return;
  }
  let principal: Awaited<ReturnType<RunditService['authenticate']>>;
  try {
    principal = await rundit.authenticate(credential, !req.headers.authorization && !!req.headers['x-api-key']);
  } catch (error) {
    if (!(error instanceof McpAuthenticationError)) {
      const reason = error instanceof McpAuthenticationServiceError ? error.reason : 'unexpected';
      process.stderr.write(`[rundit-mcp] authentication service failure: ${reason}\n`);
      sendJson(res, 503, jsonRpcError(-32603, 'Authentication service unavailable'));
      return;
    }
    res.setHeader('WWW-Authenticate', `${challenge}${resourceMetadata ? ',' : ''} error="invalid_token"`);
    sendJson(res, 401, jsonRpcError(-32001, 'Connection expired or revoked. Reconnect to Rundit.'));
    return;
  }
  // Stateless mode does not expose SSE sessions.
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, jsonRpcError(-32000, 'Method not allowed'));
    return;
  }

  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      // Refuse immediately, then drain (not buffer) the rest of the upload so
      // the client can read the 413 — destroying outright can RST the socket
      // before the response is delivered. A timer bounds how long a
      // never-ending upload may occupy the connection.
      res.setHeader('Connection', 'close');
      sendJson(res, 413, jsonRpcError(-32000, err.message));
      req.resume();
      const drainDeadline = setTimeout(() => req.destroy(), 10_000);
      drainDeadline.unref();
      req.once('close', () => clearTimeout(drainDeadline));
    } else {
      sendJson(res, 400, jsonRpcError(-32700, 'Request body is not valid JSON'));
    }
    return;
  }

  const call = body as { method?: string; params?: { name?: string } } | null;
  if (call?.method === 'tools/call' && principal.scopes) {
    const tool = TOOLS.find(tool => tool.name === call.params?.name);
    if (tool && tool.scopes.some(scope => !principal.scopes!.includes(scope))) {
      res.setHeader('WWW-Authenticate', `${challenge}${resourceMetadata ? ',' : ''} error="insufficient_scope", scope="${tool.scopes.join(' ')}"`);
      sendJson(res, 403, jsonRpcError(-32001, 'This connection does not have the permissions required by this tool'));
      return;
    }
  }

  // A fresh SDK client and transport preserve isolation between connections.
  const mcpServer = tools.createServer(principal.client, principal.scopes);
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
