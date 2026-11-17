/**
 * Whether this page measures visits (spec 012). The production server decides once at start and
 * writes <meta name="web-analytics" content="measure|notice-only"> into index.html
 * (backend/src/indexHtml.ts). No tag, which includes the Vite dev server, means off.
 */
export type AnalyticsMode = 'measure' | 'notice-only' | 'off';

export function parseAnalyticsMode(content: string | null | undefined): AnalyticsMode {
  return content === 'measure' || content === 'notice-only' ? content : 'off';
}

export function readAnalyticsMode(): AnalyticsMode {
  const meta =
    typeof document === 'undefined'
      ? null
      : document.querySelector<HTMLMetaElement>('meta[name="web-analytics"]');
  return parseAnalyticsMode(meta?.content);
}
