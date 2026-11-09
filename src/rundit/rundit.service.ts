import { z } from 'zod';
import { readOAuthConfig, type OAuthConfig } from '../oauth-config.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RunditClient } from '@rundit-sdk/client';

const exchangeResponse = z.union([
  z.object({ apiKey: z.literal(true), scopes: z.array(z.string().min(1)) }).strict(),
  z.object({ delegation: z.string().min(1), scopes: z.array(z.string().min(1)) }).strict(),
]);

@Injectable()
export class RunditService {
  private readonly baseUrl?: string;
  readonly oauth: OAuthConfig | undefined;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('RUNDIT_BASE_URL');
    this.oauth = readOAuthConfig(key => config.get<string>(key));
  }

  /**
   * Builds an SDK client bound to the given API key. In http mode this runs
   * per request. The backend authenticates every upstream call.
   */
  clientFor(apiKey: string): RunditClient {
    return createClient(
      this.baseUrl ? { apiKey, baseUrl: this.baseUrl } : { apiKey },
    );
  }

  async authenticate(credential: string, apiKey: boolean): Promise<{ client: RunditClient; scopes?: string[] }> {
    if (!this.oauth) return { client: this.clientFor(credential) };
    let response: Response;
    try {
      response = await fetch(this.oauth.exchangeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Rundit-Mcp-Secret': this.oauth.exchangeSecret },
        body: JSON.stringify({ credential, apiKey }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new McpAuthenticationServiceError('network');
    }
    if (response.status === 401) throw new McpAuthenticationError();
    if (!response.ok) throw new McpAuthenticationServiceError(response.status === 403 ? 'service-credential' : 'upstream');
    let data: unknown;
    try { data = await response.json(); } catch { throw new McpAuthenticationServiceError('response'); }
    const parsed = exchangeResponse.safeParse(data);
    if (!parsed.success) throw new McpAuthenticationServiceError('response');
    const result = parsed.data;
    if ('apiKey' in result) return { client: this.clientFor(credential), scopes: result.scopes };
    return { client: createClient({ mcpDelegation: result.delegation, baseUrl: this.baseUrl }), scopes: result.scopes };
  }

  /** stdio mode only: a single client bound to the RUNDIT_API_KEY env var. */
  defaultClient(): RunditClient {
    const apiKey = this.config.get<string>('RUNDIT_API_KEY');
    if (!apiKey) {
      throw new Error(
        'RUNDIT_API_KEY env var is required in stdio mode (pass with `docker run -e RUNDIT_API_KEY=...`)',
      );
    }
    return this.clientFor(apiKey);
  }
}

export class McpAuthenticationError extends Error {}

/** Fixed categories keep upstream response bodies, URLs and credentials out of logs. */
export class McpAuthenticationServiceError extends Error {
  constructor(readonly reason: 'network' | 'service-credential' | 'upstream' | 'response') {
    super('Authentication service unavailable');
  }
}
