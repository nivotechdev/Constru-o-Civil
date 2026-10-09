// Z10 — No white screen. A render error (or a screen whose code failed to download) shows this card
// instead of unmounting the app: "Tentar de novo" re-renders (and re-downloads a failed screen),
// "Recarregar" reloads the page. When the failure is a screen's file that no longer exists on the server
// (the app was updated while it was open), the page reloads by itself once.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../services/monitoring';
import { Button } from './Button';
import { ResultIcon } from './ResultIcon';

const RELOADED_KEY = 'bicos.recarregou-apos-atualizacao';

/** A dynamic import (a screen's chunk) that couldn't be fetched — usually a new version was deployed. */
export function isChunkError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|preload/i.test(
    text
  );
}

/**
 * Reloads the page for a stale chunk, at most once a minute (so a file that is really missing shows the
 * card instead of reloading forever); `false` when it just did.
 */
export function reloadOnceForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

interface Props {
  children: ReactNode;
  /** Called by "Tentar de novo" before re-rendering (e.g. to forget a failed download). */
  onRetry?: () => void;
  /** Full screen (the whole app) or inside the shell (one screen). */
  fullScreen?: boolean;
}

interface State {
  error: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (isChunkError(error) && reloadOnceForNewVersion()) return;
    reportError(error, { where: 'render', componentStack: info.componentStack ?? '' });
  }

  retry = () => {
    this.props.onRetry?.();
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (
      <div
        role="alert"
        className={
          'flex flex-col items-center justify-center text-center gap-5 px-6 ' +
          (this.props.fullScreen ? 'min-h-screen' : 'py-16')
        }
      >
        <ResultIcon icon={offline ? 'wifi-off' : 'triangle-alert'} tone="brand" />
        <div className="flex flex-col gap-2 max-w-sm">
          <h1 className="font-display font-bold text-2xl text-concrete-900">
            {offline ? 'Sem internet' : 'Essa tela não abriu'}
          </h1>
          <p className="text-concrete-500">
            {offline
              ? 'Confira sua conexão e tente de novo.'
              : 'Algo deu errado do nosso lado. Tente de novo; se continuar, recarregue o app.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button label="Tentar de novo" iconLeft="refresh-cw" fullWidth onClick={this.retry} />
          <Button label="Recarregar o app" variant="secondary" fullWidth onClick={() => window.location.reload()} />
        </div>
      </div>
    );
  }
}
