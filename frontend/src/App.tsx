import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { StoreProvider } from './state/store';
import { Layout } from './components/Layout';
import { ThemeProvider } from './theme/ThemeContext';
import { readAnalyticsMode } from './analytics/analyticsMode';
import { readSpeedInsightsMode, readVisitRoute } from './analytics/speedInsightsMode';
import { stripUrl } from './analytics/stripUrl';

// Fixed for the page's lifetime: the server sets them in index.html (specs 012 and 016).
const analyticsMode = readAnalyticsMode();
const speedInsightsMode = readSpeedInsightsMode();
// /cold when this page load woke the instance, /warm otherwise (spec 016).
const visitRoute = readVisitRoute();

export function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <Layout />
      </StoreProvider>
      {/* Hosted deployments only. mode="production" stops the package's auto mode from loading
          its debug script from va.vercel-scripts.com. */}
      {analyticsMode === 'measure' && <Analytics mode="production" beforeSend={stripUrl} />}
      {/* Hosted deployments only. Speed Insights has no mode prop: outside a production build it
          loads a debug script from va.vercel-scripts.com, so the dev server and tests must never
          render it (they never get the meta). */}
      {speedInsightsMode === 'measure' && (
        <SpeedInsights route={visitRoute} beforeSend={stripUrl} />
      )}
    </ThemeProvider>
  );
}
