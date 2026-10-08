// Minimal hash router — a typed port of the legacy app/js/router.js, with the same semantics:
// routes live in the URL hash (#/mural), and an in-app back stack (independent of the browser's own
// history, which is unreliable inside an embedded/iframed viewer) lets goBack() return to wherever
// the user actually came from.

export type Params = Record<string, string>;

interface Location {
  path: string;
  /** Increments on every route dispatch, even one that lands on the same path. */
  seq: number;
}

const backStack: string[] = [];
const listeners = new Set<() => void>();
let location_: Location | null = null;

export function currentPath(): string {
  const h = window.location.hash.slice(1);
  return h || '/';
}

export function getLocation(): Location {
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
  if (replace) {
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

function dispatch(): void {
  location_ = { path: currentPath(), seq: getLocation().seq + 1 };
  listeners.forEach((fn) => fn());
}

let started = false;
export function startRouter(): void {
  if (started) return;
  started = true;
  window.addEventListener('hashchange', dispatch);
}

// ---- route matching ----

export interface CompiledRoute<T> {
  pattern: string;
  regex: RegExp;
  keys: string[];
  value: T;
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
        params[k] = decodeURIComponent(m[i + 1]);
      });
      return { route: r, params };
    }
  }
  return null;
}
