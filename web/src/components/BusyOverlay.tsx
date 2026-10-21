// U45: what the app shows while it is locked (services/busy.ts). With a message: the dimmed screen and a card with
// a spinner (and, while waiting on the Google window, "Cancelar"); the app behind it is `inert` (no tap, no focus).
// Without one: an invisible layer over everything — the button that was pressed already shows its own spinner.
// Either way the keys don't reach the app, and the phone's back button waits (services/router.ts).
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getBusy, subscribeBusy } from '../services/busy';
import { Button } from './Button';

export function BusyOverlay() {
  const busy = useSyncExternalStore(subscribeBusy, getBusy, getBusy);
  const card = useRef<HTMLDivElement>(null);
  const mode = !busy ? 'off' : busy.message ? 'card' : 'layer';

  // The app behind: busy for assistive technology; with the card, also out of reach (focus comes back after).
  useEffect(() => {
    const app = document.getElementById('app');
    if (!app || mode === 'off') return;
    app.setAttribute('aria-busy', 'true');
    if (mode === 'layer') return () => app.removeAttribute('aria-busy');
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    app.inert = true;
    card.current?.focus();
    return () => {
      app.inert = false;
      app.removeAttribute('aria-busy');
      if (focused?.isConnected) focused.focus({ preventScroll: true });
    };
  }, [mode]);

  // Keys (Enter, space, Esc…) don't reach the app while it is locked; Tab still moves inside the card.
  useEffect(() => {
    if (mode === 'off') return;
    const stop = (e: KeyboardEvent) => {
      if (e.target instanceof Node && card.current?.contains(e.target)) return;
      if (e.key === 'Tab') return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', stop, true);
    return () => window.removeEventListener('keydown', stop, true);
  }, [mode]);

  if (!busy) return null;
  return createPortal(
    busy.message ? (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-6 animate-fade-in"
        style={{ background: 'var(--scrim)' }}
      >
        <div
          ref={card}
          tabIndex={-1}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="carregando-titulo"
          aria-describedby={busy.detail ? 'carregando-detalhe' : undefined}
          className="outline-none w-full max-w-xs bg-concrete-0 rounded-card shadow-raised px-6 py-7 flex flex-col items-center gap-3 text-center"
        >
          <span
            className="animate-spin-token w-9 h-9 rounded-full border-[3px] border-brand-500 border-r-transparent"
            aria-hidden="true"
          />
          <p id="carregando-titulo" role="status" className="font-display font-semibold text-xl text-concrete-900">
            {busy.message}
          </p>
          {busy.detail ? (
            <p id="carregando-detalhe" className="text-sm text-concrete-500">
              {busy.detail}
            </p>
          ) : null}
          {busy.cancel ? (
            <Button
              label={busy.cancel.label}
              variant="secondary"
              fullWidth
              className="mt-2"
              onClick={busy.cancel.onCancel}
            />
          ) : null}
        </div>
      </div>
    ) : (
      // Invisible: catches every tap while the pressed button shows its spinner.
      <div className="fixed inset-0 z-[70] cursor-progress" aria-hidden="true" />
    ),
    document.body
  );
}
