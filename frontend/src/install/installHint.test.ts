import { describe, expect, it } from 'vitest';
import {
  HINT_DISMISSED_KEY,
  HINT_SEEN_KEY,
  isIosDevice,
  isIosSafari,
  isStandalone,
  readFlag,
  shouldShowInstallHint,
  writeFlag,
} from './installHint';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
// iPadOS 13+ asks for desktop sites by default and reports itself as a Mac.
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const MAC_SAFARI = IPAD_DESKTOP_MODE;
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
const IPHONE_FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15';
const IPHONE_EDGE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.2592.56 Mobile/15E148 Safari/605.1.15';
const IPHONE_GOOGLE_APP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/321.0.648017773 Mobile/15E148 Safari/604.1';
const IPHONE_FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/618023341]';
const IPHONE_INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54 (iPhone15,3; iOS 17_5)';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36';

const base = {
  userAgent: IPHONE_SAFARI,
  maxTouchPoints: 5,
  standalone: false,
  dismissed: false,
  savedCount: 1,
};

describe('isIosDevice / isIosSafari', () => {
  it('recognises iPhone and iPad Safari, including iPad in desktop mode', () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true);
    expect(isIosSafari(IPAD_SAFARI, 5)).toBe(true);
    expect(isIosSafari(IPAD_DESKTOP_MODE, 5)).toBe(true);
  });

  it('treats a Mac with no touch points as a Mac', () => {
    expect(isIosDevice(MAC_SAFARI, 0)).toBe(false);
    expect(isIosSafari(MAC_SAFARI, 0)).toBe(false);
  });

  it('excludes other iOS browsers and in-app browsers, whose menus differ', () => {
    for (const ua of [
      IPHONE_CHROME,
      IPHONE_FIREFOX,
      IPHONE_EDGE,
      IPHONE_GOOGLE_APP,
      IPHONE_FACEBOOK,
      IPHONE_INSTAGRAM,
    ]) {
      expect(isIosDevice(ua, 5)).toBe(true);
      expect(isIosSafari(ua, 5)).toBe(false);
    }
  });

  it('excludes Android', () => {
    expect(isIosDevice(ANDROID_CHROME, 5)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME, 5)).toBe(false);
  });
});

describe('shouldShowInstallHint', () => {
  it('shows for iPhone and iPad Safari with a saved place', () => {
    expect(shouldShowInstallHint(base)).toBe(true);
    expect(shouldShowInstallHint({ ...base, userAgent: IPAD_SAFARI })).toBe(true);
    expect(shouldShowInstallHint({ ...base, userAgent: IPAD_DESKTOP_MODE })).toBe(true);
  });

  it('hides when installed, dismissed or with no saved place', () => {
    expect(shouldShowInstallHint({ ...base, standalone: true })).toBe(false);
    expect(shouldShowInstallHint({ ...base, dismissed: true })).toBe(false);
    expect(shouldShowInstallHint({ ...base, savedCount: 0 })).toBe(false);
  });

  it('hides for other browsers', () => {
    expect(shouldShowInstallHint({ ...base, userAgent: IPHONE_CHROME })).toBe(false);
    expect(shouldShowInstallHint({ ...base, userAgent: ANDROID_CHROME })).toBe(false);
    expect(shouldShowInstallHint({ ...base, userAgent: MAC_SAFARI, maxTouchPoints: 0 })).toBe(
      false,
    );
  });
});

describe('isStandalone', () => {
  const media = (matches: boolean) => () => ({ matches });
  it('is true for iOS navigator.standalone or the standalone display mode', () => {
    expect(isStandalone({ standalone: true }, media(false))).toBe(true);
    expect(isStandalone({}, media(true))).toBe(true);
    expect(isStandalone({ standalone: false }, media(false))).toBe(false);
  });
});

describe('readFlag / writeFlag', () => {
  const fakeStorage = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  };
  const throwing = {
    getItem: (): string | null => {
      throw new Error('blocked');
    },
    setItem: (): void => {
      throw new Error('blocked');
    },
  };

  it('stores the two flags independently', () => {
    const storage = fakeStorage();
    expect(readFlag(storage, HINT_SEEN_KEY)).toBe(false);
    expect(readFlag(storage, HINT_DISMISSED_KEY)).toBe(false);
    writeFlag(storage, HINT_SEEN_KEY);
    expect(readFlag(storage, HINT_SEEN_KEY)).toBe(true);
    expect(readFlag(storage, HINT_DISMISSED_KEY)).toBe(false);
    writeFlag(storage, HINT_DISMISSED_KEY);
    expect(readFlag(storage, HINT_DISMISSED_KEY)).toBe(true);
  });

  it('uses the documented keys', () => {
    expect(HINT_SEEN_KEY).toBe('weather-starter.install-hint.seen');
    expect(HINT_DISMISSED_KEY).toBe('weather-starter.install-hint.dismissed');
  });

  it('never throws when storage is blocked or missing', () => {
    expect(readFlag(throwing, HINT_DISMISSED_KEY)).toBe(false);
    expect(() => writeFlag(throwing, HINT_DISMISSED_KEY)).not.toThrow();
    expect(readFlag(undefined, HINT_DISMISSED_KEY)).toBe(false);
    expect(() => writeFlag(undefined, HINT_DISMISSED_KEY)).not.toThrow();
  });
});
