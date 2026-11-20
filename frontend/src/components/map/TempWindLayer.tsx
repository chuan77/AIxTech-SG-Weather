import L from 'leaflet';
import { useEffect } from 'react';
import { Pane, useMap } from 'react-leaflet';
import { useStore } from '../../state/store';
import type { IslandConditionsObservation, Location, TempWindStation } from '../../types';
import {
  arrowRotation,
  formatTemperature,
  markKind,
  tempWindAccessibleName,
  tempWindPopup,
} from './tempWindHelpers';
import { tempWindMarkup, tempWindSizePx } from './tempWindMarker';
import { nudgeOffPins, type Offset } from './tempWindPlacement';

// Between rain (440) and lightning (450), below location pins (600), so pins stay clickable.
const PANE_Z_INDEX = 445;

/** A station's popup, built as DOM text: station names come from the provider, never as HTML. */
function popupContent(
  station: TempWindStation,
  observation: IslandConditionsObservation,
): HTMLElement {
  const popup = tempWindPopup(station, observation);
  const root = document.createElement('div');
  root.className = 'tw-popup';
  const title = document.createElement('strong');
  title.textContent = popup.title;
  root.append(title, document.createElement('br'));
  root.append(`Temperature: ${popup.temperature}`, document.createElement('br'));
  root.append(`Wind: ${popup.wind}`, document.createElement('br'));
  root.append(popup.time);
  const source = document.createElement('small');
  source.className = 'tw-popup__source';
  source.textContent = popup.source;
  root.append(document.createElement('br'), source);
  return root;
}

function markIcon(station: TempWindStation, offset: Offset): L.DivIcon {
  const kind = markKind(station);
  const size = tempWindSizePx(kind);
  const rotation =
    station.wind_direction_deg === null ? 0 : arrowRotation(station.wind_direction_deg);
  return L.divIcon({
    html: tempWindMarkup(
      kind,
      formatTemperature(station.temperature_c),
      rotation,
      tempWindAccessibleName(station),
    ),
    className: 'tw-mark-wrapper',
    iconSize: [size.width, size.height],
    // Shifting the anchor moves the label off a pin while the marker stays on its station.
    iconAnchor: [size.width / 2 - offset.dx, size.height / 2 - offset.dy],
  });
}

interface TempWindMarksProps {
  observation: IslandConditionsObservation;
  pins: readonly Pick<Location, 'latitude' | 'longitude'>[];
}

function TempWindMarks({ observation, pins }: TempWindMarksProps) {
  const map = useMap();
  const pinKey = pins.map((pin) => `${pin.latitude},${pin.longitude}`).join('|');

  // About 17 stations: rebuilding them all when the readings or pins change is cheap.
  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    const placed = observation.stations.map((station) => {
      const size = tempWindSizePx(markKind(station));
      const marker = L.marker([station.latitude, station.longitude], {
        icon: markIcon(station, { dx: 0, dy: 0 }),
        pane: 'temp-wind',
        // Not Tab stops, like rain and lightning; the status strip summarises.
        keyboard: false,
        riseOnHover: true,
      });
      const entry = { station, marker, size, offset: { dx: 0, dy: 0 } };
      marker.on('click', () => {
        // Above the label, wherever it was nudged to.
        L.popup({ offset: [entry.offset.dx, entry.offset.dy - size.height / 2] })
          .setLatLng([station.latitude, station.longitude])
          .setContent(popupContent(station, observation))
          .openOn(map);
      });
      group.addLayer(marker);
      return entry;
    });

    // Pixel distances change with zoom, so labels are placed again after every zoom.
    const place = () => {
      const pinPoints = pins.map((pin) => map.latLngToLayerPoint([pin.latitude, pin.longitude]));
      for (const entry of placed) {
        const point = map.latLngToLayerPoint([entry.station.latitude, entry.station.longitude]);
        const offset = nudgeOffPins(point, entry.size, pinPoints);
        if (offset.dx === entry.offset.dx && offset.dy === entry.offset.dy) continue;
        entry.offset = offset;
        entry.marker.setIcon(markIcon(entry.station, offset));
      }
    };
    place();
    map.on('zoomend', place);
    return () => {
      map.off('zoomend', place);
      group.remove();
    };
    // pinKey stands in for pins: a new array with the same places needs no re-placing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, observation, pinKey]);

  return null;
}

interface TempWindLayerProps {
  /** True only on the full-screen map (spec 015, Gate 1): the card never draws these marks. */
  showTempWind?: boolean;
  /** The location pins drawn on this map; labels are kept out from under them. */
  pins?: readonly Pick<Location, 'latitude' | 'longitude'>[];
}

/**
 * Island-wide temperature and wind (spec 015). Earlier readings stay drawn while a refresh loads
 * or after one fails; the strip says when they are out of date.
 */
const NO_PINS: readonly Pick<Location, 'latitude' | 'longitude'>[] = [];

export function TempWindLayer({ showTempWind = false, pins = NO_PINS }: TempWindLayerProps) {
  const { tempWind } = useStore();
  if (!showTempWind || !tempWind.enabled || !tempWind.observation) return null;

  return (
    <Pane name="temp-wind" style={{ zIndex: PANE_Z_INDEX }}>
      <TempWindMarks observation={tempWind.observation} pins={pins} />
    </Pane>
  );
}
