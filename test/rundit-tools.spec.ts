import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@rundit-sdk/client';
import type { Server } from 'node:http';
import { RunditToolsService } from '../src/rundit/rundit-tools.service.js';
import { startHttpServer } from '../src/http-server.js';
import type { RunditService } from '../src/rundit/rundit.service.js';

const write = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../src/generated/tools.js', async (importOriginal) => {
  const generated = await importOriginal<typeof import('../src/generated/tools.js')>();
  return { ...generated, TOOLS: [...generated.TOOLS, {
    name: 'fixture_write',
    description: 'Test fixture for void writes, independent of the released SDK catalog.',
    annotations: { readOnlyHint: false, destructiveHint: true },
    inputSchema: { type: 'object', properties: {
      points: { type: 'array', items: { type: 'object', properties: {
        value: { type: 'number' },
        optionValue: { type: 'string', nullable: true },
      }, required: ['value', 'optionValue'] } },
    }, required: ['points'] },
    invoke: (_client: unknown, args: unknown) => write(args),
  }] };
});

const upstream = vi.fn<typeof fetch>();
const client = createClient({ apiKey: 'test-key', baseUrl: 'http://example.test/api/v2/sdk', fetch: upstream });
let server: Server;
let url: string;

beforeAll(async () => {
  server = await startHttpServer({ port: 0, tools: new RunditToolsService(), rundit: { clientFor: () => client } as unknown as RunditService });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing port');
  url = `http://127.0.0.1:${address.port}/mcp`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

async function request(method: string, params?: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-API-Key': 'test-key' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  expect(response.status).toBe(200);
  return response.json();
}

describe('generated tools over HTTP', () => {
  it('publishes safety hints for reads, POST-based reads and writes', async () => {
    const response = await request('tools/list');
    for (const name of ['companies_get_all', 'metrics_search', 'metrics_compare', 'metrics_aggregate']) {
      expect(response.result.tools).toContainEqual(expect.objectContaining({
        name, annotations: expect.objectContaining({ readOnlyHint: true, destructiveHint: false }),
      }));
    }
    expect(response.result.tools).toContainEqual(expect.objectContaining({
      name: 'fixture_write', annotations: expect.objectContaining({ readOnlyHint: false, destructiveHint: true }),
    }));
  });

  it('preserves explicit false in POST-based reads', async () => {
    upstream.mockReset().mockResolvedValueOnce(new Response('{}'));
    const args = { metricTypeIds: [42], companyIds: [17], includeChange: false };
    const response = await request('tools/call', { name: 'metrics_compare', arguments: args });
    expect(response.result.isError).not.toBe(true);
    expect(upstream).toHaveBeenCalledTimes(1);
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe('http://example.test/api/v2/sdk/metrics/compare');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(args);
  });

  it('preserves nested values and nulls and handles void invocation results', async () => {
    write.mockClear();
    const points = [{ value: 0, optionValue: null }];
    const response = await request('tools/call', { name: 'fixture_write', arguments: { points } });
    expect(response.result).toEqual({ content: [{ type: 'text', text: 'null' }] });
    expect(write).toHaveBeenCalledExactlyOnceWith({ points });
  });
});
