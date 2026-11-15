import { CloudIcon, RainIcon, SunIcon, ThunderIcon, type WeatherGlyph } from './icons';
import { conditionToIcon, type PinIconKey } from './map/mapHelpers';

/** Which weather glyph each condition key draws; shared with the map pins' HTML. */
export const CONDITION_GLYPHS: Record<PinIconKey, WeatherGlyph> = {
  thunder: 'thunder',
  rain: 'rain',
  cloud: 'cloud',
  sun: 'sun',
  unknown: 'cloud',
};

export const CONDITION_ICONS: Record<PinIconKey, typeof SunIcon> = {
  thunder: ThunderIcon,
  rain: RainIcon,
  cloud: CloudIcon,
  sun: SunIcon,
  unknown: CloudIcon,
};

interface ConditionIconProps {
  condition: string | null | undefined;
  className?: string;
}

/**
 * The one condition-to-glyph mapping, shared by the hero, forecasts, sidebar and map pins.
 * Decorative: the condition text always sits beside it.
 */
export function ConditionIcon({ condition, className = 'h-5 w-5' }: ConditionIconProps) {
  const Icon = CONDITION_ICONS[conditionToIcon(condition)];
  return <Icon className={className} />;
}
