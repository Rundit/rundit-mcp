import 'reflect-metadata';
import { request as httpRequest, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@rundit-sdk/client';
import { startHttpServer } from '../src/http-server.js';
import { RunditToolsService } from '../src/rundit/rundit-tools.service.js';
import type { RunditService } from '../src/rundit/rundit.service.js';

let server: Server;
let base: string;

// Upstream is an unreachable port: tool calls must surface a connection error
// as an MCP tool error, proving the per-request key pass-through wiring
// without a live backend.
const rundit = {
  clientFor: (apiKey: string) => createClient({ apiKey, baseUrl: 'http://127.0.0.1:9' }),
} as unknown as RunditService;

beforeAll(async () => {
  server = await startHttpServer({ port: 0, tools: new RunditToolsService(), rundit });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function mcpPost(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const TOOLS_LIST = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
const AUTH = { Authorization: 'Bearer rdt_ten_fake' };

describe('http transport', () => {
  it('serves /health without auth', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('404s unknown paths', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
  });

  it('405s non-POST on /mcp', async () => {
    const res = await fetch(`${base}/mcp`, { headers: AUTH });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
  });

  it('401s without a credential, advertising the Bearer scheme', async () => {
    const res = await mcpPost(TOOLS_LIST);
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('lists tools with an Authorization bearer key, case-insensitively', async () => {
    for (const header of ['Bearer rdt_ten_fake', 'bearer rdt_ten_fake']) {
      const res = await mcpPost(TOOLS_LIST, { Authorization: header });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.result.tools.length).toBeGreaterThan(0);
      expect(body.result.tools.map((t: { name: string }) => t.name)).toContain(
        'companies_get_all',
      );
    }
  });

  it('accepts the key via X-API-Key too', async () => {
    const res = await mcpPost(TOOLS_LIST, { 'X-API-Key': 'rdt_ten_fake' });
    expect(res.status).toBe(200);
  });

  it('403s browser origins that are not allowlisted', async () => {
    const res = await mcpPost(TOOLS_LIST, { ...AUTH, Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('400s bodies that are not JSON', async () => {
    const res = await mcpPost('{oops', AUTH);
    expect(res.status).toBe(400);
  });

  it('413s an oversized declared Content-Length before reading the body', async () => {
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        `${base}/mcp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer rdt_ten_fake',
            'Content-Length': String(100 * 1024 * 1024),
          },
        },
        (res) => {
          resolve(res.statusCode ?? 0);
          res.resume();
          req.destroy();
        },
      );
      req.on('error', reject);
      req.flushHeaders();
    });
    expect(status).toBe(413);
  });

  it('413s a streamed body as soon as it crosses the cap', async () => {
    const chunk = Buffer.alloc(1024 * 1024, 'a');
    const status = await new Promise<number>((resolve, reject) => {
      let done = false;
      const req = httpRequest(
        `${base}/mcp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer rdt_ten_fake',
            'Transfer-Encoding': 'chunked',
          },
        },
        (res) => {
          done = true;
          resolve(res.statusCode ?? 0);
          res.resume();
          req.destroy();
        },
      );
      // Write errors after the response are expected — the connection closes.
      req.on('error', (err) => {
        if (!done) reject(err);
      });
      // Write past the 4MB cap, then stop (without ending the request) and
      // wait: the 413 must arrive mid-upload. Not writing further avoids
      // racing the connection teardown with our own writes.
      let written = 0;
      const writeMore = () => {
        if (done || req.destroyed || written >= 5 * 1024 * 1024) return;
        written += chunk.length;
        req.write(chunk, () => setImmediate(writeMore));
      };
      writeMore();
    });
    expect(status).toBe(413);
  });

  it('answers CORS preflight for allowlisted-or-absent origins', async () => {
    const res = await fetch(`${base}/mcp`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toBe('POST');

    const rejected = await fetch(`${base}/mcp`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(rejected.status).toBe(403);
  });

  it('relays upstream failures as MCP tool errors, not transport errors', async () => {
    const res = await mcpPost(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'companies_get_all', arguments: {} },
      },
      AUTH,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.isError).toBe(true);
    expect(JSON.parse(body.result.content[0].text).error).toBeTruthy();
  });

});
