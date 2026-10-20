// U21: light or dark theme, chosen in Configurações › Aparência. It belongs to this device (like the app's own
// settings on a phone), kept in its storage so the app opens in the same theme. The theme is the
// `data-theme` attribute of <html>; the colours themselves live in styles/tokens.css.
export type Theme = 'claro' | 'escuro';

const KEY = 'bicos-tema';
/** The phone's status bar: the brand blue in the light theme, the page colour in the dark one. */
const BAR = { claro: '#1D4BED', escuro: '#0D121B' } as const;

const listeners = new Set<() => void>();
let current: Theme = read();

function read(): Theme {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'escuro' ? 'escuro' : 'claro';
  } catch {
    return 'claro';
  }
}

function apply(theme: Theme): void {
  const root = globalThis.document?.documentElement;
  if (!root) return;
  if (theme === 'escuro') root.dataset.theme = 'dark';
  else delete root.dataset.theme;
  root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
}

/** Puts the saved theme on the page; called once, before the first screen. */
export function applySavedTheme(): void {
  current = read();
  apply(current);
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  if (theme === current) return;
  current = theme;
  try {
    globalThis.localStorage?.setItem(KEY, theme);
  } catch {
    // Without storage the theme lasts until the app is closed.
  }
  apply(theme);
  listeners.forEach((fn) => fn());
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
