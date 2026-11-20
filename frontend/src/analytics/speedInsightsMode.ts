/**
 * Whether this page measures its speed with Vercel Speed Insights (spec 016). The production
 * server decides once at start and writes <meta name="speed-insights" content="measure|notice-only">
 * into index.html (backend/src/indexHtml.ts). No tag, which includes the Vite dev server, means off.
 */
export type SpeedInsightsMode = 'measure' | 'notice-only' | 'off';

export function parseSpeedInsightsMode(content: string | null | undefined): SpeedInsightsMode {
  return content === 'measure' || content === 'notice-only' ? content : 'off';
}

function metaContent(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;
}

export function readSpeedInsightsMode(): SpeedInsightsMode {
  return parseSpeedInsightsMode(metaContent('speed-insights'));
}

/**
 * The Speed Insights route for this page load: the server writes
 * <meta name="speed-insights-visit" content="cold|warm"> per request, so the dashboard can show
 * visits that woke the instance apart from those it served awake. The app has one page, so the
 * route carries no other meaning. Anything else gives no route (the platform then reports "/").
 */
export function routeForVisit(content: string | null | undefined): '/cold' | '/warm' | undefined {
  return content === 'cold' || content === 'warm' ? `/${content}` : undefined;
}

export function readVisitRoute(): '/cold' | '/warm' | undefined {
  return routeForVisit(metaContent('speed-insights-visit'));
}
