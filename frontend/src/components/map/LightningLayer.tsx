import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { Pane, useMap } from 'react-leaflet';
import { useStore } from '../../state/store';
import type { LightningObservation } from '../../types';
import { prefersReducedMotion } from '../motion';
import { groupIconSizePx, groupMarkup } from './groupMarker';
import { formatStrikePopup } from './lightningHelpers';
import {
  appearanceKey,
  buildStrikeIndex,
  diffMarks,
  groupLeaves,
  groupListRows,
  groupSelectView,
  inWindowIds,
  marksInView,
  sameIds,
  type Bbox,
  type GroupMark,
  type LightningMark,
  type StrikeIndex,
} from './lightningGroups';
import type { MapView } from './mapHelpers';
import { STRIKE_STEPS, strikeMarkup, strikeSizePx } from './strikeMarker';
import { useNow } from './useNow';

const TICK_MS = 30_000;
// Between Leaflet's overlay pane (400) and marker pane (600), so location pins stay clickable.
const PANE_Z_INDEX = 450;
// Marks are kept a little past the edges, so a short pan doesn't show an empty border.
const VIEW_PADDING = 0.25;
// Group icons are cached by look; the cache is cleared if a long storm makes it this large.
const GROUP_ICON_CACHE_LIMIT = 2_000;

// One icon per age step, shared by every bolt: a tick re-icons only bolts that crossed a step.
const BOLT_ICONS: L.DivIcon[] = Array.from({ length: STRIKE_STEPS }, (_, step) => {
  const size = strikeSizePx(step);
  return L.divIcon({
    html: strikeMarkup(step),
    className: 'strike-mark-wrapper',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
});

const groupIcons = new Map<string, L.DivIcon>();

function groupIcon(mark: GroupMark): L.DivIcon {
  const key = `${appearanceKey(mark)}|${mark.splittable}|${mark.count}`;
  let icon = groupIcons.get(key);
  if (!icon) {
    if (groupIcons.size >= GROUP_ICON_CACHE_LIMIT) groupIcons.clear();
    const size = groupIconSizePx(mark.sizeBand);
    icon = L.divIcon({
      html: groupMarkup(mark),
      className: 'strike-group-wrapper',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
    groupIcons.set(key, icon);
  }
  return icon;
}

function iconFor(mark: LightningMark): L.DivIcon {
  return mark.kind === 'bolt' ? BOLT_ICONS[mark.step] : groupIcon(mark);
}

/** A strike's popup text, built as DOM text (strike labels come from the provider, never as HTML). */
function boltPopupContent(
  mark: Extract<LightningMark, { kind: 'bolt' }>,
  now: number,
): HTMLElement {
  const popup = formatStrikePopup(mark.strike, now);
  const root = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = popup.title;
  root.append(title, document.createElement('br'), `${popup.time} · ${popup.relative}`);
  return root;
}

function groupListContent(index: StrikeIndex, mark: GroupMark, now: number): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'strike-group-list';
  for (const row of groupListRows(groupLeaves(index, mark.groupId, 20), now, mark.count)) {
    const item = document.createElement('li');
    if ('more' in row) {
      item.textContent = `and ${row.more} more`;
    } else {
      const title = document.createElement('strong');
      title.textContent = row.title;
      item.append(title, ` · ${row.time} · ${row.relative}`);
    }
    list.append(item);
  }
  return list;
}

interface Entry {
  marker: L.Marker;
  look: string;
  mark: LightningMark;
}

/** Everything the imperative layer keeps between renders; never part of React state. */
interface LayerState {
  group: L.LayerGroup;
  entries: Map<string, Entry>;
  index: StrikeIndex | null;
  indexedFor: LightningObservation | null;
  reportedFor: LightningObservation | null;
  observation: LightningObservation;
  now: number;
  onGroupSelect?: (view: MapView) => void;
}

function viewBox(map: L.Map): Bbox {
  const bounds = map.getBounds().pad(VIEW_PADDING);
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

/** Rebuilds the index only when the strikes in the window changed (new data, or some aged out). */
function ensureIndex(state: LayerState): StrikeIndex {
  const { observation, now } = state;
  if (
    state.index &&
    state.indexedFor === observation &&
    sameIds(state.index.strikeIds, inWindowIds(observation.strikes, now))
  ) {
    return state.index;
  }
  state.index = buildStrikeIndex(observation.strikes, now);
  state.indexedFor = observation;
  return state.index;
}

function selectGroup(map: L.Map, state: LayerState, mark: GroupMark): void {
  const view = groupSelectView([mark.latitude, mark.longitude], mark.expansionZoom);
  if (view && state.onGroupSelect) {
    state.onGroupSelect(view);
  } else if (view) {
    if (prefersReducedMotion()) map.setView(view.center, view.zoom, { animate: false });
    else map.flyTo(view.center, view.zoom, { duration: 0.6 });
  } else if (state.index) {
    let content: HTMLElement;
    try {
      content = groupListContent(state.index, mark, state.now);
    } catch {
      // The index was rebuilt under this mark; the next draw replaces it, so just zoom in.
      map.setView([mark.latitude, mark.longitude], map.getZoom() + 2);
      return;
    }
    L.popup({ offset: [0, -groupIconSizePx(mark.sizeBand) / 2] })
      .setLatLng([mark.latitude, mark.longitude])
      .setContent(content)
      .openOn(map);
  }
}

/** Draws what this view needs and changes only what differs from what is already on the map. */
function draw(map: L.Map, state: LayerState): { groups: number; bolts: number } {
  const index = ensureIndex(state);
  const wanted = marksInView(index, viewBox(map), Math.round(map.getZoom()), state.now);
  const current = new Map<string, string>();
  for (const [key, entry] of state.entries) current.set(key, entry.look);
  const { add, remove, restyle } = diffMarks(current, wanted);

  for (const key of remove) {
    const entry = state.entries.get(key);
    if (entry) state.group.removeLayer(entry.marker);
    state.entries.delete(key);
  }
  for (const mark of restyle) {
    const entry = state.entries.get(mark.key);
    if (!entry) continue;
    entry.marker.setIcon(iconFor(mark));
    entry.look = appearanceKey(mark);
    entry.mark = mark;
  }
  for (const mark of add) {
    const marker = L.marker([mark.latitude, mark.longitude], {
      icon: iconFor(mark),
      pane: 'lightning',
      // Not Tab stops, as before: a storm's marks would swamp the keyboard. The status strip
      // gives the count.
      keyboard: false,
      riseOnHover: false,
    });
    const entry: Entry = { marker, look: appearanceKey(mark), mark };
    marker.on('click', () => {
      const latest = entry.mark;
      if (latest.kind === 'group') {
        selectGroup(map, state, latest);
      } else {
        L.popup({ offset: [0, -strikeSizePx(latest.step) / 2] })
          .setLatLng([latest.latitude, latest.longitude])
          .setContent(boltPopupContent(latest, state.now))
          .openOn(map);
      }
    });
    state.group.addLayer(marker);
    state.entries.set(mark.key, entry);
  }

  // Marks whose look didn't change still get the newest data (counts, ids) for their click.
  const byKey = new Map(wanted.map((mark) => [mark.key, mark]));
  for (const [key, entry] of state.entries) entry.mark = byKey.get(key) ?? entry.mark;

  let groups = 0;
  for (const entry of state.entries.values()) if (entry.mark.kind === 'group') groups += 1;
  return { groups, bolts: state.entries.size - groups };
}

interface LightningMarksProps {
  observation: LightningObservation;
  now: number;
  onGroupSelect?: (view: MapView) => void;
  reportDrawn: (
    observation: LightningObservation,
    marks: { groups: number; bolts: number },
  ) => void;
}

function LightningMarks({ observation, now, onGroupSelect, reportDrawn }: LightningMarksProps) {
  const map = useMap();
  const stateRef = useRef<LayerState | null>(null);

  // One layer group per map, in the lightning pane; emptied when the layer goes away.
  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    stateRef.current = {
      group,
      entries: new Map(),
      index: null,
      indexedFor: null,
      reportedFor: null,
      observation,
      now,
    };
    return () => {
      group.remove();
      stateRef.current = null;
    };
    // Created once per map; the effect below feeds it every change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.observation = observation;
    state.now = now;
    state.onGroupSelect = onGroupSelect;

    const isNew = state.reportedFor !== observation;
    const counts = draw(map, state);
    let frame = 0;
    if (isNew) {
      state.reportedFor = observation;
      // Refresh timing (developer console only): the frame after the one that shows the marks, so
      // the drawing time covers adding them, not just React's commit (spec 009, FR-017).
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => reportDrawn(observation, counts));
      });
    }

    const redraw = () => {
      const current = stateRef.current;
      if (current) draw(map, current);
    };
    map.on('moveend', redraw);
    return () => {
      map.off('moveend', redraw);
      cancelAnimationFrame(frame);
    };
  }, [map, observation, now, onGroupSelect, reportDrawn]);

  return null;
}

interface LightningLayerProps {
  /** False while this map is hidden (the card under fullscreen): nothing is drawn or measured. */
  showLightning?: boolean;
  /** When set (the card map), selecting a group calls this instead of zooming this map. */
  onGroupSelect?: (view: MapView) => void;
}

/** Island-wide lightning from the last hour: groups where strikes crowd, single bolts elsewhere. */
export function LightningLayer({ showLightning = true, onGroupSelect }: LightningLayerProps) {
  const { lightning } = useStore();
  const now = useNow(TICK_MS, lightning.observation);
  const { enabled, observation, reportDrawn } = lightning;

  if (!showLightning || !enabled || !observation) return null;

  return (
    <Pane name="lightning" style={{ zIndex: PANE_Z_INDEX }}>
      <LightningMarks
        observation={observation}
        now={now}
        onGroupSelect={onGroupSelect}
        reportDrawn={reportDrawn}
      />
    </Pane>
  );
}
