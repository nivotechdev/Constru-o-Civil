// Minimal router — a typed port of the legacy archive/app/js/router.js, with the same semantics plus real URLs
// (X17): served over HTTP the routes are paths (`/vaga/BC-1`, shareable and indexable; the server answers
// every path with index.html), while the standalone preview opened from disk (file://) keeps them in the
// hash (`#/vaga/BC-1`). An in-app back stack (independent of the browser's own history, which is
// unreliable inside an embedded/iframed viewer) lets goBack() return to wherever the user came from.

/** Where the app lives on the server: `/` (or VITE_BASE); `./` in the standalone preview. */
const BASE = (import.meta.env?.BASE_URL as string | undefined) ?? '/';

/** Paths in the URL (History API) unless the page was opened from disk or built for it. */
export function usesPaths(loc: Pick<Location, 'protocol'> | undefined = globalThis.location): boolean {
  return Boolean(loc) && BASE.startsWith('/') && /^https?:$/.test(loc!.protocol);
}

/** The prefix in front of a route: `/` for the root, `/app/` when served under a folder. */
const prefix = () => BASE.replace(/\/+$/, '');

/** The URL of a route in this app (for a link, a share or the Auth redirect). */
export function routeUrl(
  path: string,
  loc: Pick<Location, 'origin' | 'pathname' | 'protocol'> = window.location
): string {
  return usesPaths(loc) ? `${loc.origin}${prefix()}${path}` : `${loc.origin}${loc.pathname}#${path}`;
}

/** Replaces the address bar with a route without dispatching (used before the router starts). */
export function replaceUrl(path: string): void {
  const loc = window.location;
  history.replaceState(null, '', usesPaths(loc) ? prefix() + path : loc.pathname + loc.search + '#' + path);
}

export type Params = Record<string, string>;

interface RouteState {
  path: string;
  /** Increments on every route dispatch, even one that lands on the same path. */
  seq: number;
}

const backStack: string[] = [];
const listeners = new Set<() => void>();
let location_: RouteState | null = null;

export function currentPath(): string {
  const loc = window.location;
  const h = loc.hash.slice(1);
  if (!usesPaths(loc)) return h || '/';
  // An old link (`/#/vaga/BC-1`) still opens; startRouter() rewrites it as a path.
  if (h.startsWith('/')) return h;
  const p = loc.pathname.startsWith(prefix()) ? loc.pathname.slice(prefix().length) : loc.pathname;
  return p.replace(/\/+$/, '') || '/';
}

export function getLocation(): RouteState {
  if (!location_) location_ = { path: currentPath(), seq: 0 };
  return location_;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function navigate(path: string, { replace = false }: { replace?: boolean } = {}): void {
  if (!replace) {
    const from = currentPath();
    if (from !== path) backStack.push(from);
  }
  if (usesPaths()) {
    if (replace) history.replaceState(null, '', prefix() + path);
    else history.pushState(null, '', prefix() + path);
    dispatch();
  } else if (replace) {
    history.replaceState(null, '', window.location.pathname + window.location.search + '#' + path);
    dispatch();
  } else {
    window.location.hash = path;
  }
}

/** Returns to wherever the user actually came from; falls back only when there's no recorded history (e.g. a fresh deep link). */
export function goBack(fallback = '/mural'): void {
  const prev = backStack.pop();
  navigate(prev || fallback, { replace: true });
}

/** Forgets the back stack (after signing out, "back" must not return into the account). */
export function resetHistory(): void {
  backStack.length = 0;
}

function dispatch(): void {
  location_ = { path: currentPath(), seq: getLocation().seq + 1 };
  listeners.forEach((fn) => fn());
}

let started = false;
export function startRouter(): void {
  if (started) return;
  started = true;
  if (usesPaths()) {
    if (window.location.hash.startsWith('#/')) replaceUrl(currentPath());
    window.addEventListener('popstate', dispatch);
  } else window.addEventListener('hashchange', dispatch);
}

// ---- route matching ----

export interface CompiledRoute<T> {
  pattern: string;
  regex: RegExp;
  keys: string[];
  value: T;
}

/** A malformed "%" in a link (e.g. "/vaga/50%") is kept as typed instead of crashing the app (Z10). */
export function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function compileRoute<T>(pattern: string, value: T): CompiledRoute<T> {
  const keys: string[] = [];
  const regexStr = pattern.replace(/:[^/]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  });
  return { pattern, regex: new RegExp('^' + regexStr + '$'), keys, value };
}

export function matchRoute<T>(
  routes: CompiledRoute<T>[],
  path: string
): { route: CompiledRoute<T>; params: Params } | null {
  for (const r of routes) {
    const m = r.regex.exec(path);
    if (m) {
      const params: Params = {};
      r.keys.forEach((k, i) => {
        params[k] = safeDecode(m[i + 1]);
      });
      return { route: r, params };
    }
  }
  return null;
}
