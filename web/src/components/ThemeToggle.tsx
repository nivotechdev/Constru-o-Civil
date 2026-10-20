// U21: the light/dark switch of Configurações › Aparência — a pill with the sun on the left and the moon on the
// right, and a ball resting on the theme in use. Tapping a side (or anywhere, with the ball on the other one) rolls
// the ball there: it travels and makes one full turn — so the icon always lands upright — with a small overshoot at
// the end, while its icon changes from the sun to the moon. For screen readers and keyboards it
// is a pair of radio buttons ("Tema claro", "Tema escuro"; arrows switch). No motion when the phone asks for less.
import { useSyncExternalStore, type KeyboardEvent } from 'react';
import { getTheme, setTheme, subscribeTheme, type Theme } from '../services/theme';
import { cx } from '../utils/cx';

// Track 84 × 44 px (the whole pill is touchable), padding 4 px, ball 36 px → it travels 40 px.
const TRAVEL = 40;
/** One full turn: it reads as rolling and the icon ends upright. */
const TURN = 360;
const ROLL = 'cubic-bezier(0.34, 1.32, 0.64, 1)';

function Sun({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function Moon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);
  const dark = theme === 'escuro';

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setTheme('claro');
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setTheme('escuro');
    else return;
    e.preventDefault();
  }

  const side = (value: Theme, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={theme === value}
      aria-label={label}
      tabIndex={theme === value ? 0 : -1}
      onClick={() => setTheme(theme === value ? (value === 'claro' ? 'escuro' : 'claro') : value)}
      onKeyDown={onKey}
      className="relative z-20 flex-1 h-full rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-concrete-0"
    />
  );

  return (
    <div
      role="radiogroup"
      aria-label="Tema do aplicativo"
      className={cx(
        'relative inline-flex w-[5.25rem] h-11 p-1 rounded-full shrink-0 select-none',
        'border transition-colors duration-300 motion-reduce:transition-none',
        dark ? 'bg-brand-50 border-brand-200' : 'bg-concrete-100 border-concrete-200'
      )}
    >
      {/* The two icons on the track, faint: they show where the ball can go. */}
      <span className="absolute inset-y-0 left-1 w-9 flex items-center justify-center text-concrete-400">
        <Sun className="w-[1.125rem] h-[1.125rem]" />
      </span>
      <span className="absolute inset-y-0 right-1 w-9 flex items-center justify-center text-concrete-400">
        <Moon className="w-4 h-4" />
      </span>

      {/* The ball. */}
      <span
        aria-hidden="true"
        className={cx(
          'absolute top-1 left-1 z-10 w-9 h-9 rounded-full flex items-center justify-center',
          'shadow-[0_1px_2px_rgba(16,20,24,.18),0_3px_8px_rgba(16,20,24,.16)]',
          'transition-[transform,background-color] motion-reduce:transition-none',
          dark ? 'bg-brand-500' : 'bg-concrete-0'
        )}
        style={{
          transform: `translateX(${dark ? TRAVEL : 0}px) rotate(${dark ? TURN : 0}deg)`,
          transitionDuration: '520ms, 300ms',
          transitionTimingFunction: `${ROLL}, ease`
        }}
      >
        <Sun
          className={cx(
            'absolute w-5 h-5 text-[#F2A007] transition-opacity duration-200 motion-reduce:transition-none',
            dark ? 'opacity-0' : 'opacity-100 delay-150'
          )}
        />
        <Moon
          className={cx(
            'absolute w-[1.125rem] h-[1.125rem] text-white transition-opacity duration-200 motion-reduce:transition-none',
            dark ? 'opacity-100 delay-150' : 'opacity-0'
          )}
        />
      </span>

      {side('claro', 'Tema claro')}
      {side('escuro', 'Tema escuro')}
    </div>
  );
}
