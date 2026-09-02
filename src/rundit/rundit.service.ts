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
   * per request: the key comes from the caller's headers and is never
   * validated here — rundit-back authenticates every upstream call.
   */
  clientFor(apiKey: string): RunditClient {
    return createClient(
      this.baseUrl ? { apiKey, baseUrl: this.baseUrl } : { apiKey },
    );
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
