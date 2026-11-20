/**
 * The privacy notice's words (specs 012 and 016, PDPA disclosure). The one-line label and the
 * explanation name only what this page actually measures: visit counts, page speed, both, or
 * nothing (no notice). Plain strings, so every combination is unit-tested.
 */
export interface PrivacyCopy {
  label: string;
  paragraphs: string[];
}

const VISITS =
  'We count visits to see whether this app is useful. Vercel Web Analytics, our host’s built-in ' +
  'tool, records the page, the site that linked here, your country, region and city, and your ' +
  'device type, operating system and browser. Visitors are told apart by an anonymous value that ' +
  'resets every day.';

const SPEED =
  'We measure how quickly the page loads and responds on your device, to keep it fast. Vercel ' +
  'Speed Insights, our host’s built-in tool, records the page, your browser, operating system and ' +
  'device type, your country, your network speed, and which part of the page was slowest.';

const SAVED_PLACES =
  'Places you save are kept on our server under a random code stored only in this browser, so no ' +
  'one else can see them. Clearing this browser’s data loses them, and they’re deleted after 90 ' +
  'days without use.';

export function privacyCopy(active: { visits: boolean; speed: boolean }): PrivacyCopy | null {
  const { visits, speed } = active;
  if (!visits && !speed) return null;
  const label =
    visits && speed
      ? 'Anonymous visits & speed · no cookies'
      : visits
        ? 'Anonymous visit counts · no cookies'
        : 'Anonymous speed stats · no cookies';
  const shared =
    visits && speed
      ? 'They use no cookies, no account and no precise location, and never see your saved places.'
      : 'It uses no cookies, no account and no precise location, and never sees your saved places.';
  return {
    label,
    paragraphs: [...(visits ? [VISITS] : []), ...(speed ? [SPEED] : []), shared, SAVED_PLACES],
  };
}
