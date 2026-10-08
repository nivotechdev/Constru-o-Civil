import { createRoot } from 'react-dom/client';
import { App } from './App';
import { currentPath, navigate, startRouter } from './services/router';
import { initAuth } from './services/store';
import './styles/tokens.css';
import './styles/base.css';
import './styles/tailwind.css';
import './styles/legacy-rerender.css';

// The "forgot password" and "confirm your e-mail" links add their tokens as the URL's OWN fragment
// (#access_token=...&type=recovery) — this has to be consumed BEFORE the hash router starts (it also
// reads location.hash), or it turns into a nonsense "path" glued onto whatever route follows the "#".
async function consumeRecoveryTokenFromUrl(): Promise<void> {
  const hash = window.location.hash.slice(1);
  if (!hash.includes('access_token=') || !hash.includes('type=recovery')) return;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return;
  const { getSupabase } = await import('./services/supabase');
  const supabase = await getSupabase();
  try {
    await supabase?.auth.setSession({ access_token, refresh_token });
  } catch {
    /* a tela de redefinir senha mostra "link inválido" se a sessão não veio */
  }
  history.replaceState(null, '', window.location.pathname + window.location.search + '#/redefinir-senha');
}

(async function bootstrap() {
  await consumeRecoveryTokenFromUrl();
  startRouter();
  // "/" (no hash) opens the splash screen, replacing the entry like the legacy router did.
  if (currentPath() === '/') navigate('/splash', { replace: true });

  const appElement = document.getElementById('app');
  if (!appElement) throw new Error('index.html sem o elemento #app');
  // No <StrictMode>: its development-only double effects would restart the navigation's slide
  // animations, which are driven imperatively (see layouts/AppNav.tsx).
  createRoot(appElement).render(<App />);

  await initAuth();
})();
