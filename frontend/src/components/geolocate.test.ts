import { describe, expect, it } from 'vitest';
import type { Location } from '../types';
import {
  classifyPosition,
  failureReason,
  geolocateLogPayload,
  geolocateMessage,
  isUntestedBrowser,
  UNTESTED_BROWSER_HINT,
  SINGAPORE_BOUNDS,
} from './geolocate';

const at = (id: number, latitude: number, longitude: number) =>
  ({ id, latitude, longitude, weather: { area: `Place ${id}` } }) as unknown as Location;

// 0.001° of latitude is about 111 m.
const BISHAN = { latitude: 1.3508, longitude: 103.839 };

describe('classifyPosition', () => {
  it('adds a new place inside Singapore when nothing is saved', () => {
    expect(classifyPosition(BISHAN, [])).toEqual({ kind: 'new', ...BISHAN });
  });

  it('passes the position through unrounded', () => {
    const precise = { latitude: 1.35081234, longitude: 103.83901234 };
    expect(classifyPosition(precise, [])).toEqual({ kind: 'new', ...precise });
  });

  it('treats each box edge as inside and just beyond it as outside', () => {
    const { minLat, maxLat, minLon, maxLon } = SINGAPORE_BOUNDS;
    const mid = { latitude: 1.35, longitude: 103.85 };
    for (const latitude of [minLat, maxLat]) {
      expect(classifyPosition({ ...mid, latitude }, []).kind).toBe('new');
    }
    for (const longitude of [minLon, maxLon]) {
      expect(classifyPosition({ ...mid, longitude }, []).kind).toBe('new');
    }
    expect(classifyPosition({ ...mid, latitude: minLat - 0.001 }, []).kind).toBe('outside');
    expect(classifyPosition({ ...mid, latitude: maxLat + 0.001 }, []).kind).toBe('outside');
    expect(classifyPosition({ ...mid, longitude: minLon - 0.001 }, []).kind).toBe('outside');
    expect(classifyPosition({ ...mid, longitude: maxLon + 0.001 }, []).kind).toBe('outside');
  });

  it('reports Kuala Lumpur as outside', () => {
    expect(classifyPosition({ latitude: 3.139, longitude: 101.687 }, [])).toEqual({
      kind: 'outside',
    });
  });

  it('selects a saved place at the same point', () => {
    const saved = [at(1, BISHAN.latitude, BISHAN.longitude)];
    expect(classifyPosition(BISHAN, saved)).toEqual({ kind: 'existing', location: saved[0] });
  });

  it('selects a saved place about 60 m away', () => {
    const saved = [at(1, BISHAN.latitude + 0.00054, BISHAN.longitude)];
    expect(classifyPosition(BISHAN, saved).kind).toBe('existing');
  });

  it('adds a new place when the nearest saved one is about 150 m away', () => {
    const saved = [at(1, BISHAN.latitude + 0.00135, BISHAN.longitude)];
    expect(classifyPosition(BISHAN, saved).kind).toBe('new');
  });

  it('selects the closest of several saved places in range', () => {
    const far = at(1, BISHAN.latitude + 0.0007, BISHAN.longitude);
    const near = at(2, BISHAN.latitude + 0.0002, BISHAN.longitude);
    const result = classifyPosition(BISHAN, [far, near]);
    expect(result).toEqual({ kind: 'existing', location: near });
  });

  it('checks bounds before the saved list', () => {
    const outsidePoint = { latitude: 1.501, longitude: 103.85 };
    const saved = [at(1, 1.5, 103.85)]; // ~110 m away, but the position is outside the box
    expect(classifyPosition(outsidePoint, saved)).toEqual({ kind: 'outside' });
  });
});

describe('failureReason', () => {
  it('maps GeolocationPositionError codes', () => {
    expect(failureReason(1)).toBe('denied');
    expect(failureReason(2)).toBe('unavailable');
    expect(failureReason(3)).toBe('timeout');
  });

  it('treats anything else as unavailable', () => {
    expect(failureReason(undefined)).toBe('unavailable');
    expect(failureReason(99)).toBe('unavailable');
  });
});

describe('geolocateMessage', () => {
  const failures = (['denied', 'unavailable', 'timeout'] as const).map((reason) =>
    geolocateMessage({ kind: 'failure', reason }),
  );

  it('gives every failure an error tone and a next step', () => {
    for (const message of failures) {
      expect(message.tone).toBe('error');
      expect(message.text).toMatch(/try again|allow|instead/i);
    }
  });

  it('gives each failure its own wording', () => {
    expect(new Set(failures.map((m) => m.text)).size).toBe(3);
    expect(failures[0].text).toMatch(/blocked/i);
  });

  it('adds the untested-browser hint only after a real failure, never for a denial', () => {
    const unavailable = geolocateMessage({ kind: 'failure', reason: 'unavailable', untestedBrowser: true });
    const timeout = geolocateMessage({ kind: 'failure', reason: 'timeout', untestedBrowser: true });
    const denied = geolocateMessage({ kind: 'failure', reason: 'denied', untestedBrowser: true });
    expect(unavailable.text).toContain(UNTESTED_BROWSER_HINT);
    expect(timeout.text).toContain(UNTESTED_BROWSER_HINT);
    expect(denied.text).not.toContain(UNTESTED_BROWSER_HINT);
    expect(failures.every((m) => !m.text.includes(UNTESTED_BROWSER_HINT))).toBe(true);
  });

  it('explains outside Singapore and failed adds as errors', () => {
    const outside = geolocateMessage({ kind: 'outside' });
    expect(outside.tone).toBe('error');
    expect(outside.text).toMatch(/outside Singapore/);

    const failed = geolocateMessage({ kind: 'create-failed', detail: 'Server unavailable' });
    expect(failed.tone).toBe('error');
    expect(failed.text).toBe('Couldn’t add your location. Server unavailable.');
  });

  it('names the place it selected instead of adding', () => {
    expect(geolocateMessage({ kind: 'existing', area: 'Bishan' })).toEqual({
      tone: 'info',
      text: 'Already saved: Bishan',
    });
  });
});

describe('isUntestedBrowser', () => {
  const ua = {
    chromeMac:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
    chromeWin:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0',
    opera:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 OPR/120.0.0.0',
    chromeIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/157.0.0.0 Mobile/15E148 Safari/604.1',
    firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:145.0) Gecko/20100101 Firefox/145.0',
    firefoxIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/145.0 Mobile/15E148 Safari/605.1.15',
    safariMac:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
    safariIos:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
  };

  it('stays quiet on Chromium browsers', () => {
    for (const agent of [ua.chromeMac, ua.chromeWin, ua.edge, ua.opera, ua.chromeIos]) {
      expect(isUntestedBrowser(agent)).toBe(false);
    }
  });

  it('flags Firefox and Safari', () => {
    for (const agent of [ua.firefox, ua.firefoxIos, ua.safariMac, ua.safariIos]) {
      expect(isUntestedBrowser(agent)).toBe(true);
    }
  });

  it('says nothing when the agent is unknown', () => {
    expect(isUntestedBrowser('')).toBe(false);
  });
});

describe('geolocateLogPayload', () => {
  const outcomes = [
    'success',
    'already-saved',
    'denied',
    'unavailable',
    'timeout',
    'outside',
    'create-failed',
  ] as const;

  it('never carries a position', () => {
    for (const outcome of outcomes) {
      for (const payload of [
        geolocateLogPayload(outcome),
        geolocateLogPayload(outcome, 'Bishan'),
      ]) {
        for (const key of Object.keys(payload)) {
          expect(key).not.toMatch(/lat|lon|coord|position/i);
        }
      }
    }
  });

  it('records the outcome and the area', () => {
    expect(geolocateLogPayload('success', 'Bishan')).toEqual({
      outcome: 'success',
      area: 'Bishan',
    });
    expect(geolocateLogPayload('denied')).toEqual({ outcome: 'denied' });
  });
});
