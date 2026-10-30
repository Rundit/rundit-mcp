import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RunditClient } from '@rundit-sdk/client';

@Injectable()
export class RunditService {
  private readonly baseUrl?: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('RUNDIT_BASE_URL');
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
    const endpoint = this.config.get<string>('MCP_AUTH_EXCHANGE_URL');
    if (!endpoint) return { client: this.clientFor(credential) };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Rundit-Mcp-Secret': this.config.get<string>('OAUTH_SERVICE_SECRET') ?? '' },
      body: JSON.stringify({ credential, apiKey }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401) throw new McpAuthenticationError();
    if (!response.ok) throw new Error('Authentication service unavailable');
    const result = await response.json() as { apiKey?: boolean; delegation?: string; scopes: string[] };
    if (result.apiKey) return { client: this.clientFor(credential), scopes: result.scopes };
    if (!result.delegation) throw new Error('Invalid authentication service response');
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
