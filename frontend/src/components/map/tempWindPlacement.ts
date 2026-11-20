/**
 * Keeps temperature and wind labels out from under location pins (spec 015 follow-up). Pins stay
 * on top so they remain clickable; a label that would sit under one is nudged the shortest way
 * clear of every pin instead. All maths is in screen pixels for the current zoom.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Offset {
  dx: number;
  dy: number;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The pin's icon box (WeatherMap: 64x56, anchored at its bottom centre). */
export const PIN_BOX = { width: 64, height: 56 } as const;
/** Space left between a nudged label and the pin it clears. */
export const NUDGE_GAP_PX = 2;

function pinBox(pin: Point): Box {
  return {
    left: pin.x - PIN_BOX.width / 2,
    right: pin.x + PIN_BOX.width / 2,
    top: pin.y - PIN_BOX.height,
    bottom: pin.y,
  };
}

/** A label's box: centred on its station, then moved by the offset. */
function markBox(station: Point, size: { width: number; height: number }, offset: Offset): Box {
  const x = station.x + offset.dx;
  const y = station.y + offset.dy;
  return {
    left: x - size.width / 2,
    right: x + size.width / 2,
    top: y - size.height / 2,
    bottom: y + size.height / 2,
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * The shortest move that takes the label clear of every pin, or no move when nothing overlaps.
 * Candidates are the four moves that clear each overlapping pin (down, up, left, right); if none
 * clears them all, the one under the fewest pins wins, so the label is still as visible as it can be.
 */
export function nudgeOffPins(
  station: Point,
  size: { width: number; height: number },
  pins: readonly Point[],
): Offset {
  const pinBoxes = pins.map(pinBox);
  const hits = (offset: Offset) => {
    const box = markBox(station, size, offset);
    return pinBoxes.filter((pin) => overlaps(box, pin)).length;
  };
  const none = { dx: 0, dy: 0 };
  if (hits(none) === 0) return none;

  const base = markBox(station, size, none);
  const candidates: Offset[] = [];
  for (const pin of pinBoxes) {
    if (!overlaps(base, pin)) continue;
    candidates.push(
      { dx: 0, dy: pin.bottom + NUDGE_GAP_PX - base.top },
      { dx: 0, dy: pin.top - NUDGE_GAP_PX - base.bottom },
      { dx: pin.left - NUDGE_GAP_PX - base.right, dy: 0 },
      { dx: pin.right + NUDGE_GAP_PX - base.left, dy: 0 },
    );
  }

  let best = none;
  let bestHits = Infinity;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const count = hits(candidate);
    const distance = Math.hypot(candidate.dx, candidate.dy);
    if (count < bestHits || (count === bestHits && distance < bestDistance)) {
      best = candidate;
      bestHits = count;
      bestDistance = distance;
    }
  }
  return best;
}
