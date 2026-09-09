import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@rundit-sdk/client';
import { z } from 'zod';
import type { Server } from 'node:http';
import { TOOLS } from '../src/generated/tools.js';
import { schemaToZodShape, type JsonSchemaFragment } from '../src/rundit/json-schema-to-zod.js';
import { RunditToolsService } from '../src/rundit/rundit-tools.service.js';
import { startHttpServer } from '../src/http-server.js';
import type { RunditService } from '../src/rundit/rundit.service.js';

const upstream = vi.fn(async () => new Response(JSON.stringify({ id: 'created' }), { headers: { 'Content-Type': 'application/json' } }));
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
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-API-Key': 'test-key' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  return response.json();
}

describe('metric lifecycle tools', () => {
  it('preserves false for shape-only metric discovery', async () => {
    upstream.mockClear();
    await request('tools/call', { name: 'metrics_search', arguments: { companyGroupIds: [5], includePoints: false } });
    const [, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ companyGroupIds: [5], includePoints: false });
  });

  it('sends a complete agent batch import without losing nested configuration or preview flags', async () => {
    upstream.mockClear();
    const args = { dryRun: true, onConflict: 'reject', companies: [{ companyId: 270, currency: 'USD', items: [
      { metricTypeName: 'Revenue', points: [{ date: '2026-04-01', timeframe: 'Quarter', value: 980300, optionValue: null }] },
      { createType: { name: 'Active Accounts', valueType: 'numeric', unit: 'Number', aggMethod: 'LAST_AVAILABLE', summaryAggregationMethods: ['SUM'] }, flavor: 'forecast', points: [{ date: '2026-07-01', timeframe: 'Month', value: 1500, optionValue: null }] },
    ] }, { companyId: 271, currency: 'EUR', items: [{ metricTypeName: 'Revenue', points: [{ date: '2026-04-01', timeframe: 'Quarter', value: 123, optionValue: null }] }] }] };
    const response = await request('tools/call', { name: 'metrics_import', arguments: args });
    expect(response.result.isError).not.toBe(true);
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://example.test/api/v2/sdk/metrics/import');
    expect(JSON.parse(init.body as string)).toEqual(args);
    const spec = TOOLS.find((tool) => tool.name === 'metrics_import')!;
    const schema = z.object(schemaToZodShape(spec.inputSchema as JsonSchemaFragment));
    expect(schema.safeParse({ ...args, companies: [] }).success).toBe(false);
    expect(schema.safeParse({ ...args, companies: Array(101).fill(args.companies[0]) }).success).toBe(false);
    expect(schema.safeParse({ ...args, companies: [{ ...args.companies[0], items: Array(51).fill(args.companies[0].items[0]) }] }).success).toBe(false);
  });

  it('passes metric type name searches to the generated SDK', async () => {
    upstream.mockClear();
    await request('tools/call', { name: 'metrics_get_types', arguments: { nameSearch: ['MRR', 'Revenue'], origin: 'Predefined', limit: 20 } });
    const [url] = upstream.mock.calls[0] as unknown as [string];
    expect(url).toContain('nameSearch');
    expect(url).toContain('MRR');
    expect(url).toContain('Revenue');
    expect(url).toContain('origin=Predefined');
  });

  it('publishes separate destructive operations with typed nested inputs', async () => {
    const response = await request('tools/list');
    for (const name of ['metrics_create_type', 'metrics_delete_type', 'metrics_delete', 'metrics_delete_points', 'metric_templates_create_entry', 'metric_templates_update_entry', 'metric_templates_delete_entry']) {
      expect(response.result.tools).toContainEqual(expect.objectContaining({ name, annotations: expect.objectContaining({ readOnlyHint: false, destructiveHint: true }) }));
    }
    const spec = TOOLS.find((tool) => tool.name === 'metrics_create_type')!;
    const schema = z.object(schemaToZodShape(spec.inputSchema as JsonSchemaFragment));
    const input = { name: 'Status', valueType: 'option', aggMethod: 'NONE', summaryAggregationMethods: ['COUNT_POSITIVES'], optionConfig: { options: [{ value: 'Yes', isPositive: true }] } };
    expect(schema.parse(input)).toEqual(input);
    expect(schema.safeParse({ ...input, optionConfig: { options: [{ value: 'Yes' }] } }).success).toBe(false);
  });

  it('sends template identifiers in the URL and configuration in the body', async () => {
    upstream.mockClear();
    const config = { metricTypeId: 42, hasForecast: false, hasBudget: true, companyFilter: [{ type: 'company', value: 17 }] };
    const response = await request('tools/call', { name: 'metric_templates_update_entry', arguments: { templateId: 'template', entryId: 'entry', ...config } });
    expect(response.result.isError).not.toBe(true);
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://example.test/api/v2/sdk/metrics/templates/template/entries/entry');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual(config);
  });

  it('sends row deletion without a body and handles empty SDK responses', async () => {
    upstream.mockClear();
    upstream.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await request('tools/call', { name: 'metrics_delete', arguments: { metricId: 42 } });
    expect(response.result).toEqual({ content: [{ type: 'text', text: 'null' }] });
    const [url, init] = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://example.test/api/v2/sdk/metrics/42');
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });
});
