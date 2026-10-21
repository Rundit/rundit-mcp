import { describe, expect, it } from 'vitest';
import { isOlderVersion, releaseTarget } from '../scripts/sdk-release.mjs';

describe('SDK release routing', () => {
  it('routes exact versions to the matching deployment branch', () => {
    expect(releaseTarget('rc', '0.3.7-rc.24')).toBe('main');
    expect(releaseTarget('latest', '0.3.7')).toBe('production');
  });

  it.each([
    ['latest', '0.3.7-rc.24'], ['rc', '0.3.7'], ['other', '0.3.7'],
    ['rc', 'latest'], ['latest', '^0.3.7'], ['latest', '0.03.7'],
    ['rc', '0.3.7-rc.01'], ['rc', '0.3.7-beta.1'],
    ['latest', '0.3.7; echo unsafe'], ['latest', '0.3.7\n'],
  ])('rejects invalid release %s / %s', (channel, version) => {
    expect(() => releaseTarget(channel, version)).toThrow();
  });
});

describe('SDK release ordering', () => {
  it.each([
    ['0.3.7-rc.9', '0.3.7-rc.10', true],
    ['0.3.7-rc.10', '0.3.7-rc.9', false],
    ['0.3.7-rc.24', '0.3.7-rc.24', false],
    ['0.3.7', '0.3.7', false],
    ['0.3.6', '0.3.7', true],
    ['0.3.7-rc.24', '0.3.7', true],
    ['0.3.7', '0.3.7-rc.24', false],
    ['0.3.8-rc.1', '0.3.7', false],
    ['0.10.0', '0.9.99', false],
    ['1.0.0', '0.99.99', false],
  ])('compares %s with %s', (requested, current, older) => {
    expect(isOlderVersion(requested, current)).toBe(older);
  });
});
