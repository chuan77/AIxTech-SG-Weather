import { Analytics } from '@vercel/analytics/react';
import { StoreProvider } from './state/store';
import { Layout } from './components/Layout';
import { ThemeProvider } from './theme/ThemeContext';
import { readAnalyticsMode } from './analytics/analyticsMode';
import { stripUrl } from './analytics/stripUrl';

// Fixed for the page's lifetime: the server sets it in index.html (spec 012).
const analyticsMode = readAnalyticsMode();

export function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <Layout />
      </StoreProvider>
      {/* Hosted deployments only. mode="production" stops the package's auto mode from loading
          its debug script from va.vercel-scripts.com. */}
      {analyticsMode === 'measure' && <Analytics mode="production" beforeSend={stripUrl} />}
    </ThemeProvider>
  );
}
