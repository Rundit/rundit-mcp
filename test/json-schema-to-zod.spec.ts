import { describe, expect, it } from 'vitest';
import { schemaToZodShape } from '../src/rundit/json-schema-to-zod.js';

describe('schemaToZodShape', () => {
  it('enforces inclusive numeric bounds and integer values', () => {
    const shape = schemaToZodShape({ type: 'object', properties: {
      count: { type: 'integer', minimum: 0, maximum: 2 },
      amount: { type: 'number', minimum: 0, maximum: 2 },
    }, required: ['count', 'amount'] });
    for (const value of [0, 2]) expect(shape.count.safeParse(value).success).toBe(true);
    for (const value of [-1, 3, 0.5]) expect(shape.count.safeParse(value).success).toBe(false);
    expect(shape.amount.safeParse(0.5).success).toBe(true);
    for (const value of [-0.1, 2.1]) expect(shape.amount.safeParse(value).success).toBe(false);
  });

  it('enforces string length and pattern even when an enum is present', () => {
    const shape = schemaToZodShape({ type: 'object', properties: {
      code: { type: 'string', minLength: 2, maxLength: 3, pattern: '^[A-Z]+$' },
      choice: { type: 'string', enum: ['A', 'AB', 'abcd', 'ABCD'], minLength: 2, maxLength: 3, pattern: '^[A-Z]+$' },
    }, required: ['code', 'choice'] });
    for (const value of ['AB', 'ABC']) expect(shape.code.safeParse(value).success).toBe(true);
    for (const value of ['A', 'ABCD', 'ab']) expect(shape.code.safeParse(value).success).toBe(false);
    expect(shape.choice.safeParse('AB').success).toBe(true);
    for (const value of ['A', 'abcd', 'ABCD', 'AC']) expect(shape.choice.safeParse(value).success).toBe(false);
  });

  it('enforces nested array limits without losing false, zero or null', () => {
    const shape = schemaToZodShape({ type: 'object', properties: {
      items: { type: 'array', minItems: 1, maxItems: 2, items: {
        type: 'object', properties: {
          active: { type: 'boolean' },
          values: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'number', nullable: true } },
        }, required: ['active', 'values'],
      } },
    }, required: ['items'] });
    const item = { active: false, values: [0, null] };
    expect(shape.items.parse([item])).toEqual([item]);
    expect(shape.items.safeParse([item, item]).success).toBe(true);
    for (const value of [[], [item, item, item], [{ ...item, values: [] }], [{ ...item, values: [0, 1, 2] }], [{ values: [0] }]]) {
      expect(shape.items.safeParse(value).success).toBe(false);
    }
  });

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

  it('accepts null for nullable properties without making them optional', () => {
    const shape = schemaToZodShape({
      type: 'object',
      properties: {
        value: { type: 'number', nullable: true },
      },
      required: ['value'],
    });

    expect(shape.value.safeParse(null).success).toBe(true);
    expect(shape.value.safeParse(42).success).toBe(true);
    expect(shape.value.safeParse(undefined).success).toBe(false);
  });
});
