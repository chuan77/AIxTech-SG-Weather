import type { SVGProps } from 'react';

interface IconProps {
  className?: string;
}

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} satisfies SVGProps<SVGSVGElement>;

type Shape = { path: string } | { circle: { cx: number; cy: number; r: number } };

/**
 * The weather glyphs as data, so the React icons and the map pins' plain HTML (Leaflet takes a
 * string) draw from one source, without shipping react-dom/server to render pins.
 */
export const WEATHER_SHAPES = {
  cloud: [{ path: 'M7 18h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 11.4 3.5 3.5 0 0 0 7 18Z' }],
  sun: [
    { circle: { cx: 12, cy: 12, r: 4 } },
    {
      path: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
    },
  ],
  rain: [
    { path: 'M7 15h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 8.4 3.5 3.5 0 0 0 7 15Z' },
    { path: 'M8 18l-1 3M12 18l-1 3M16 18l-1 3' },
  ],
  thunder: [
    { path: 'M7 14h10a4 4 0 0 0 .8-7.92A6 6 0 0 0 6.1 7.4 3.5 3.5 0 0 0 7 14Z' },
    { path: 'm12 14-2 4h3l-2 4' },
  ],
} satisfies Record<string, Shape[]>;

export type WeatherGlyph = keyof typeof WEATHER_SHAPES;

function WeatherSvg({ glyph, className }: { glyph: WeatherGlyph; className: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      {(WEATHER_SHAPES[glyph] as Shape[]).map((shape, i) =>
        'path' in shape ? (
          <path key={i} d={shape.path} />
        ) : (
          <circle key={i} cx={shape.circle.cx} cy={shape.circle.cy} r={shape.circle.r} />
        ),
      )}
    </svg>
  );
}

/** The same glyph as an HTML string, for Leaflet's divIcon. Matches the React icon's markup. */
export function weatherGlyphMarkup(glyph: WeatherGlyph, className: string): string {
  const shapes = (WEATHER_SHAPES[glyph] as Shape[])
    .map((shape) =>
      'path' in shape
        ? `<path d="${shape.path}"></path>`
        : `<circle cx="${shape.circle.cx}" cy="${shape.circle.cy}" r="${shape.circle.r}"></circle>`,
    )
    .join('');
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="${className}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>`;
}

export function CloudIcon({ className = 'h-5 w-5' }: IconProps) {
  return <WeatherSvg glyph="cloud" className={className} />;
}

export function SunIcon({ className = 'h-5 w-5' }: IconProps) {
  return <WeatherSvg glyph="sun" className={className} />;
}

export function HomeIcon({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

export function LocationIcon({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 2 4 6l4 4 4 12 4-12 4-4Z" />
    </svg>
  );
}

export function PlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Crosshair for "Use my location": a ring, a centre dot and four cardinal ticks. */
export function LocateIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function SearchIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function RefreshIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 4v4h-4M21 12a9 9 0 0 1-15.5 6.3L3 16M3 20v-4h4" />
    </svg>
  );
}

export function MoonIcon({ className = 'h-12 w-12' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <circle cx="12" cy="12" r="10" opacity="0.85" />
      <circle cx="9" cy="9" r="1.2" fill="rgba(0,0,0,0.18)" />
      <circle cx="14" cy="11" r="1.6" fill="rgba(0,0,0,0.18)" />
      <circle cx="11" cy="15" r="1" fill="rgba(0,0,0,0.18)" />
      <circle cx="16" cy="15" r="0.8" fill="rgba(0,0,0,0.18)" />
    </svg>
  );
}

export function CalendarIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </svg>
  );
}

export function ClockIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function WindIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h9" />
    </svg>
  );
}

export function DropletIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />
    </svg>
  );
}

export function EyeIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function GaugeIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M4 16a8 8 0 1 1 16 0" />
      <path d="M12 16l4-5" />
    </svg>
  );
}

export function ThermometerIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M14 14V5a2 2 0 1 0-4 0v9a4 4 0 1 0 4 0Z" />
    </svg>
  );
}

export function TrendIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M3 17 9 11l4 4 8-8M14 7h7v7" />
    </svg>
  );
}

export function RainIcon({ className = 'h-5 w-5' }: IconProps) {
  return <WeatherSvg glyph="rain" className={className} />;
}

export function ThunderIcon({ className = 'h-5 w-5' }: IconProps) {
  return <WeatherSvg glyph="thunder" className={className} />;
}

export function MapIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2ZM9 4v14M15 6v14" />
    </svg>
  );
}

export function ExpandIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
    </svg>
  );
}

export function CloseIcon({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function ChevronUpIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className} {...base}>
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}
