import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RunditSdkError } from '@rundit-sdk/client';
import { SDK_VERSION, TOOLS, type ToolSpec } from '../generated/tools.js';
import {
  schemaToZodShape,
  type JsonSchemaFragment,
} from './json-schema-to-zod.js';
import { RunditService } from './rundit.service.js';

@Injectable()
export class RunditToolsService implements OnModuleInit {
  private readonly server = new McpServer({
    name: 'rundit-mcp',
    version: '0.1.0',
  });

  constructor(private readonly rundit: RunditService) {
    process.stderr.write(
      `[rundit-mcp] registering ${TOOLS.length} tools from @rundit-sdk/client v${SDK_VERSION}\n`,
    );
    for (const tool of TOOLS) this.registerTool(tool);
  }

  async onModuleInit(): Promise<void> {
    await this.server.connect(new StdioServerTransport());
  }

  private registerTool(tool: ToolSpec): void {
    const inputSchema = schemaToZodShape(tool.inputSchema as JsonSchemaFragment);
    this.server.registerTool(
      tool.name,
      { description: tool.description, inputSchema },
      (args) => safeCall(() => tool.invoke(this.rundit.client, args)),
    );
  }
}

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

async function safeCall(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data) }] };
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
