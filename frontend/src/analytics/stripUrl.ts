import type { BeforeSendEvent } from '@vercel/analytics/react';

/**
 * beforeSend for Vercel Web Analytics (spec 012): reports the page without its query string or
 * fragment. The app never writes to the URL, but inbound links can carry tracking parameters
 * (?fbclid=…), which Vercel would otherwise store with the visit. Never drops a visit.
 */
export function stripUrl(event: BeforeSendEvent): BeforeSendEvent {
  try {
    const url = new URL(event.url);
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}
