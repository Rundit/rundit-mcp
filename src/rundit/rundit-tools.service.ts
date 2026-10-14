import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RunditSdkError, type RunditClient } from '@rundit-sdk/client';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z, ZodError } from 'zod';
import { SDK_VERSION, TOOLS, type ToolSpec } from '../generated/tools.js';
import { schemaToZodShape, type JsonSchemaFragment } from './json-schema-to-zod.js';

type PreparedTool = {
  spec: ToolSpec;
  inputSchema: ReturnType<typeof prepareSchema>;
};

const prepareSchema = (schema: JsonSchemaFragment) => z.object(schemaToZodShape(schema)).strict();

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
    const server = new McpServer({
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
      if (params.task) return Promise.resolve(errorResult('INVALID_ARGUMENTS', 'Task execution is not supported', 422));
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

function errorResult(code: string, error: string, status: number, issues: FieldIssue[] = [], body: unknown = null): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ code, error, status, issues, body }) }], isError: true };
}

async function safeCall(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data ?? null) }] };
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.issues.flatMap((issue): FieldIssue[] => issue.code === 'unrecognized_keys'
        ? issue.keys.map(key => ({ field: [...issue.path, key].join('.'), message: `Unknown field: ${key}` }))
        : [{ field: issue.path.join('.'), message: issue.message }])
        .filter((issue, index, all) => all.findIndex(other => other.field === issue.field && other.message === issue.message) === index);
      const message = issues.map(issue => issue.message.toLowerCase().startsWith(`${issue.field.toLowerCase()} `)
        ? issue.message : `${issue.field || 'arguments'}: ${issue.message}`).join('; ');
      return errorResult('INVALID_ARGUMENTS', message, 422, issues);
    }
    if (err instanceof RunditSdkError) {
      const body = err.body && typeof err.body === 'object' ? err.body as Record<string, unknown> : {};
      const rawMessages = Array.isArray(body.message) ? body.message : body.validationErrors;
      const messages = Array.isArray(rawMessages) ? rawMessages.filter((message): message is string => typeof message === 'string')
        : typeof body.message === 'string' ? [body.message] : typeof body.error === 'string' ? [body.error]
          : typeof err.body === 'string' ? [err.body] : [err.message];
      const issues: FieldIssue[] = Array.isArray(body.errors)
        ? body.errors.filter((issue): issue is FieldIssue => !!issue && typeof issue === 'object' &&
          typeof issue.field === 'string' && typeof issue.message === 'string')
        : err.status === 422 ? messages.map(message => ({
          field: message.match(/^property (\w+) should not exist/)?.[1] ?? message.match(/^([\w.]+)(?::| (?:must|should)\b)/)?.[1] ?? '', message,
        })) : [];
      return errorResult(ERROR_CODES[err.status] ?? 'UPSTREAM_ERROR', messages.join('; '), err.status, issues, err.body);
    }
    return errorResult('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500);
  }
}
