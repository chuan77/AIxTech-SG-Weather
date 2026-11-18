import { describe, expect, it } from 'vitest';
import {
  HEADER,
  SPOTS,
  buildRow,
  distanceKm,
  nearestRain,
  parseRain,
  parseTaxis,
  taxisNear,
} from './taxi-rain-sample.mjs';

const raffles = SPOTS.find((s) => s.id === 'raffles');

describe('taxi-rain sample', () => {
  it('measures distance in km', () => {
    expect(distanceKm(1.284, 103.851, 1.284, 103.851)).toBe(0);
    // 0.01 degree of latitude is about 1.11 km
    expect(distanceKm(1.284, 103.851, 1.294, 103.851)).toBeCloseTo(1.11, 2);
  });

  it('parses the taxi feed and counts taxis within 1 km of a spot', () => {
    const taxis = parseTaxis({
      features: [
        {
          geometry: {
            type: 'MultiPoint',
            coordinates: [
              [103.851, 1.284], // at the spot
              [103.851, 1.292], // ~0.9 km
              [103.851, 1.294], // ~1.1 km: outside
              ['x', 1.284], // malformed: dropped
            ],
          },
          properties: { timestamp: '2026-11-18T21:19:39+08:00', taxi_count: 3 },
        },
      ],
    });
    expect(taxis.total).toBe(3);
    expect(taxis.points).toHaveLength(3);
    expect(taxisNear(taxis.points, raffles)).toBe(2);
  });

  it('rejects a taxi feed without coordinates', () => {
    expect(() => parseTaxis({ features: [] })).toThrow('taxi: no coordinates');
  });

  it('keeps only rain stations that reported, joined on stationId', () => {
    const rain = parseRain({
      data: {
        stations: [
          { id: 'S1', location: { latitude: 1.285, longitude: 103.851 } },
          { id: 'S2', location: { latitude: 1.4, longitude: 103.8 } },
          { id: 'S3', location: { latitude: 1.3, longitude: 103.9 } },
        ],
        readings: [
          {
            timestamp: '2026-11-18T21:15:00+08:00',
            data: [
              { stationId: 'S2', value: 1.2 },
              { stationId: 'S1', value: 0 },
              { stationId: 'S3', value: null },
            ],
          },
        ],
      },
    });
    expect(rain.stations.map((s) => s.id)).toEqual(['S1', 'S2']);
    expect(nearestRain(rain.stations, raffles)).toMatchObject({ mm: 0 });
  });

  it('builds a row that lines up with the header, leaving a failed source empty', () => {
    const row = buildRow('2026-11-18T13:20:00.000Z', null, null, ['taxi: HTTP 500', 'rain: x, y']);
    expect(row).toHaveLength(HEADER.length);
    expect(row[2]).toBe('');
    expect(row.at(-1)).toBe('"taxi: HTTP 500; rain: x, y"');
  });
});
