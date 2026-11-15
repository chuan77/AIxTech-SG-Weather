import L from 'leaflet';
import { useEffect } from 'react';
import { Marker, Pane, Popup } from 'react-leaflet';
import { useStore } from '../../state/store';
import { formatStrikePopup, visibleStrikes } from './lightningHelpers';
import { STRIKE_STEPS, strikeMarkup, strikeSizePx, strikeStep } from './strikeMarker';
import { useNow } from './useNow';

const TICK_MS = 30_000;
// Between Leaflet's overlay pane (400) and marker pane (600), so location pins stay clickable.
const PANE_Z_INDEX = 450;

// One icon per age step, shared by every strike: a tick re-icons only strikes that crossed a step.
const ICONS: L.DivIcon[] = Array.from({ length: STRIKE_STEPS }, (_, step) => {
  const size = strikeSizePx(step);
  return L.divIcon({
    html: strikeMarkup(step),
    className: 'strike-mark-wrapper',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
});

/** Island-wide lightning strikes: one themed bolt per strike from the last hour. */
export function LightningLayer() {
  const { lightning } = useStore();
  const now = useNow(TICK_MS, lightning.observation);
  const { enabled, observation, reportDrawn } = lightning;

  // Refresh timing (developer console only): the frame after a new observation was committed.
  // With the layer off nothing is drawn, so the store logs the record without a drawing time.
  useEffect(() => {
    if (!enabled || !observation) return;
    const frame = requestAnimationFrame(() => reportDrawn(observation));
    return () => cancelAnimationFrame(frame);
  }, [enabled, observation, reportDrawn]);

  if (!lightning.enabled || !lightning.observation) return null;

  return (
    <Pane name="lightning" style={{ zIndex: PANE_Z_INDEX }}>
      {visibleStrikes(lightning.observation.strikes, now).map((strike) => {
        const popup = formatStrikePopup(strike, now);
        return (
          <Marker
            key={strike.id}
            position={[strike.latitude, strike.longitude]}
            icon={ICONS[strikeStep(strike.occurred_at, now)]}
            pane="lightning"
            // Not a Tab stop, like the circles before: hundreds of strikes would swamp the keyboard.
            keyboard={false}
            riseOnHover={false}
          >
            <Popup>
              <strong>{popup.title}</strong>
              <br />
              {popup.time} · {popup.relative}
            </Popup>
          </Marker>
        );
      })}
    </Pane>
  );
}
