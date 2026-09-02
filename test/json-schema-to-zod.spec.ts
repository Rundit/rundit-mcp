import { describe, expect, it } from 'vitest';
import { schemaToZodShape } from '../src/rundit/json-schema-to-zod.js';

describe('schemaToZodShape', () => {
  it('returns an empty shape for non-object schemas', () => {
    expect(schemaToZodShape({ type: 'string' })).toEqual({});
    expect(schemaToZodShape({})).toEqual({});
  });

  it('makes properties optional unless listed in required', () => {
    const shape = schemaToZodShape({
      type: 'object',
      properties: {
        name: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['name'],
    });

    expect(shape.name.safeParse(undefined).success).toBe(false);
    expect(shape.name.safeParse('acme').success).toBe(true);
    expect(shape.limit.safeParse(undefined).success).toBe(true);
    expect(shape.limit.safeParse(10).success).toBe(true);
    expect(shape.limit.safeParse('10').success).toBe(false);
  });

  it('maps enums, booleans, arrays, and nested objects', () => {
    const shape = schemaToZodShape({
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['month', 'quarter', 'year'] },
        active: { type: 'boolean' },
        companyIds: { type: 'array', items: { type: 'number' } },
        filter: {
          type: 'object',
          properties: { search: { type: 'string' } },
        },
      },
      required: ['period', 'active', 'companyIds', 'filter'],
    });

    expect(shape.period.safeParse('quarter').success).toBe(true);
    expect(shape.period.safeParse('decade').success).toBe(false);
    expect(shape.active.safeParse(true).success).toBe(true);
    expect(shape.companyIds.safeParse([1, 2]).success).toBe(true);
    expect(shape.companyIds.safeParse(['1']).success).toBe(false);
    expect(shape.filter.safeParse({ search: 'x' }).success).toBe(true);
  });
});
