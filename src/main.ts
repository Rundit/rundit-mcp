import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AppModule } from './app.module.js';
import { RunditService } from './rundit/rundit.service.js';
import { RunditToolsService } from './rundit/rundit-tools.service.js';
import { startHttpServer } from './http-server.js';

async function bootstrap() {
  const transport = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error(
      `Unsupported MCP_TRANSPORT "${transport}" (expected "stdio" or "http")`,
    );
  }

  // stdio MCP transport owns stdout for JSON-RPC framing, so Nest's logger
  // (which writes to stdout by default) must stay silent; our own log lines
  // go to stderr in both modes.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });

  const tools = app.get(RunditToolsService);
  const rundit = app.get(RunditService);

  let closeTransport: () => Promise<void>;
  if (transport === 'http') {
    const port = Number(process.env.PORT ?? 3001);
    const server = await startHttpServer({ port, tools, rundit });
    closeTransport = () =>
      new Promise((resolve) => server.close(() => resolve()));
  } else {
    const mcpServer = tools.createServer(rundit.defaultClient());
    await mcpServer.connect(new StdioServerTransport());
    closeTransport = () => mcpServer.close();
  }

  const shutdown = async () => {
    process.stderr.write('[rundit-mcp] received shutdown signal, shutting down\n');
    await closeTransport();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  process.stderr.write(
    `[rundit-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
