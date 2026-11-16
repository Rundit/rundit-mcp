import { describe, expect, it } from 'vitest';
import { withinInputLimits } from '../src/input-limits.js';

describe('input validation budget', () => {
  it('allows a full 10,000-point import', () => {
    const points = Array.from({ length: 10_000 }, () => ({
      date: '2026-01-01',
      actual: 1,
      forecast: 2,
      budget: 3,
    }));
    expect(
      withinInputLimits({
        companies: [{ companyId: 1, items: [{ metricTypeId: 2, points }] }],
      }),
    ).toBe(true);
  });
  it('stops oversized collections before allocating validation errors', () => {
    expect(withinInputLimits(Array(100_001).fill(null))).toBe(false);
  });
  it('bounds nesting independently of byte length', () => {
    let value: unknown = 1;
    for (let depth = 0; depth < 65; depth++) value = { nested: value };
    expect(withinInputLimits(value)).toBe(false);
  });
});
