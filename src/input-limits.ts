// Allow the SDK's 10,000-point imports, but bound validation work and nesting.
export const MAX_INPUT_ELEMENTS = 100_000;
const MAX_INPUT_DEPTH = 64;

/** Inspect parsed JSON before schema validation can allocate an error per item. */
export function withinInputLimits(value: unknown): boolean {
  let elements = 0;
  function visit(current: unknown, depth: number): boolean {
    if (++elements > MAX_INPUT_ELEMENTS || depth > MAX_INPUT_DEPTH)
      return false;
    if (current && typeof current === 'object') {
      for (const key in current) {
        if (
          Object.hasOwn(current, key) &&
          !visit((current as Record<string, unknown>)[key], depth + 1)
        )
          return false;
      }
    }
    return true;
  }
  return visit(value, 0);
}
