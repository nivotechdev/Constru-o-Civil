// U09/U41: the full-screen flows of getting an account (choosing the side, the sign-up, the e-mail code,
// completing the profile). The page is exactly the visible height — `100dvh`: on phones `100vh` also
// counts the browser bars, which pushed the button under the system buttons — with the header on top,
// the actions always at the bottom, above the phone's own buttons (the safe area), and the middle sized so
// that it never scrolls: on short screens (`short:`, up to 719 px tall) the spacing and the titles tighten.
// The middle keeps scrolling only as a last resort (a phone smaller than 360×600, or a huge font size), so no
// field is ever out of reach. scripts/sem-rolagem.mjs checks every screen. From the desktop layout up it is a
// centred card.
import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import { IconButton } from './IconButton';

export function FlowLayout({
  header,
  children,
  footer,
  className
}: {
  header?: ReactNode;
  children: ReactNode;
  /** The actions (main button first); fixed at the bottom. */
  footer?: ReactNode;
  /** Extra classes for the scrolling middle (its padding and gaps). */
  className?: string;
}) {
  return (
    <div className="flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-concrete-0 lg:h-[calc(100vh-5rem)] lg:supports-[height:100dvh]:h-[calc(100dvh-5rem)] lg:max-w-app lg:mx-auto lg:my-10 lg:rounded-card lg:shadow-card">
      {header ? <div className="shrink-0 bg-concrete-0 border-b border-concrete-200">{header}</div> : null}
      <main
        className={cx(
          'flex-1 min-h-0 overflow-y-auto overscroll-none bg-concrete-50 px-5 sm:px-8 py-7 flex flex-col gap-6 short:py-5 short:gap-4',
          className
        )}
      >
        {children}
      </main>
      {footer ? (
        <div className="shrink-0 bg-concrete-0 shadow-bar px-5 sm:px-8 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-2 short:pt-2.5 short:gap-1.5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** "Passo 2 de 6" with the way back and the progress bar, for the header of a FlowLayout. */
export function FlowProgress({ step, total, onBack }: { step: number; total: number; onBack?: () => void }) {
  return (
    <div className="px-2 pb-3 short:pb-2">
      <div className="flex items-center gap-1.5 min-h-14 short:min-h-12">
        {onBack ? <IconButton icon="arrow-left" label="Voltar" onClick={onBack} /> : <span className="w-11 h-11" />}
        <span className="flex-1 text-sm font-semibold text-concrete-500">{`Passo ${step + 1} de ${total}`}</span>
      </div>
      <div className="h-1 mx-2 rounded-full bg-concrete-200 overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-200"
          style={{ width: ((step + 1) / total) * 100 + '%' }}
        />
      </div>
    </div>
  );
}

/**
 * U14: the way back and the screen's name, for the header of a FlowLayout — the same geometry as FlowProgress
 * (the arrow in its full 44 px circle, then the title). BackBar is for the app's pages: from the desktop layout
 * up it pulls itself 12 px to the left, which inside this card cut the arrow at the edge. U41: without a way back
 * (the e-mail code, completing the profile) the title starts at the edge; `action` goes on the right ("Sair").
 */
export function FlowBar({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <div className={cx('flex items-center gap-1.5 min-h-14 short:min-h-12', onBack ? 'px-2' : 'pl-5 sm:pl-8 pr-2')}>
      {onBack ? <IconButton icon="arrow-left" label="Voltar" onClick={onBack} /> : null}
      <span className="flex-1 min-w-0 font-display font-semibold text-xl text-concrete-900 truncate">{title}</span>
      {action}
    </div>
  );
}

/** U41: "Sair" on the right of a FlowBar — the way out for whoever entered the wrong account (Y26). */
export function FlowSignOut({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative tap-target shrink-0 h-10 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      Sair
    </button>
  );
}

/** The overline, question and help text at the top of a step. */
export function FlowHeading({ overline, title, help }: { overline: string; title: string; help?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 short:gap-1.5">
      <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{overline}</span>
      <h1 className="font-display font-bold text-3xl text-concrete-900 short:text-[1.625rem] short:leading-tight">
        {title}
      </h1>
      {help ? <p className="text-base text-concrete-700 short:text-[0.9375rem] short:leading-snug">{help}</p> : null}
    </div>
  );
}
