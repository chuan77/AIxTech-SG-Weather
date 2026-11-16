/**
 * Lightning strike grouping (spec 009). Strikes that crowd together at the current zoom become one
 * group mark; the rest stay single bolts. Pure: no Leaflet or DOM, so it is tested in node.
 *
 * Why it exists: Leaflet's cost of adding markers grows with the square of their count, so one
 * marker per strike froze the page for 15 s at 37,242 strikes. Grouping bounds what is drawn by the
 * view, not by the storm.
 */
import Supercluster, { type PointFeature } from 'supercluster';
import type { LightningStrike } from '../../types';
import { formatStrikePopup, visibleStrikes } from './lightningHelpers';
import { strikeStep } from './strikeMarker';

/** Strikes closer than this on screen share one mark. */
export const GROUP_RADIUS_PX = 40;
export const GROUP_MIN_POINTS = 2;
/** The map's deepest zoom: groups still form here, so strikes at one spot stay one mark. */
export const GROUP_MAX_ZOOM = 20;

const MINUTE_MS = 60_000;
const MAX_AGE_MINUTES = 59;

/** [west, south, east, north] in degrees. */
export type Bbox = [number, number, number, number];
export type SizeBand = 'small' | 'medium' | 'large';

type PointProps = { id: string; occurredAtMs: number };
type GroupProps = { newest: number };

export interface StrikeIndex {
  index: Supercluster<PointProps, GroupProps>;
  /** Ids of the strikes indexed (in the window at build time); a change means rebuild. */
  strikeIds: Set<string>;
  strikesById: Map<string, LightningStrike>;
}

export interface GroupMark {
  kind: 'group';
  key: string;
  groupId: number;
  latitude: number;
  longitude: number;
  count: number;
  countLabel: string;
  sizeBand: SizeBand;
  newestAtMs: number;
  step: number;
  ageLabel: string;
  expansionZoom: number;
  splittable: boolean;
}

export interface BoltMark {
  kind: 'bolt';
  key: string;
  latitude: number;
  longitude: number;
  newestAtMs: number;
  step: number;
  strike: LightningStrike;
}

export type LightningMark = GroupMark | BoltMark;

export interface MarkDiff {
  add: LightningMark[];
  remove: string[];
  restyle: LightningMark[];
}

/** "2" … "999", then "1k", "1.2k" … "9.9k" (truncated, never rounded up), then "10k", "37k". */
export function formatGroupCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 10_000) {
    const tenths = Math.floor(count / 100) / 10;
    return `${Number.isInteger(tenths) ? tenths.toFixed(0) : tenths.toFixed(1)}k`;
  }
  return `${Math.floor(count / 1000)}k`;
}

/** Age of the newest strike: "now" under a minute, else whole minutes up to "59m". */
export function groupAgeLabel(newestAtMs: number, now: number): string {
  if (!Number.isFinite(newestAtMs)) return `${MAX_AGE_MINUTES}m`;
  const minutes = Math.floor(Math.max(0, now - newestAtMs) / MINUTE_MS);
  return minutes < 1 ? 'now' : `${Math.min(MAX_AGE_MINUTES, minutes)}m`;
}

export function groupSizeBand(count: number): SizeBand {
  if (count < 100) return 'small';
  return count < 1000 ? 'medium' : 'large';
}

/** A group splits on zooming in only if the zoom it needs exists on the map. */
export function isSplittable(expansionZoom: number): boolean {
  return expansionZoom <= GROUP_MAX_ZOOM;
}

/** Indexes the strikes inside the last hour (unreadable times are left out, as on the map today). */
export function buildStrikeIndex(strikes: LightningStrike[], now: number): StrikeIndex {
  const inWindow = visibleStrikes(strikes, now);
  const strikesById = new Map<string, LightningStrike>();
  const points: PointFeature<PointProps>[] = [];
  for (const strike of inWindow) {
    if (strikesById.has(strike.id)) continue;
    strikesById.set(strike.id, strike);
    points.push({
      type: 'Feature',
      properties: { id: strike.id, occurredAtMs: Date.parse(strike.occurred_at) },
      geometry: { type: 'Point', coordinates: [strike.longitude, strike.latitude] },
    });
  }
  const index = new Supercluster<PointProps, GroupProps>({
    radius: GROUP_RADIUS_PX,
    minPoints: GROUP_MIN_POINTS,
    minZoom: 0,
    maxZoom: GROUP_MAX_ZOOM,
    map: (props) => ({ newest: props.occurredAtMs }),
    reduce: (accumulated, props) => {
      if (props.newest > accumulated.newest) accumulated.newest = props.newest;
    },
  }).load(points);
  return { index, strikeIds: new Set(strikesById.keys()), strikesById };
}

/** The ids of the strikes that should be indexed now; differs from `strikeIds` when some aged out. */
export function inWindowIds(strikes: LightningStrike[], now: number): Set<string> {
  return new Set(visibleStrikes(strikes, now).map((strike) => strike.id));
}

export function sameIds(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/** What to draw for this box and zoom: group marks where strikes crowd, single bolts elsewhere. */
export function marksInView(
  { index, strikesById }: StrikeIndex,
  bbox: Bbox,
  zoom: number,
  now: number,
): LightningMark[] {
  const marks: LightningMark[] = [];
  for (const feature of index.getClusters(bbox, zoom)) {
    const [longitude, latitude] = feature.geometry.coordinates;
    const props = feature.properties;
    if ('cluster' in props && props.cluster) {
      const expansionZoom = index.getClusterExpansionZoom(props.cluster_id);
      const newestAtMs = props.newest;
      marks.push({
        kind: 'group',
        // The position is part of the key: ids repeat across rebuilds, positions of unchanged groups do not move.
        key: `g:${props.cluster_id}@${zoom}:${latitude.toFixed(6)},${longitude.toFixed(6)}`,
        groupId: props.cluster_id,
        latitude,
        longitude,
        count: props.point_count,
        countLabel: formatGroupCount(props.point_count),
        sizeBand: groupSizeBand(props.point_count),
        newestAtMs,
        step: strikeStep(new Date(newestAtMs).toISOString(), now),
        ageLabel: groupAgeLabel(newestAtMs, now),
        expansionZoom,
        splittable: isSplittable(expansionZoom),
      });
      continue;
    }
    const strike = strikesById.get((props as PointProps).id);
    if (!strike) continue;
    marks.push({
      kind: 'bolt',
      key: `s:${strike.id}`,
      latitude,
      longitude,
      newestAtMs: (props as PointProps).occurredAtMs,
      step: strikeStep(strike.occurred_at, now),
      strike,
    });
  }
  return marks;
}

/** What makes two marks look different; a mark whose key and look are unchanged is left alone. */
export function appearanceKey(mark: LightningMark): string {
  return mark.kind === 'bolt'
    ? String(mark.step)
    : `${mark.step}|${mark.countLabel}|${mark.ageLabel}|${mark.sizeBand}`;
}

/** Compares the marks on the map (key → look) with the marks wanted now. */
export function diffMarks(current: Map<string, string>, wanted: LightningMark[]): MarkDiff {
  const add: LightningMark[] = [];
  const restyle: LightningMark[] = [];
  const wantedKeys = new Set<string>();
  for (const mark of wanted) {
    wantedKeys.add(mark.key);
    const look = current.get(mark.key);
    if (look === undefined) add.push(mark);
    else if (look !== appearanceKey(mark)) restyle.push(mark);
  }
  const remove = [...current.keys()].filter((key) => !wantedKeys.has(key));
  return { add, remove, restyle };
}

/** The group's strikes, newest first, at most `limit` (for the list of a group that cannot split). */
export function groupLeaves(
  { index, strikesById }: StrikeIndex,
  groupId: number,
  limit = 20,
): LightningStrike[] {
  return index
    .getLeaves(groupId, Number.POSITIVE_INFINITY)
    .map((leaf) => strikesById.get(leaf.properties.id))
    .filter((strike): strike is LightningStrike => strike !== undefined)
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, limit);
}

export type GroupListRow = { title: string; time: string; relative: string } | { more: number };

/** Rows for an unsplittable group's popup: up to 20 strikes, then "and N more". */
export function groupListRows(
  leaves: LightningStrike[],
  now: number,
  total: number,
): GroupListRow[] {
  const rows: GroupListRow[] = leaves.slice(0, 20).map((strike) => formatStrikePopup(strike, now));
  if (total > 20) rows.push({ more: total - 20 });
  return rows;
}

/** Where selecting a group takes the map, or null when it cannot split (show its list instead). */
export function groupSelectView(
  center: [number, number],
  expansionZoom: number,
  maxZoom = GROUP_MAX_ZOOM,
): { center: [number, number]; zoom: number } | null {
  return expansionZoom > maxZoom ? null : { center, zoom: Math.min(expansionZoom, maxZoom) };
}
