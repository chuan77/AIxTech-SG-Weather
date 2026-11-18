/**
 * Whether to offer the iPhone/iPad "Add to Home Screen" button (spec 014, contracts/install-hint.md).
 * iOS Safari has no install prompt, and a home-screen app keeps its own storage, separate from
 * Safari's, so it starts with its own visitor key and an empty list (research R1). The button and
 * its tip say so before people install. Pure: no DOM, no React, testable in node.
 */

/** Set once the tip has been opened: the button's dot is no longer drawn. */
export const HINT_SEEN_KEY = 'weather-starter.install-hint.seen';
/** Set by "Got it": the button never renders again in this browser. */
export const HINT_DISMISSED_KEY = 'weather-starter.install-hint.dismissed';

export interface FlagStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface HintInputs {
  userAgent: string;
  maxTouchPoints: number;
  /** Already running from the home screen. */
  standalone: boolean;
  /** "Got it" was pressed. */
  dismissed: boolean;
  savedCount: number;
}

// Other iOS browsers and in-app browsers: their share menus differ from Safari's, and some can't
// add to the home screen at all, so Safari's steps would be wrong there (FR-009).
const NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|YaBrowser|DuckDuckGo|FBAN|FBAV|Instagram|Line\//;

export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  // iPadOS 13+ reports a Mac user agent; a touch screen gives it away.
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  return (
    isIosDevice(userAgent, maxTouchPoints) &&
    /Safari\//.test(userAgent) &&
    /Version\//.test(userAgent) &&
    !NOT_SAFARI.test(userAgent)
  );
}

export function shouldShowInstallHint({
  userAgent,
  maxTouchPoints,
  standalone,
  dismissed,
  savedCount,
}: HintInputs): boolean {
  return isIosSafari(userAgent, maxTouchPoints) && !standalone && !dismissed && savedCount >= 1;
}

export function isStandalone(
  nav: { standalone?: boolean },
  matchMediaFn: (query: string) => { matches: boolean },
): boolean {
  return nav.standalone === true || matchMediaFn('(display-mode: standalone)').matches;
}

/** True when the flag is set. Missing or blocked storage reads as unset. */
export function readFlag(storage: FlagStorage | undefined, key: string): boolean {
  try {
    return storage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** Sets the flag; a missing or blocked storage is ignored (the caller keeps it in memory). */
export function writeFlag(storage: FlagStorage | undefined, key: string): void {
  try {
    storage?.setItem(key, '1');
  } catch {
    // Private modes can refuse storage; the flag then lasts for this page only.
  }
}
