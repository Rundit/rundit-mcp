import 'reflect-metadata';
import { createServer, type Server } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RunditService,
  McpAuthenticationError,
  McpAuthenticationServiceError,
} from '../src/rundit/rundit.service.js';
import { readOAuthConfig } from '../src/oauth-config.js';

const settings = {
  OAUTH_ISSUER: 'https://api.example.test/oauth',
  OAUTH_RESOURCE: 'https://api.example.test/mcp',
  MCP_AUTH_EXCHANGE_URL: 'http://auth-service:3000/oauth/mcp-exchange',
  OAUTH_EXCHANGE_SECRET: 'test-exchange-credential'.repeat(3),
};
const service = () => new RunditService(new ConfigService(settings));
afterEach(() => vi.unstubAllGlobals());

describe('OAuth configuration', () => {
  it('allows legacy API-key mode only when all OAuth settings are absent', () => {
    expect(readOAuthConfig(() => undefined)).toBeUndefined();
  });
  it.each(Object.keys(settings))('rejects configuration missing %s', (key) => {
    expect(() =>
      readOAuthConfig((name) =>
        name === key ? undefined : settings[name as keyof typeof settings],
      ),
    ).toThrow();
  });
  it.each(['OAUTH_ISSUER', 'OAUTH_RESOURCE', 'MCP_AUTH_EXCHANGE_URL'])(
    'rejects malformed %s without echoing its value',
    (key) => {
      expect(() =>
        readOAuthConfig((name) =>
          name === key
            ? 'secret-invalid-url'
            : settings[name as keyof typeof settings],
        ),
      ).toThrow(`Invalid OAuth URL: ${key}`);
    },
  );
  it('rejects short exchange credentials', () => {
    expect(() =>
      readOAuthConfig((name) =>
        name === 'OAUTH_EXCHANGE_SECRET'
          ? 'short'
          : settings[name as keyof typeof settings],
      ),
    ).toThrow();
  });
});

describe('credential exchange', () => {
  it('uses delegation credentials for backend requests, never the original OAuth token', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          delegation: 'signed-delegation',
          scopes: ['companies:read'],
        }),
      )
      .mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal('fetch', fetch);
    const principal = await service().authenticate('user-oauth-token', false);
    expect(principal.scopes).toEqual(['companies:read']);
    await principal.client.companies.getAll();
    expect(fetch.mock.calls[0][1].headers['X-Rundit-Mcp-Secret']).toBe(
      settings.OAUTH_EXCHANGE_SECRET,
    );
    const headers = new Headers(fetch.mock.calls[1][1].headers);
    expect(headers.get('X-Rundit-Mcp-Delegation')).toBe('signed-delegation');
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-API-Key')).toBe(false);
  });
  it('preserves validated API-key authentication', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ apiKey: true, scopes: ['companies:read'] }),
        ),
    );
    expect(
      (await service().authenticate('rdt_ten_fixture', true)).scopes,
    ).toEqual(['companies:read']);
  });
  it('distinguishes rejected user credentials from service credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 403 })),
    );
    await expect(
      service().authenticate('invalid', false),
    ).rejects.toBeInstanceOf(McpAuthenticationError);
    await expect(service().authenticate('valid', false)).rejects.toMatchObject({
      reason: 'service-credential',
    });
  });
  it.each([
    { delegation: 'token' },
    { delegation: 'token', scopes: 'companies:read' },
    { delegation: 'token', scopes: [7] },
    { apiKey: true },
    { scopes: [] },
  ])('rejects malformed successful responses: %j', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)));
    await expect(
      service().authenticate('credential', false),
    ).rejects.toMatchObject({ reason: 'response' });
  });
  it('accepts an empty scope set without treating it as unrestricted', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ delegation: 'token', scopes: [] })),
    );
    expect((await service().authenticate('credential', false)).scopes).toEqual(
      [],
    );
  });
  it('maps timeouts and upstream failures to sanitized service errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new Error('credential-in-network-error'))
        .mockResolvedValueOnce(
          new Response('credential-in-upstream-body', { status: 500 }),
        ),
    );
    await expect(
      service().authenticate('credential', false),
    ).rejects.toMatchObject({
      reason: 'network',
      message: 'Authentication service unavailable',
    });
    await expect(
      service().authenticate('credential', false),
    ).rejects.toBeInstanceOf(McpAuthenticationServiceError);
  });
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing test listener');
  return `http://127.0.0.1:${address.port}`;
}
const close = (server: Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );

describe('exchange redirect boundary', () => {
  it.each([307, 308])(
    'does not forward either credential across a %s redirect',
    async (status) => {
      let destinationRequests = 0;
      const destination = createServer((_req, res) => {
        destinationRequests++;
        res.end('{}');
      });
      const destinationUrl = await listen(destination);
      let exchangeRequests = 0;
      const redirector = createServer((req, res) => {
        exchangeRequests++;
        req.resume();
        res.writeHead(status, { Location: destinationUrl });
        res.end();
      });
      try {
        const exchangeUrl = await listen(redirector);
        const client = new RunditService(
          new ConfigService({
            ...settings,
            MCP_AUTH_EXCHANGE_URL: exchangeUrl,
          }),
        );
        await expect(
          client.authenticate('user-credential-fixture', false),
        ).rejects.toMatchObject({ reason: 'network' });
        expect(exchangeRequests).toBe(1);
        expect(destinationRequests).toBe(0);
      } finally {
        await close(redirector);
        await close(destination);
      }
    },
  );
});
