import L from 'leaflet';
import { useEffect } from 'react';
import { Pane, useMap } from 'react-leaflet';
import { useStore } from '../../state/store';
import type { IslandRainObservation, RainStationReading } from '../../types';
import { rainMarkKind, rainPopup } from './rainHelpers';
import { rainMarkup, rainSizePx } from './rainMarker';

// Below lightning (450) and location pins (600), above the basemap's overlay pane (400).
const PANE_Z_INDEX = 440;

/** A station's popup, built as DOM text: station names come from the provider, never as HTML. */
function popupContent(
  station: RainStationReading,
  observation: IslandRainObservation,
): HTMLElement {
  const popup = rainPopup(station, observation);
  const root = document.createElement('div');
  root.className = 'rain-popup';
  const title = document.createElement('strong');
  title.textContent = popup.title;
  root.append(title, document.createElement('br'));
  if (popup.total && popup.level)
    root.append(`${popup.total} · ${popup.level}`, document.createElement('br'));
  if (popup.note) root.append(popup.note, document.createElement('br'));
  root.append(popup.period);
  const source = document.createElement('small');
  source.className = 'rain-popup__source';
  source.textContent = popup.source;
  root.append(document.createElement('br'), source);
  return root;
}

function accessibleName(station: RainStationReading, observation: IslandRainObservation): string {
  const popup = rainPopup(station, observation);
  return [popup.title, popup.total, popup.level, popup.note].filter(Boolean).join(', ');
}

function RainMarks({ observation }: { observation: IslandRainObservation }) {
  const map = useMap();

  // About 90 stations: rebuilding them all when the readings change is cheap (no grouping needed).
  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    for (const station of observation.stations) {
      const { kind, partial } = rainMarkKind(station);
      const size = rainSizePx(kind);
      const marker = L.marker([station.latitude, station.longitude], {
        icon: L.divIcon({
          html: rainMarkup(kind, partial, accessibleName(station, observation)),
          className: 'rain-mark-wrapper',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        }),
        pane: 'rain',
        // Not Tab stops, like lightning: ~90 stops would swamp the keyboard; the strip summarises.
        keyboard: false,
        riseOnHover: false,
      });
      marker.on('click', () => {
        L.popup({ offset: [0, -size / 2] })
          .setLatLng([station.latitude, station.longitude])
          .setContent(popupContent(station, observation))
          .openOn(map);
      });
      group.addLayer(marker);
    }
    return () => {
      group.remove();
    };
  }, [map, observation]);

  return null;
}

interface RainLayerProps {
  /** False while this map is hidden (the card under fullscreen): nothing is drawn. */
  showRain?: boolean;
}

/**
 * Island-wide rain (spec 011): each station's last 15 minutes. Earlier readings stay drawn while a
 * refresh loads or after one fails; the strip says when they are out of date.
 */
export function RainLayer({ showRain = true }: RainLayerProps) {
  const { rain } = useStore();
  if (!showRain || !rain.enabled || !rain.observation) return null;

  return (
    <Pane name="rain" style={{ zIndex: PANE_Z_INDEX }}>
      <RainMarks observation={rain.observation} />
    </Pane>
  );
}
