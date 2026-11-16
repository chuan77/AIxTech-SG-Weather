import { describe, expect, it } from 'vitest';
import type { LightningStrike } from '../../types';
import {
  appearanceKey,
  buildStrikeIndex,
  diffMarks,
  formatGroupCount,
  GROUP_MAX_ZOOM,
  GROUP_MIN_POINTS,
  GROUP_RADIUS_PX,
  groupAgeLabel,
  groupListRows,
  groupSelectView,
  groupSizeBand,
  isSplittable,
  marksInView,
  type Bbox,
  type LightningMark,
} from './lightningGroups';
import { strikeStep } from './strikeMarker';

const NOW = Date.parse('2026-11-16T09:00:00Z');
const WORLD: Bbox = [103.0, 0.5, 105.0, 2.0];

function strike(minutesAgo: number, latitude: number, longitude: number): LightningStrike {
  const occurred_at = new Date(NOW - minutesAgo * 60_000).toISOString();
  return {
    id: `${occurred_at}|${latitude}|${longitude}`,
    latitude,
    longitude,
    occurred_at,
    type: 'C',
    label: 'Cloud to Cloud',
  };
}

describe('grouping options', () => {
  it('uses the planned radius, minimum size and deepest zoom', () => {
    expect(GROUP_RADIUS_PX).toBe(40);
    expect(GROUP_MIN_POINTS).toBe(2);
    expect(GROUP_MAX_ZOOM).toBe(20);
  });
});

describe('formatGroupCount', () => {
  it.each([
    [2, '2'],
    [999, '999'],
    [1000, '1k'],
    [1240, '1.2k'],
    [9950, '9.9k'],
    [10000, '10k'],
    [37242, '37k'],
  ])('%i reads %s', (count, label) => {
    expect(formatGroupCount(count)).toBe(label);
  });
});

describe('groupAgeLabel', () => {
  it.each([
    [0.4, 'now'],
    [2.5, '2m'],
    [59.9, '59m'],
    [-3, 'now'],
  ])('%f minutes old reads %s', (minutesAgo, label) => {
    expect(groupAgeLabel(NOW - minutesAgo * 60_000, NOW)).toBe(label);
  });

  it('treats an unreadable time as the oldest', () => {
    expect(groupAgeLabel(Number.NaN, NOW)).toBe('59m');
  });
});

describe('groupSizeBand and isSplittable', () => {
  it('bands counts under 100, under 1,000 and above', () => {
    expect(groupSizeBand(99)).toBe('small');
    expect(groupSizeBand(100)).toBe('medium');
    expect(groupSizeBand(999)).toBe('medium');
    expect(groupSizeBand(1000)).toBe('large');
  });

  it('splits only when the expansion zoom is reachable', () => {
    expect(isSplittable(20)).toBe(true);
    expect(isSplittable(21)).toBe(false);
  });
});

describe('marksInView', () => {
  it('groups strikes that crowd at the current zoom, carrying the newest time', () => {
    const near = [strike(30, 1.35, 103.82), strike(2, 1.35009, 103.82)]; // about 10 m apart
    const marks = marksInView(buildStrikeIndex(near, NOW), WORLD, 11, NOW);
    expect(marks).toHaveLength(1);
    const [group] = marks;
    expect(group.kind).toBe('group');
    if (group.kind !== 'group') return;
    expect(group.count).toBe(2);
    expect(group.countLabel).toBe('2');
    expect(group.newestAtMs).toBe(Date.parse(near[1].occurred_at));
    expect(group.step).toBe(strikeStep(near[1].occurred_at, NOW));
    expect(group.ageLabel).toBe('2m');
    expect(group.splittable).toBe(true);
    expect(group.key.startsWith('g:')).toBe(true);
    expect(group.key).toContain('@11');
  });

  it('keeps strikes at one exact spot as a group that cannot split at the deepest zoom', () => {
    const same = [strike(5, 1.3, 103.8), strike(6, 1.3, 103.8)];
    const marks = marksInView(buildStrikeIndex(same, NOW), WORLD, 20, NOW);
    expect(marks).toHaveLength(1);
    expect(marks[0].kind === 'group' && marks[0].splittable).toBe(false);
  });

  it('shows strikes far apart as single bolts keyed by strike id', () => {
    const apart = [strike(5, 1.3, 103.6), strike(40, 1.3, 104.05)]; // about 50 km apart
    const marks = marksInView(buildStrikeIndex(apart, NOW), WORLD, 11, NOW);
    expect(marks.map((mark) => mark.kind)).toEqual(['bolt', 'bolt']);
    expect(marks.map((mark) => mark.key).sort()).toEqual(apart.map((s) => `s:${s.id}`).sort());
  });

  it('leaves out strikes past the hour and unreadable times', () => {
    const old = strike(61, 1.3, 103.8);
    const broken = { ...strike(5, 1.31, 103.81), occurred_at: 'not a date' };
    const ok = strike(5, 1.45, 104.0);
    const index = buildStrikeIndex([old, broken, ok], NOW);
    expect([...index.strikeIds]).toEqual([ok.id]);
    expect(marksInView(index, WORLD, 11, NOW).map((mark) => mark.key)).toEqual([`s:${ok.id}`]);
  });

  it('only returns marks inside the box', () => {
    const marks = marksInView(
      buildStrikeIndex([strike(5, 1.3, 103.8)], NOW),
      [104.5, 1.6, 104.9, 1.9],
      11,
      NOW,
    );
    expect(marks).toEqual([]);
  });
});

describe('diffMarks', () => {
  const bolt = (id: string, step: number): LightningMark => ({
    kind: 'bolt',
    key: `s:${id}`,
    latitude: 1.3,
    longitude: 103.8,
    newestAtMs: NOW,
    step,
    strike: strike(0, 1.3, 103.8),
  });
  const group = (key: string, ageLabel: string): LightningMark => ({
    kind: 'group',
    key,
    groupId: 1,
    latitude: 1.3,
    longitude: 103.8,
    count: 5,
    countLabel: '5',
    sizeBand: 'small',
    newestAtMs: NOW,
    step: 0,
    ageLabel,
    expansionZoom: 14,
    splittable: true,
  });

  it('does nothing when keys and looks are unchanged', () => {
    const wanted = [bolt('a', 0), group('g:1', 'now')];
    const current = new Map(wanted.map((mark) => [mark.key, appearanceKey(mark)]));
    expect(diffMarks(current, wanted)).toEqual({ add: [], remove: [], restyle: [] });
  });

  it('adds new keys, removes missing ones and restyles changed looks', () => {
    const current = new Map([
      ['s:a', appearanceKey(bolt('a', 0))],
      ['s:gone', appearanceKey(bolt('gone', 0))],
      ['g:1', appearanceKey(group('g:1', 'now'))],
    ]);
    const wanted = [bolt('a', 1), group('g:1', '2m'), bolt('new', 0)];
    const diff = diffMarks(current, wanted);
    expect(diff.add.map((mark) => mark.key)).toEqual(['s:new']);
    expect(diff.remove).toEqual(['s:gone']);
    expect(diff.restyle.map((mark) => mark.key)).toEqual(['s:a', 'g:1']);
  });

  it('keys a bolt look by its step and a group look by step, count, age and size', () => {
    expect(appearanceKey(bolt('a', 3))).toBe('3');
    expect(appearanceKey(group('g:1', '2m'))).toBe('0|5|2m|small');
  });
});

describe('groupListRows', () => {
  const leaves = Array.from({ length: 25 }, (_, index) => strike(index, 1.3, 103.8));

  it('lists up to 20 strikes newest first, then how many more', () => {
    const rows = groupListRows(leaves, NOW, 25);
    expect(rows).toHaveLength(21);
    expect(rows[0]).toEqual({ title: 'Cloud to Cloud', time: '5:00 pm', relative: 'just now' });
    expect(rows[19]).toMatchObject({ relative: '19 min ago' });
    expect(rows[20]).toEqual({ more: 5 });
  });

  it('adds no "more" row when every strike is listed', () => {
    const rows = groupListRows(leaves.slice(0, 3), NOW, 3);
    expect(rows).toHaveLength(3);
    expect(rows.some((row) => 'more' in row)).toBe(false);
  });
});

describe('groupSelectView', () => {
  it('zooms to where the group splits', () => {
    expect(groupSelectView([1.3, 103.8], 14)).toEqual({ center: [1.3, 103.8], zoom: 14 });
    expect(groupSelectView([1.3, 103.8], 20)).toEqual({ center: [1.3, 103.8], zoom: 20 });
  });

  it('has nowhere to zoom when the group cannot split on this map', () => {
    expect(groupSelectView([1.3, 103.8], 21)).toBeNull();
  });
});

describe('normal days stay single bolts (FR-007, SC-006)', () => {
  /** A busy-day window like LIGHTNING_FIXTURE=busy: 370 strikes spread over the region and the hour. */
  function busyDay(): LightningStrike[] {
    let state = 20261112;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
    return Array.from({ length: 370 }, (_, index) =>
      strike((index / 370) * 59, 0.8 + random() * 1.1, 103.2 + random() * 1.4),
    );
  }

  function boltShare(strikes: LightningStrike[], zoom: number): number {
    const marks = marksInView(buildStrikeIndex(strikes, NOW), WORLD, zoom, NOW);
    return marks.filter((mark) => mark.kind === 'bolt').length / strikes.length;
  }

  it('shows most of a busy day as single bolts at the default zoom, and nearly all one step in', () => {
    expect(boltShare(busyDay(), 11)).toBeGreaterThanOrEqual(0.8);
    expect(boltShare(busyDay(), 12)).toBeGreaterThanOrEqual(0.9);
  });

  it('shows the three demo strikes as three bolts', () => {
    const demo = [strike(2, 1.3521, 103.8198), strike(30, 1.3, 103.85), strike(55, 1.4, 103.75)];
    const marks = marksInView(buildStrikeIndex(demo, NOW), WORLD, 11, NOW);
    expect(marks.map((mark) => mark.kind)).toEqual(['bolt', 'bolt', 'bolt']);
  });
});
