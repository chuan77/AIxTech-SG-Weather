import { describe, expect, it } from 'vitest';
import { parseAnalyticsMode } from './analyticsMode';

describe('parseAnalyticsMode', () => {
  it('reads the two literals the server writes', () => {
    expect(parseAnalyticsMode('measure')).toBe('measure');
    expect(parseAnalyticsMode('notice-only')).toBe('notice-only');
  });

  it('treats a missing tag, empty content or any other value as off', () => {
    for (const content of [null, undefined, '', 'on', 'off', 'MEASURE ', ' measure']) {
      expect(parseAnalyticsMode(content)).toBe('off');
    }
  });
});
