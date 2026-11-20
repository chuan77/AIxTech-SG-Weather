import { describe, expect, it } from 'vitest';
import { NUDGE_GAP_PX, PIN_BOX, nudgeOffPins } from './tempWindPlacement';

const SIZE = { width: 64, height: 26 };

describe('nudgeOffPins', () => {
  it('leaves a label alone when no pin is near', () => {
    expect(nudgeOffPins({ x: 0, y: 0 }, SIZE, [{ x: 300, y: 300 }])).toEqual({ dx: 0, dy: 0 });
    expect(nudgeOffPins({ x: 0, y: 0 }, SIZE, [])).toEqual({ dx: 0, dy: 0 });
  });

  it('moves a label under a pin the shortest way clear of it', () => {
    // The pin's box is 56 px tall above its point; a station just above that point is nearest
    // the pin's bottom edge, so the label drops below the pin.
    const station = { x: 0, y: -10 };
    const pin = { x: 0, y: 0 };
    const offset = nudgeOffPins(station, SIZE, [pin]);
    expect(offset.dx).toBe(0);
    expect(station.y + offset.dy - SIZE.height / 2).toBe(pin.y + NUDGE_GAP_PX);
  });

  it('moves sideways when that is shorter', () => {
    const station = { x: 50, y: -PIN_BOX.height / 2 };
    const offset = nudgeOffPins(station, SIZE, [{ x: 0, y: 0 }]);
    expect(offset.dy).toBe(0);
    expect(station.x + offset.dx - SIZE.width / 2).toBe(PIN_BOX.width / 2 + NUDGE_GAP_PX);
  });

  it('never moves a label from one pin onto another', () => {
    // A second pin sits right where "below the first pin" would land.
    const station = { x: 0, y: -10 };
    const pins = [
      { x: 0, y: 0 },
      { x: 0, y: 60 },
    ];
    const offset = nudgeOffPins(station, SIZE, pins);
    const moved = { x: station.x + offset.dx, y: station.y + offset.dy };
    for (const pin of pins) {
      const clear =
        moved.x + SIZE.width / 2 <= pin.x - PIN_BOX.width / 2 ||
        moved.x - SIZE.width / 2 >= pin.x + PIN_BOX.width / 2 ||
        moved.y + SIZE.height / 2 <= pin.y - PIN_BOX.height ||
        moved.y - SIZE.height / 2 >= pin.y;
      expect(clear).toBe(true);
    }
  });

  it('treats touching edges as clear', () => {
    const station = { x: 0, y: SIZE.height / 2 };
    expect(nudgeOffPins(station, SIZE, [{ x: 0, y: 0 }])).toEqual({ dx: 0, dy: 0 });
  });
});
