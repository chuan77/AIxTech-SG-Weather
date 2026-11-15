import { describe, expect, it } from 'vitest';
import { heatReconcileLine } from './heatComfort';

describe('heatReconcileLine', () => {
  it('explains a hot feel against Low heat stress without giving advice', () => {
    const line = heatReconcileLine('scorching', 'Scorching', 'low', 'Low');
    expect(line).toMatch(/^Feels scorching, but heat stress is Low\./);
    expect(line).toMatch(/sun and wind/);
    expect(line).not.toMatch(/safe|fine|continue/i);
  });

  it('flags Moderate or High heat stress that feels mild', () => {
    expect(heatReconcileLine('warm', 'Warm', 'moderate', 'Moderate')).toMatch(
      /^Heat stress is Moderate even though it feels warm/,
    );
    expect(heatReconcileLine('breezy-cool', 'Breezy & Cool', 'high', 'High')).toMatch(
      /Follow the heat-stress advice\.$/,
    );
  });

  it('stays quiet when the two agree or a reading is missing', () => {
    expect(heatReconcileLine('hot-muggy', 'Hot & Muggy', 'moderate', 'Moderate')).toBeNull();
    expect(heatReconcileLine('warm', 'Warm', 'low', 'Low')).toBeNull();
    expect(heatReconcileLine(null, null, 'low', 'Low')).toBeNull();
    expect(heatReconcileLine('scorching', 'Scorching', 'unknown', null)).toBeNull();
  });

  it('uses the past tense for a stale reading', () => {
    expect(heatReconcileLine('hot-muggy', 'Hot & Muggy', 'low', 'Low', true)).toMatch(
      /^Felt hot & muggy, but heat stress was Low\./,
    );
  });
});
