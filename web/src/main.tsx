import { createRoot } from 'react-dom/client';
import { App } from './App';
import { reloadOnceForNewVersion } from './components/ErrorBoundary';
import { installGlobalErrorReporting } from './services/monitoring';
import { IS_DEMO } from './services/mode';
import { currentPath, navigate, startRouter } from './services/router';
import './styles/tokens.css';
import './styles/base.css';
import './styles/tailwind.css';
import './styles/legacy-rerender.css';

installGlobalErrorReporting();
// Z10: a screen's file that vanished after a new version was published → reload once to get the new one.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault();
});

async function start(): Promise<void> {
  // With the real backend, the session is restored (and the links sent by e-mail handled) before the
  // first screen, so the route guards already know who is logged in.
  if (!IS_DEMO) {
    const { startRemoteSession } = await import('./services/remote/session');
    await startRemoteSession();
  }

  startRouter();
  // "/" (no hash) opens the splash screen, replacing the entry like the legacy router did.
  if (currentPath() === '/') navigate('/splash', { replace: true });

  const appElement = document.getElementById('app');
  if (!appElement) throw new Error('index.html sem o elemento #app');
  // No <StrictMode>: its development-only double effects would restart the navigation's slide
  // animations, which are driven imperatively (see layouts/AppNav.tsx).
  createRoot(appElement).render(<App />);
}

void start();
