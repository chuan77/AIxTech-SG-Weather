/**
 * beforeSend for Vercel Web Analytics (spec 012) and Speed Insights (spec 016): reports the page
 * without its query string or fragment. The app never writes to the URL, but inbound links can
 * carry tracking parameters (?fbclid=…), which Vercel would otherwise store with the event. Every
 * other field (type, route) is kept, and an event is never dropped.
 */
export function stripUrl<T extends { url: string }>(event: T): T {
  try {
    const url = new URL(event.url);
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return event;
  }
}
