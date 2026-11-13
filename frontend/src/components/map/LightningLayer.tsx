import { useEffect, useState } from 'react';
import { CircleMarker, Pane, Popup } from 'react-leaflet';
import { useStore } from '../../state/store';
import { useTheme } from '../../theme/ThemeContext';
import { formatStrikePopup, strikeStyle, visibleStrikes } from './lightningHelpers';
import { useNow } from './useNow';

const TICK_MS = 30_000;
const FALLBACK_COLOUR = '#ffd21f';
const OUTLINE = 'rgba(20, 25, 40, 0.85)';
// Between Leaflet's overlay pane (400) and marker pane (600), so location pins stay clickable.
const PANE_Z_INDEX = 450;

function readLightningColour(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--lightning').trim();
  return value || FALLBACK_COLOUR;
}

/** Island-wide lightning strikes: one fading circle per strike from the last hour. */
export function LightningLayer() {
  const { lightning } = useStore();
  const { theme } = useTheme();
  const now = useNow(TICK_MS, lightning.observation);
  const [colour, setColour] = useState(readLightningColour);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the active theme's CSS variable
    setColour(readLightningColour());
  }, [theme.id]);

  if (!lightning.enabled || !lightning.observation) return null;

  return (
    <Pane name="lightning" style={{ zIndex: PANE_Z_INDEX }}>
      {visibleStrikes(lightning.observation.strikes, now).map((strike) => {
        const { opacity, radius } = strikeStyle(strike.occurred_at, now);
        const popup = formatStrikePopup(strike, now);
        return (
          <CircleMarker
            key={strike.id}
            center={[strike.latitude, strike.longitude]}
            radius={radius}
            pane="lightning"
            pathOptions={{
              color: OUTLINE,
              weight: 1.5,
              // The fill fades fully; the outline keeps a floor so old strikes stay findable on light maps.
              opacity: 0.4 + 0.6 * opacity,
              fillColor: colour,
              fillOpacity: opacity * 0.85,
            }}
          >
            <Popup>
              <strong>{popup.title}</strong>
              <br />
              {popup.time} · {popup.relative}
            </Popup>
          </CircleMarker>
        );
      })}
    </Pane>
  );
}
