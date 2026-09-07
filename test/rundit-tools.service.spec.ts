import { describe, expect, it } from 'vitest';
import { safeCall } from '../src/rundit/rundit-tools.service.js';

describe('safeCall', () => {
  it('returns valid MCP text content for void SDK responses', async () => {
    await expect(safeCall(async () => undefined)).resolves.toEqual({
      content: [{ type: 'text', text: 'null' }],
    });
  });
});
