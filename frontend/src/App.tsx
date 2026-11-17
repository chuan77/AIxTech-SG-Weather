import { Analytics } from '@vercel/analytics/react';
import { StoreProvider } from './state/store';
import { Layout } from './components/Layout';
import { ThemeProvider } from './theme/ThemeContext';

export function App() {
  return (
    <ThemeProvider>
      <StoreProvider>
        <Layout />
      </StoreProvider>
      <Analytics />
    </ThemeProvider>
  );
}
