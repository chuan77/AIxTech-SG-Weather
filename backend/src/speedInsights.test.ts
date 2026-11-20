import { describe, expect, it } from 'vitest';
import { pageFor, visitLabel } from './speedInsights.js';

describe('visitLabel', () => {
  it('is cold while the instance is under 10 seconds old', () => {
    expect(visitLabel(0)).toBe('cold');
    expect(visitLabel(9.999)).toBe('cold');
  });

  it('is warm from 10 seconds on', () => {
    expect(visitLabel(10)).toBe('warm');
    expect(visitLabel(3600)).toBe('warm');
  });
});

describe('pageFor', () => {
  const pages = { cold: '<p>cold</p>', warm: '<p>warm</p>' };

  it('picks the page that matches the visit label', () => {
    expect(pageFor(pages, 2)).toBe(pages.cold);
    expect(pageFor(pages, 10)).toBe(pages.warm);
  });
});
