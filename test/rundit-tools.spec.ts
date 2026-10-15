import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@rundit-sdk/client';
import type { Server } from 'node:http';
import { RunditToolsService } from '../src/rundit/rundit-tools.service.js';
import { startHttpServer } from '../src/http-server.js';
import type { RunditService } from '../src/rundit/rundit.service.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

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
  it('applies task rejection to non-HTTP transports too', async () => {
    const [serverTransport, peer] = InMemoryTransport.createLinkedPair();
    const mcp = new RunditToolsService().createServer(client);
    try {
      const response = new Promise<JSONRPCMessage>((resolve) => { peer.onmessage = resolve; });
      await mcp.connect(serverTransport);
      await peer.start();
      await peer.send({ jsonrpc: '2.0', id: 42, method: 'tools/call', params: {
        name: 'profiles_list', arguments: {}, task: { ttl: 60000 },
      } });
      expect(await response).toMatchObject({ id: 42, error: { code: -32602,
        data: { code: 'INVALID_ARGUMENTS', status: 422, error: 'Task execution is not supported' } } });
    } finally {
      await mcp.close();
      await peer.close();
    }
  });

  it.each(['profiles_list', 'unknown_tool'])('rejects task-augmented calls for %s with structured protocol error data', async (name) => {
    upstream.mockReset();
    const response = await request('tools/call', { name, arguments: {}, task: { ttl: 60000 } });
    expect(response.error).toMatchObject({ code: -32602,
      data: { code: 'INVALID_ARGUMENTS', error: 'Task execution is not supported', status: 422, issues: [], body: null } });
    expect(response.error.message).not.toContain('Invalid task creation result');
    expect(response.result).toBeUndefined();
    expect(upstream).not.toHaveBeenCalled();
  });

  it('accepts uppercase HTTP schemes from the generated profile schema', async () => {
    upstream.mockReset().mockResolvedValueOnce(new Response('{}'));
    const response = await request('tools/call', { name: 'profiles_create', arguments: {
      companyId: 17, name: 'Example', rolesInCompany: ['management'], website: 'HTTPS://example.com',
    } });
    expect(response.result.isError).not.toBe(true);
    expect(upstream).toHaveBeenCalledOnce();
  });

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
    expect(response.result.tools).toContainEqual(expect.objectContaining({
      name: 'profiles_create', annotations: expect.objectContaining({ readOnlyHint: false, destructiveHint: false }),
    }));
    expect(response.result.tools).toContainEqual(expect.objectContaining({
      name: 'profiles_delete', annotations: expect.objectContaining({ readOnlyHint: false, destructiveHint: true }),
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

  it('forwards profile PATCH values, including false and explicit null clears', async () => {
    const id = '1d972df2-5c8d-4e82-9b11-40bc08484321';
    for (const firstTimeFounder of [false, null]) {
      upstream.mockReset().mockResolvedValueOnce(new Response('{}'));
      const args = { id, companyId: 17, firstTimeFounder, position: null, country: null };
      const response = await request('tools/call', { name: 'profiles_update', arguments: args });
      expect(response.result.isError).not.toBe(true);
      const [url, init] = upstream.mock.calls[0];
      expect(url).toBe(`http://example.test/api/v2/sdk/profiles/${id}`);
      expect(init?.method).toBe('PATCH');
      expect(JSON.parse(init?.body as string)).toEqual({ companyId: 17, firstTimeFounder, position: null, country: null });
    }
  });

  it('deletes profiles with a company context and handles 204 responses', async () => {
    const id = '1d972df2-5c8d-4e82-9b11-40bc08484321';
    upstream.mockReset().mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await request('tools/call', { name: 'profiles_delete', arguments: { id, companyId: 17 } });
    expect(response.result.isError).not.toBe(true);
    const [url, init] = upstream.mock.calls[0];
    expect(url).toBe(`http://example.test/api/v2/sdk/profiles/${id}?companyId=17`);
    expect(init?.method).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it.each([
    ['profiles_update', { id: '1d972df2-5c8d-4e82-9b11-40bc08484321', companyId: 17, surName: 'Typo' }, 'surName'],
    ['profiles_list', { plausibleButUnsupportedFilter: true }, 'plausibleButUnsupportedFilter'],
    ['fixture_write', { points: [{ value: 0, optionValue: null, typo: true }] }, 'points.0.typo'],
  ])('rejects unknown fields in %s without invoking the upstream API', async (name, args, field) => {
    upstream.mockReset();
    write.mockClear();
    const response = await request('tools/call', { name, arguments: args });
    expect(response.result.isError).toBe(true);
    const error = JSON.parse(response.result.content[0].text);
    expect(error).toMatchObject({ code: 'INVALID_ARGUMENTS', status: 422, body: null,
      issues: expect.arrayContaining([expect.objectContaining({ field })]) });
    expect(upstream).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('uses the same structured envelope for local validation and backend field errors', async () => {
    const local = await request('tools/call', { name: 'profiles_list', arguments: { firstTimeFounder: 'true' } });
    expect(local.result.isError).toBe(true);
    const localError = JSON.parse(local.result.content[0].text);
    expect(localError).toMatchObject({ code: 'INVALID_ARGUMENTS', status: 422,
      issues: [expect.objectContaining({ field: 'firstTimeFounder' })] });
    const body = { message: ['birthYear must not be later than the current year'],
      errors: [{ field: 'birthYear', message: 'birthYear must not be later than the current year' }] };
    upstream.mockReset().mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 422, headers: { 'Content-Type': 'application/json' } }));
    const backend = await request('tools/call', { name: 'profiles_create', arguments: { companyId: 17,
      name: 'Example', rolesInCompany: ['management'], birthYear: 3026 } });
    const backendError = JSON.parse(backend.result.content[0].text);
    expect(backendError).toEqual({ code: 'INVALID_ARGUMENTS', error: body.message[0], status: 422, issues: body.errors, body });
    expect(Object.keys(backendError).sort()).toEqual(Object.keys(localError).sort());
  });

  it('explains the HTTP/HTTPS requirement for invalid website values', async () => {
    upstream.mockReset();
    for (const website of ['javascript:alert(1)', 'not-a-url']) {
      const response = await request('tools/call', { name: 'profiles_create', arguments: {
        companyId: 17, name: 'Example', rolesInCompany: ['management'], website,
      } });
      expect(response.result.isError).toBe(true);
      const message = 'Website must be a valid HTTP or HTTPS URL.';
      expect(JSON.parse(response.result.content[0].text)).toMatchObject({
        error: message, issues: [{ field: 'website', message }],
      });
    }
    expect(upstream).not.toHaveBeenCalled();
  });
});
