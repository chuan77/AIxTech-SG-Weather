import { describe, expect, it } from 'vitest';
import type { BeforeSendEvent } from '@vercel/analytics/react';
import type { BeforeSendMiddleware } from '@vercel/speed-insights';
import { stripUrl } from './stripUrl';

// The package exports the middleware type, not the event type.
type SpeedEvent = Parameters<BeforeSendMiddleware>[0];

const view = (url: string): BeforeSendEvent => ({ type: 'pageview', url });

describe('stripUrl', () => {
  it('drops the query string and fragment, keeping the origin', () => {
    expect(stripUrl(view('https://lepak-weather.vercel.app/?fbclid=x#a'))).toEqual(
      view('https://lepak-weather.vercel.app/'),
    );
  });

  it('keeps the path', () => {
    expect(stripUrl(view('https://example.com/foo?x=1'))).toEqual(view('https://example.com/foo'));
  });

  it('leaves a url without query or fragment as it is', () => {
    expect(stripUrl(view('https://example.com/'))).toEqual(view('https://example.com/'));
  });

  it('returns an unparsable url unchanged rather than dropping the visit', () => {
    expect(stripUrl(view('not a url'))).toEqual(view('not a url'));
  });

  it('leaves the other fields alone', () => {
    const event: BeforeSendEvent = { type: 'event', url: 'https://example.com/?q=1' };
    expect(stripUrl(event)).toEqual({ type: 'event', url: 'https://example.com/' });
  });
});

describe('stripUrl for Speed Insights (spec 016)', () => {
  it('strips the url of a vital and keeps its type and route', () => {
    const vital: SpeedEvent = {
      type: 'vital',
      url: 'https://lepak-weather.vercel.app/?fbclid=x#a',
      route: '/cold',
    };
    expect(stripUrl(vital)).toEqual({
      type: 'vital',
      url: 'https://lepak-weather.vercel.app/',
      route: '/cold',
    });
  });
});
