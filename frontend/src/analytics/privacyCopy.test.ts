import { describe, expect, it } from 'vitest';
import { privacyCopy } from './privacyCopy';

describe('privacyCopy', () => {
  it('shows no notice when nothing is measured', () => {
    expect(privacyCopy({ visits: false, speed: false })).toBeNull();
  });

  it('names only visit counting when only visits are counted', () => {
    const copy = privacyCopy({ visits: true, speed: false });
    expect(copy?.label).toBe('Anonymous visit counts · no cookies');
    expect(copy?.paragraphs.some((p) => p.includes('Web Analytics'))).toBe(true);
    expect(copy?.paragraphs.some((p) => p.includes('Speed Insights'))).toBe(false);
  });

  it('names only page speed when only speed is measured', () => {
    const copy = privacyCopy({ visits: false, speed: true });
    expect(copy?.label).toBe('Anonymous speed stats · no cookies');
    const speed = copy?.paragraphs.find((p) => p.includes('Speed Insights'));
    expect(speed).toMatch(/network speed/);
    expect(speed).toMatch(/slowest/);
    expect(copy?.paragraphs.some((p) => p.includes('Web Analytics'))).toBe(false);
  });

  it('names both, visits first, when both are measured', () => {
    const copy = privacyCopy({ visits: true, speed: true });
    expect(copy?.label).toBe('Anonymous visits & speed · no cookies');
    const visits = copy!.paragraphs.findIndex((p) => p.includes('Web Analytics'));
    const speed = copy!.paragraphs.findIndex((p) => p.includes('Speed Insights'));
    expect(visits).toBeGreaterThanOrEqual(0);
    expect(speed).toBeGreaterThan(visits);
  });

  it('always ends with what is never collected and how saved places are kept', () => {
    for (const modes of [
      { visits: true, speed: false },
      { visits: false, speed: true },
      { visits: true, speed: true },
    ]) {
      const paragraphs = privacyCopy(modes)!.paragraphs;
      const [shared, saved] = paragraphs.slice(-2);
      expect(shared).toMatch(/no cookies/);
      expect(shared).toMatch(/no account/);
      expect(shared).toMatch(/precise location/);
      expect(shared).toMatch(/saved places/);
      expect(saved).toMatch(/90 days/);
    }
  });
});
