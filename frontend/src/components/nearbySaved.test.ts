import { describe, expect, it } from 'vitest';
import type { Location } from '../types';
import { savedNear } from './nearbySaved';

const at = (id: number, latitude: number, longitude: number) =>
  ({ id, latitude, longitude }) as unknown as Location;

describe('savedNear', () => {
  const saved = [at(1, 1.375, 103.839), at(2, 1.3294, 103.8021)];

  it('finds a saved place at the same point', () => {
    expect(savedNear(saved, 1.3294, 103.8021)?.id).toBe(2);
  });

  it('finds one within about 200 m', () => {
    // ~110 m north of id 2
    expect(savedNear(saved, 1.3304, 103.8021)?.id).toBe(2);
  });

  it('ignores places further away', () => {
    // ~1.1 km north of id 2
    expect(savedNear(saved, 1.3394, 103.8021)).toBeNull();
    expect(savedNear([], 1.3294, 103.8021)).toBeNull();
  });

  it('picks the closest when several are in range', () => {
    const close = [at(3, 1.3296, 103.8021), at(4, 1.3294, 103.8022)];
    expect(savedNear(close, 1.3294, 103.80215)?.id).toBe(4);
  });
});
