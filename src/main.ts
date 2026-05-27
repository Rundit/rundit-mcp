import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  // stdio MCP transport owns stdout for JSON-RPC framing, so Nest's logger
  // (which writes to stdout by default) must stay silent. Errors are surfaced
  // via the catch block below on stderr.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    process.stderr.write(`[rundit-mcp] received ${signal}, shutting down\n`);
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
