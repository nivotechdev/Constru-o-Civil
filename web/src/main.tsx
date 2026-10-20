import { createRoot } from 'react-dom/client';
import { App } from './App';
import { reloadOnceForNewVersion } from './components/ErrorBoundary';
import { setBootStatus } from './services/boot';
import { installGlobalErrorReporting } from './services/monitoring';
import { IS_DEMO } from './services/mode';
import { currentPath, navigate, startRouter } from './services/router';
import { startServiceWorker } from './services/pwa';
import { startThemeSync } from './services/theme';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/space-mono/latin-400.css';
import '@fontsource/space-mono/latin-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/tailwind.css';

// U21/U26: the theme follows the session (dark only inside the app, per account), before anything is drawn.
startThemeSync();
installGlobalErrorReporting();
// Z10: a screen's file that vanished after a new version was published → reload once to get the new one.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});

function start(): void {
  // Z11: with the real backend the app renders at once (the splash shows while the session is restored
  // and the e-mail links are handled; services/boot.ts); the router starts after the redirect handling
  // has cleaned the URL, so a #access_token never reaches it.
  if (!IS_DEMO) {
    void import('./services/remote/session')
      .then((m) => m.startRemoteSession())
      .catch(() => setBootStatus('offline'))
      .finally(startRoutes);
  } else startRoutes();

  const appElement = document.getElementById('app');
  if (!appElement) throw new Error('index.html sem o elemento #app');
  // No <StrictMode>: its development-only double effects would restart the navigation's slide
  // animations, which are driven imperatively (see layouts/AppNav.tsx).
  createRoot(appElement).render(<App />);
}

function startRoutes(): void {
  startRouter();
  // "/" (no hash) opens the splash screen, replacing the entry like the legacy router did.
  if (currentPath() === '/') navigate('/splash', { replace: true });
}

start();
startServiceWorker();
