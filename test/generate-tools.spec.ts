import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error The generator helper is plain ESM JavaScript.
import { invokeExpr } from '../scripts/generate-invoke-expr.mjs';

type Operation = {
  ns: string;
  operation: string;
  pathParamNames: string[];
  hasBody: boolean;
  hasQuery: boolean;
};

const compile = (overrides: Partial<Operation>) => {
  const expression = invokeExpr({
    ns: 'metrics',
    operation: 'write',
    pathParamNames: [],
    hasBody: false,
    hasQuery: false,
    ...overrides,
  });

  return Function(`return ${expression}`)();
};

describe('generated SDK invocation', () => {
  it('passes template path identifiers separately from configuration', async () => {
    const updateEntry = vi.fn().mockResolvedValue({ id: 'entry' });
    const invoke = compile({ ns: 'metricTemplates', operation: 'updateEntry', pathParamNames: ['templateId', 'entryId'], hasBody: true });
    await invoke({ metricTemplates: { updateEntry } }, { templateId: 'template', entryId: 'entry', metricTypeId: 42, companyFilter: [{ type: 'all' }] });
    expect(updateEntry).toHaveBeenCalledWith('template', 'entry', { metricTypeId: 42, companyFilter: [{ type: 'all' }] });
  });

  it('invokes template deletion with both identifiers and no body', async () => {
    const deleteEntry = vi.fn().mockResolvedValue({ id: 'entry' });
    const invoke = compile({ ns: 'metricTemplates', operation: 'deleteEntry', pathParamNames: ['templateId', 'entryId'] });
    await invoke({ metricTemplates: { deleteEntry } }, { templateId: 'template', entryId: 'entry' });
    expect(deleteEntry).toHaveBeenCalledWith('template', 'entry');
  });
  it('separates path parameters from the request body', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const invoke = compile({ pathParamNames: ['id'], hasBody: true });

    await invoke({ metrics: { write } }, { id: 17, name: 'Acme', active: true });

    expect(write).toHaveBeenCalledWith(17, { name: 'Acme', active: true });
  });

  it('keeps body-only and path-plus-query calls unchanged', async () => {
    const bodyWrite = vi.fn().mockResolvedValue(undefined);
    const queryRead = vi.fn().mockResolvedValue(undefined);

    await compile({ hasBody: true })({ metrics: { write: bodyWrite } }, { value: 42 });
    await compile({
      operation: 'read',
      pathParamNames: ['id'],
      hasQuery: true,
    })({ metrics: { read: queryRead } }, { id: 17, limit: 10 });

    expect(bodyWrite).toHaveBeenCalledWith({ value: 42 });
    expect(queryRead).toHaveBeenCalledWith(17, { limit: 10 });
  });
});
