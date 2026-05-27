import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RunditClient } from '@rundit-sdk/client';

@Injectable()
export class RunditService {
  readonly client: RunditClient;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RUNDIT_API_KEY');
    if (!apiKey) {
      throw new Error(
        'RUNDIT_API_KEY env var is required (pass with `docker run -e RUNDIT_API_KEY=...`)',
      );
    }
    const baseUrl = config.get<string>('RUNDIT_BASE_URL');
    this.client = createClient(baseUrl ? { apiKey, baseUrl } : { apiKey });
  }
}
