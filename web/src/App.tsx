import { startTransition, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Button } from './components/Button';
import { OfflineBanner } from './components/OfflineBanner';
import { ResultIcon } from './components/ResultIcon';
import { SignOutDialog } from './components/SignOutDialog';
import { ToastHost } from './components/ToastHost';
import { useSession } from './hooks/useStore';
import { AppShell } from './layouts/AppShell';
import { isAuthFlow, preloadAllScreens, ROUTES } from './routes';
import { guardRoute, RETURN_TO_KEY, type ReturnToUI } from './services/guards';
import { getLocation, matchRoute, navigate, subscribe } from './services/router';
import { MENU_DEFAULTS, MENU_KEY, type MenuUI } from './services/sharedUI';
import { getUI, setUI } from './services/store';
import type { Role } from './types/models';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getBootStatus, subscribeBoot } from './services/boot';

/** Unknown route (404). */
function PageNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
      <h1 className="font-display font-bold text-2xl text-concrete-900">Página não encontrada</h1>
      <p className="text-concrete-500">Esse endereço não existe ou mudou.</p>
      <Button label="Voltar ao início" variant="secondary" iconLeft="house" onClick={() => navigate('/')} />
    </div>
  );
}

/** A route of the other side of the marketplace (a worker opening a company screen, or vice versa). */
function WrongArea({ area }: { area: Role }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5 text-center px-6">
      <ResultIcon icon="lock" tone="brand" />
      <div className="flex flex-col gap-2 max-w-sm">
        <h1 className="font-display font-bold text-2xl text-concrete-900">
          {area === 'recrutador' ? 'Essa área é da conta de construtora' : 'Essa área é da conta de trabalhador'}
        </h1>
        <p className="text-concrete-500">
          {area === 'recrutador'
            ? 'Você entrou com uma conta de trabalhador. Essa tela é só para quem publica vagas.'
            : 'Você entrou com uma conta de construtora. Essa tela é só para quem procura bico.'}
        </p>
      </div>
      <Button label="Voltar ao início" iconLeft="house" onClick={() => navigate('/mural', { replace: true })} />
    </div>
  );
}

/**
 * Sends the user elsewhere (a guard's answer) without painting the screen they can't open. `from`, when
 * set, is the deep link to come back to after signing in.
 */
function Redirect({ to, from }: { to: string; from?: string }) {
  useEffect(() => {
    // After the commit, outside React's own work (the router renders synchronously on navigation).
    const timer = window.setTimeout(() => {
      if (from) setUI<ReturnToUI>(RETURN_TO_KEY, { path: from });
      navigate(to, { replace: true });
    });
    return () => window.clearTimeout(timer);
  }, [to, from]);
  return null;
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
        if (next.path === '/') return navigate('/splash', { replace: true }); // the guard takes it from there
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
  const boot = useSyncExternalStore(subscribeBoot, getBootStatus);
  return (
    <ErrorBoundary fullScreen>
      <OfflineBanner />
      {boot === 'starting' ? <BootSplash /> : boot === 'offline' ? <OfflineStart /> : <Routes />}
      <ToastHost />
    </ErrorBoundary>
  );
}

/** While the saved session is restored (Z11): the same look as the static splash in index.html. */
function BootSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-brand-500" aria-busy="true">
      <span className="font-display font-bold text-5xl text-white tracking-tight">Bicos</span>
      <span
        role="status"
        aria-label="Abrindo"
        className="animate-spin-token"
        style={{
          width: '1.75rem',
          height: '1.75rem',
          border: '3px solid rgba(255,255,255,0.9)',
          borderRightColor: 'transparent',
          borderRadius: '9999px'
        }}
      />
    </div>
  );
}

/** A session on the device, but no connection to the server (Z11): not the login. */
function OfflineStart() {
  const [trying, setTrying] = useState(false);
  const retry = () => {
    setTrying(true);
    void import('./services/remote/session').then((m) => m.retryStart()).finally(() => setTrying(false));
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5 text-center px-6">
      <ResultIcon icon="wifi-off" tone="brand" />
      <div className="flex flex-col gap-2 max-w-sm">
        <h1 className="font-display font-bold text-2xl text-concrete-900">Sem conexão com a Bicos</h1>
        <p className="text-concrete-500">Sua conta continua aqui. Assim que a internet voltar, o app abre sozinho.</p>
      </div>
      <Button label="Tentar de novo" iconLeft="refresh-cw" loading={trying} onClick={retry} />
    </div>
  );
}

function Routes() {
  const location = useLocation();
  const session = useSession();

  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 200));
    idle(() => preloadAllScreens());
  }, []);

  const { path, seq } = location;
  if (path === '/') return null;
  const match = matchRoute(ROUTES, path);
  if (!match) return <PageNotFound />;

  const decision = guardRoute(match.route.value.access, path, session);
  if (decision.kind === 'redirect') {
    // A deep link opened without a session comes back after signing in.
    return <Redirect to={decision.to} from={!session && decision.to === '/login' ? path : undefined} />;
  }
  if (decision.kind === 'forbidden') return <WrongArea area={decision.area} />;

  const { Component } = match.route.value;
  // Z10: one screen failing (render error, or its file failed to download) shows the error card inside
  // the shell; the navigation keeps working. Keyed by path: opening another screen starts clean.
  const screen = (
    <ErrorBoundary key={path}>
      <Suspense fallback={null}>
        <Component params={match.params} />
      </Suspense>
    </ErrorBoundary>
  );
  return (
    <Suspense fallback={null}>
      <SignOutDialog />
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
