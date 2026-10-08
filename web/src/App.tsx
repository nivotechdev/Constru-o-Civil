import { startTransition, Suspense, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { LegacyRerender } from './components/LegacyRerender';
import { AppShell } from './layouts/AppShell';
import { isAuthFlow, preloadAllScreens, ROUTES } from './routes';
import { getLocation, matchRoute, navigate, subscribe } from './services/router';
import { MENU_DEFAULTS, MENU_KEY, type MenuUI } from './services/sharedUI';
import { getUI, setUI } from './services/store';

/** Unknown route (404). */
function PageNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-center px-6">
      <h1 className="font-display font-bold text-2xl text-concrete-900">Página não encontrada</h1>
      <p className="text-concrete-500">Volte para o início.</p>
    </div>
  );
}

/** Tracks the hash route. Every dispatch scrolls to the top and closes the account menu first. */
function useLocation() {
  const [location, setLocation] = useState(getLocation);
  useEffect(
    () =>
      subscribe(() => {
        const next = getLocation();
        window.scrollTo(0, 0);
        const menus = getUI<MenuUI>(MENU_KEY, MENU_DEFAULTS);
        if (menus.menuOpen || menus.notificationsOpen)
          setUI<MenuUI>(MENU_KEY, { menuOpen: false, notificationsOpen: false });
        if (next.path === '/') return navigate('/splash', { replace: true });
        const match = matchRoute(ROUTES, next.path);
        // A screen whose chunk is already here renders synchronously (no frame with the old screen);
        // otherwise the old screen stays up until the new one has loaded.
        if (!match || match.route.value.isLoaded()) flushSync(() => setLocation(next));
        else startTransition(() => setLocation(next));
      }),
    []
  );
  return location;
}

export function App() {
  const location = useLocation();

  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 200));
    idle(() => preloadAllScreens());
  }, []);

  const { path, seq } = location;
  if (path === '/') return null;
  const match = matchRoute(ROUTES, path);
  if (!match) return <PageNotFound />;

  const { Component } = match.route.value;
  const screen = <Component key={path} params={match.params} />;
  return (
    <Suspense fallback={null}>
      <LegacyRerender />
      {isAuthFlow(path) ? (
        screen
      ) : (
        // A new shell per navigation, like the legacy app (which rebuilt the whole DOM): no element
        // carries a previous screen's styles into the next one.
        <AppShell key={seq} path={path} pattern={match.route.pattern}>
          {screen}
        </AppShell>
      )}
    </Suspense>
  );
}
