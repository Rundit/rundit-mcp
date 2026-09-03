import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error The generator helper is plain ESM JavaScript.
import { invokeExpr } from '../scripts/generate-invoke-expr.mjs';

type Operation = {
  ns: string;
  operation: string;
  pathParamNames: string[];
  queryParamNames: string[];
  hasBody: boolean;
  hasQuery: boolean;
};

const compile = (overrides: Partial<Operation>) => {
  const expression = invokeExpr({
    ns: 'metrics',
    operation: 'write',
    pathParamNames: [],
    queryParamNames: [],
    hasBody: false,
    hasQuery: false,
    ...overrides,
  });

  return Function(`return ${expression}`)();
};

describe('generated SDK invocation', () => {
  it('separates path parameters from the request body', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const invoke = compile({ pathParamNames: ['id'], hasBody: true });

    await invoke({ metrics: { write } }, { id: 17, name: 'Acme', active: true });

    expect(write).toHaveBeenCalledWith(17, { name: 'Acme', active: true });
  });

  it('passes path, body, and query arguments in SDK order', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const invoke = compile({
      pathParamNames: ['companyId', 'metricId'],
      queryParamNames: ['dryRun'],
      hasBody: true,
      hasQuery: true,
    });

    await invoke(
      { metrics: { write } },
      { companyId: 2, metricId: 17, dryRun: true, value: 42 },
    );

    expect(write).toHaveBeenCalledWith(2, 17, { value: 42 }, { dryRun: true });
  });

  it('keeps body-only and path-plus-query calls unchanged', async () => {
    const bodyWrite = vi.fn().mockResolvedValue(undefined);
    const queryRead = vi.fn().mockResolvedValue(undefined);

    await compile({ hasBody: true })({ metrics: { write: bodyWrite } }, { value: 42 });
    await compile({
      operation: 'read',
      pathParamNames: ['id'],
      queryParamNames: ['limit'],
      hasQuery: true,
    })({ metrics: { read: queryRead } }, { id: 17, limit: 10 });

    expect(bodyWrite).toHaveBeenCalledWith({ value: 42 });
    expect(queryRead).toHaveBeenCalledWith(17, { limit: 10 });
  });
});
