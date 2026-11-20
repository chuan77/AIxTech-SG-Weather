import { describe, expect, it } from 'vitest';
import { parseSpeedInsightsMode, routeForVisit } from './speedInsightsMode';

describe('parseSpeedInsightsMode', () => {
  it('reads the two literals the server writes', () => {
    expect(parseSpeedInsightsMode('measure')).toBe('measure');
    expect(parseSpeedInsightsMode('notice-only')).toBe('notice-only');
  });

  it('treats a missing tag, empty content or any other value as off', () => {
    for (const content of [null, undefined, '', 'on', 'off', 'MEASURE ', ' measure']) {
      expect(parseSpeedInsightsMode(content)).toBe('off');
    }
  });
});

describe('routeForVisit', () => {
  it('turns the two labels the server writes into routes', () => {
    expect(routeForVisit('cold')).toBe('/cold');
    expect(routeForVisit('warm')).toBe('/warm');
  });

  it('gives no route for anything other than cold or warm', () => {
    for (const content of [null, undefined, '', 'COLD', 'hot', ' warm']) {
      expect(routeForVisit(content)).toBeUndefined();
    }
  });
});
