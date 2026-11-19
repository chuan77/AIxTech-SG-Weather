import L from 'leaflet';
import { useEffect } from 'react';
import { Pane, useMap } from 'react-leaflet';
import { useStore } from '../../state/store';
import type { IslandConditionsObservation, TempWindStation } from '../../types';
import {
  arrowRotation,
  formatTemperature,
  markKind,
  tempWindAccessibleName,
  tempWindPopup,
} from './tempWindHelpers';
import { tempWindMarkup, tempWindSizePx } from './tempWindMarker';

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

function TempWindMarks({ observation }: { observation: IslandConditionsObservation }) {
  const map = useMap();

  // About 17 stations: rebuilding them all when the readings change is cheap.
  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    for (const station of observation.stations) {
      const kind = markKind(station);
      const size = tempWindSizePx(kind);
      const rotation =
        station.wind_direction_deg === null ? 0 : arrowRotation(station.wind_direction_deg);
      const marker = L.marker([station.latitude, station.longitude], {
        icon: L.divIcon({
          html: tempWindMarkup(
            kind,
            formatTemperature(station.temperature_c),
            rotation,
            tempWindAccessibleName(station),
          ),
          className: 'tw-mark-wrapper',
          iconSize: [size.width, size.height],
          iconAnchor: [size.width / 2, size.height / 2],
          popupAnchor: [0, -size.height / 2],
        }),
        pane: 'temp-wind',
        // Not Tab stops, like rain and lightning; the status strip summarises.
        keyboard: false,
        riseOnHover: true,
      });
      marker.on('click', () => {
        L.popup({ offset: [0, -size.height / 2] })
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

interface TempWindLayerProps {
  /** True only on the full-screen map (spec 015, Gate 1): the card never draws these marks. */
  showTempWind?: boolean;
}

/**
 * Island-wide temperature and wind (spec 015). Earlier readings stay drawn while a refresh loads
 * or after one fails; the strip says when they are out of date.
 */
export function TempWindLayer({ showTempWind = false }: TempWindLayerProps) {
  const { tempWind } = useStore();
  if (!showTempWind || !tempWind.enabled || !tempWind.observation) return null;

  return (
    <Pane name="temp-wind" style={{ zIndex: PANE_Z_INDEX }}>
      <TempWindMarks observation={tempWind.observation} />
    </Pane>
  );
}
