import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { RunditSdkError, type RunditClient } from '@rundit-sdk/client';
import { SDK_VERSION, TOOLS, type ToolSpec } from '../generated/tools.js';
import {
  schemaToZodShape,
  type JsonSchemaFragment,
  type ZodRawShape,
} from './json-schema-to-zod.js';

type PreparedTool = {
  spec: ToolSpec;
  inputSchema: ZodRawShape;
};

@Injectable()
export class RunditToolsService {
  // JSON-schema → zod conversion runs once at boot; per-request servers
  // (http mode) only re-register the precomputed shapes.
  private readonly tools: PreparedTool[] = TOOLS.map((spec) => ({
    spec,
    inputSchema: schemaToZodShape(spec.inputSchema as JsonSchemaFragment),
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
        { description: spec.description, inputSchema },
        (args) => safeCall(() => spec.invoke(client, args)),
      );
    }
    return server;
  }
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export async function safeCall(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data ?? null) }] };
  } catch (err) {
    if (err instanceof RunditSdkError) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: err.message,
              status: err.status,
              body: err.body,
            }),
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          }),
        },
      ],
      isError: true,
    };
  }
}
