import 'reflect-metadata';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createClient } from '@rundit-sdk/client';
import type { Server } from 'node:http';
import { startHttpServer } from '../src/http-server.js';
import { RunditToolsService } from '../src/rundit/rundit-tools.service.js';
import type { RunditService } from '../src/rundit/rundit.service.js';

const counts = { companyCount: 2, metricCount: 2, pointsWritten: 2 };
const upstream = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(counts), { headers: { 'Content-Type': 'application/json' } }));
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

it('sends a single multi-company PUT and returns counts without point echoes', async () => {
  const args = { companies: [
    { companyId: 270, currency: 'USD', items: [{ metricTypeName: 'MRR', points: [{ date: '2026-04-01', timeframe: 'Month', value: 312400, optionValue: null }] }] },
    { companyId: 271, currency: 'EUR', items: [{ metricTypeId: 11, flavor: 'forecast', points: [{ date: '2026-07-01', timeframe: 'Month', value: 123, optionValue: null }] }] },
  ] };
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-API-Key': 'test-key' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'metrics_write_points_batch', arguments: args } }) });
  const body = await response.json();
  expect(body.result).toEqual({ content: [{ type: 'text', text: JSON.stringify(counts) }] });
  expect(upstream).toHaveBeenCalledTimes(1);
  const [target, init] = upstream.mock.calls[0];
  expect(target).toBe('http://example.test/api/v2/sdk/metrics/points');
  expect(init?.method).toBe('PUT');
  expect(JSON.parse(init?.body as string)).toEqual(args);
});
