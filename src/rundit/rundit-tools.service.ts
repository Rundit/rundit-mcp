import { STATUS_CODES } from 'node:http';
import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RunditSdkError, type RunditClient } from '@rundit-sdk/client';
import { CallToolRequestSchema, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z, ZodError } from 'zod';
import { SDK_VERSION, TOOLS, type ToolSpec } from '../generated/tools.js';
import { schemaToZodShape, type JsonSchemaFragment } from './json-schema-to-zod.js';

type PreparedTool = {
  spec: ToolSpec;
  inputSchema: ReturnType<typeof prepareSchema>;
};

const prepareSchema = (schema: JsonSchemaFragment) => z.object(schemaToZodShape(schema)).strict();

class RunditMcpServer extends McpServer {
  override connect(transport: Transport): Promise<void> {
    return super.connect(withoutTasks(transport));
  }
}

@Injectable()
export class RunditToolsService {
  // JSON-schema → zod conversion runs once at boot; per-request servers
  // (http mode) only re-register the precomputed shapes.
  private readonly tools: PreparedTool[] = TOOLS.map((spec) => ({
    spec,
    inputSchema: prepareSchema(spec.inputSchema as JsonSchemaFragment),
  }));

  constructor() {
    process.stderr.write(
      `[rundit-mcp] prepared ${TOOLS.length} tools from @rundit-sdk/client v${SDK_VERSION}\n`,
    );
  }

  /**
   * Builds an MCP server whose tools call the SDK API through the given
   * client. stdio mode builds one for the process lifetime; http mode builds
   * one per request, bound to that request's API key.
   */
  createServer(client: RunditClient): McpServer {
    const server = new RunditMcpServer({
      name: 'rundit-mcp',
      version: '0.1.0',
    });
    for (const { spec, inputSchema } of this.tools) {
      server.registerTool(
        spec.name,
        { description: spec.description, inputSchema, annotations: spec.annotations },
        (args) => safeCall(() => spec.invoke(client, args)),
      );
    }
    // The SDK's default tool handler turns schema errors into plain text before
    // callbacks run. Validate the raw arguments here so unknown keys cannot be
    // stripped and all tool failures use the same structured error envelope.
    server.server.setRequestHandler(CallToolRequestSchema, ({ params }) => {
      const tool = this.tools.find(({ spec }) => spec.name === params.name);
      if (!tool) return Promise.resolve(errorResult('NOT_FOUND', `Unknown tool: ${params.name}`, 404));
      return safeCall(() => tool.spec.invoke(client, tool.inputSchema.parse(params.arguments ?? {})));
    });
    return server;
  }
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type FieldIssue = { field: string; message: string };
const ERROR_CODES: Record<number, string> = {
  400: 'INVALID_ARGUMENTS',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  422: 'INVALID_ARGUMENTS',
  429: 'RATE_LIMITED',
};

function errorPayload(code: string, error: string, status: number, issues: FieldIssue[] = [], body: unknown = null) {
  return { code, error, status, issues, body };
}

// Reject tasks before the SDK's task-capability and CreateTaskResult checks.
// Both HTTP and stdio retain protocol errors with our structured envelope in error.data.
function withoutTasks(transport: Transport): Transport {
  return {
    start: () => transport.start(),
    send: (message, options) => transport.send(message, options),
    close: () => transport.close(),
    get sessionId() { return transport.sessionId; },
    setProtocolVersion: (version) => transport.setProtocolVersion?.(version),
    get onclose() { return transport.onclose; },
    set onclose(handler) { transport.onclose = handler; },
    get onerror() { return transport.onerror; },
    set onerror(handler) { transport.onerror = handler; },
    get onmessage() { return transport.onmessage; },
    set onmessage(handler) {
      transport.onmessage = handler ? (message, extra) => {
        if ('id' in message && 'method' in message && message.method === 'tools/call' && message.params?.task) {
          const error = 'Task execution is not supported';
          void transport.send({ jsonrpc: '2.0', id: message.id, error: {
            code: ErrorCode.InvalidParams, message: error,
            data: errorPayload('INVALID_ARGUMENTS', error, 422),
          } }, { relatedRequestId: message.id }).catch((error: Error) => transport.onerror?.(error));
          return;
        }
        handler(message, extra);
      } : undefined;
    },
  };
}

function errorResult(code: string, error: string, status: number, issues: FieldIssue[] = [], body: unknown = null): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(errorPayload(code, error, status, issues, body)) }], isError: true };
}

function compactErrorBody(body: unknown, status: number, messages: string[], issues: FieldIssue[]): unknown {
  const message = messages.join('; ');
  if (body === message) return null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const extra = Object.fromEntries(Object.entries(body).filter(([key, value]) => {
    if ((key === 'message' || key === 'validationErrors') && Array.isArray(value) && !value.length) return false;
    if ((key === 'message' || key === 'validationErrors') &&
      (value === message || JSON.stringify(value) === JSON.stringify(messages))) return false;
    if (key === 'errors' && JSON.stringify(value) === JSON.stringify(issues)) return false;
    if (key === 'statusCode' && value === status) return false;
    if (key === 'error' && (value === message || value === STATUS_CODES[status])) return false;
    return true;
  }));
  return Object.keys(extra).length ? extra : null;
}

async function safeCall(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data ?? null) }] };
  } catch (err) {
    if (err instanceof ZodError) {
      const seen = new Set<string>();
      const issues = err.issues.flatMap((issue): FieldIssue[] => issue.code === 'unrecognized_keys'
        ? issue.keys.map(key => ({ field: [...issue.path, key].join('.'), message: `Unknown field: ${key}` }))
        : [{ field: issue.path.join('.'), message: issue.message }])
        .filter((issue) => {
          const key = JSON.stringify([issue.field, issue.message]);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      const message = issues.map(issue => issue.message.toLowerCase().startsWith(`${issue.field.toLowerCase()} `)
        ? issue.message : `${issue.field || 'arguments'}: ${issue.message}`).join('; ');
      return errorResult('INVALID_ARGUMENTS', message, 422, issues);
    }
    if (err instanceof RunditSdkError) {
      const body = err.body && typeof err.body === 'object' ? err.body as Record<string, unknown> : {};
      const isMessage = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
      const arrayMessages = [body.message, body.validationErrors].filter(Array.isArray)
        .map(messages => messages.filter(isMessage)).find(messages => messages.length > 0);
      const fallback = [body.message, body.error, err.body, err.message].find(isMessage)
        ?? STATUS_CODES[err.status] ?? 'Upstream request failed';
      const messages = arrayMessages ?? [fallback];
      const issues: FieldIssue[] = Array.isArray(body.errors)
        ? body.errors.filter((issue): issue is FieldIssue => !!issue && typeof issue === 'object' &&
          typeof issue.field === 'string' && typeof issue.message === 'string')
        : err.status === 422 ? messages.map(message => ({
          field: message.match(/^property (\w+) should not exist/)?.[1] ?? message.match(/^([\w.]+)(?::| (?:must|should)\b)/)?.[1] ?? '', message,
        })) : [];
      return errorResult(ERROR_CODES[err.status] ?? 'UPSTREAM_ERROR', messages.join('; '), err.status, issues,
        compactErrorBody(err.body, err.status, messages, issues));
    }
    return errorResult('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500);
  }
}
