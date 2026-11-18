import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { applyTheme, loadThemeId } from './theme/themes';
import { applyOfflineHelper } from './install/offlineHelper';

const root = document.getElementById('root');

applyTheme(loadThemeId());

if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// The offline page (spec 014). After load, so it never competes with the first render.
window.addEventListener(
  'load',
  () => {
    void applyOfflineHelper();
  },
  { once: true },
);
