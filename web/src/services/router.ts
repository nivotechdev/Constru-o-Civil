// Minimal router — a typed port of the legacy archive/app/js/router.js, with the same semantics plus real URLs
// (X17): served over HTTP the routes are paths (`/vaga/BC-1`, shareable and indexable; the server answers
// every path with index.html), while the standalone preview opened from disk (file://) keeps them in the
// hash (`#/vaga/BC-1`). An in-app back stack (independent of the browser's own history, which is
// unreliable inside an embedded/iframed viewer) lets goBack() return to wherever the user came from.
// U45: the phone's back button and the app's back arrow walk the same history — each entry the router creates says
// where it came from and how deep the back stack was, so goBack() uses the browser's own back when it can and the
// back button keeps the stack right; a screen with inner steps (the sign-up's questions) holds one extra entry, so
// the back button goes back one step; and while something is loading (services/busy.ts) the back button waits.
import { isBusy } from './busy';

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

/** What the router keeps in each browser entry it creates. */
interface EntryState {
  /** The back stack's size on this entry (kept right when the back/forward buttons move through entries). */
  depth?: number;
  /** The route the entry was opened from: goBack() can then be the browser's own back. */
  from?: string;
  /** U45: the extra entry of a screen with inner steps (see holdBack). */
  inner?: boolean;
}

function entryState(): EntryState {
  const state: unknown = globalThis.history?.state;
  return state && typeof state === 'object' ? (state as EntryState) : {};
}

/** The entry being shown (to put it back when the back button is pressed while loading). */
let shown: { state: EntryState; url: string } | null = null;
function remember(): void {
  const loc = window.location;
  shown = { state: entryState(), url: loc.pathname + loc.search + loc.hash };
}

/** A back/forward the app itself asked for (goBack, releaseBack): never held by the loading lock. */
let ownTraversal = false;
function traverse(delta: number): void {
  ownTraversal = true;
  // A traversal that finds no entry fires nothing: the flag doesn't outlive it.
  setTimeout(() => (ownTraversal = false), 1500);
  history.go(delta);
}

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
  const from = currentPath();
  if (!replace && from !== path) backStack.push(from);
  if (usesPaths()) {
    if (replace) history.replaceState({ depth: backStack.length, from: entryState().from }, '', prefix() + path);
    else history.pushState({ depth: backStack.length, from: from !== path ? from : undefined }, '', prefix() + path);
    remember();
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
  const prev = backStack[backStack.length - 1];
  // U45: the browser's previous entry is that screen: go back to it (the back button then stays in step).
  const here = entryState();
  if (prev && usesPaths() && here.from === prev && !here.inner) {
    traverse(-1);
    return;
  }
  backStack.pop();
  navigate(prev || fallback, { replace: true });
}

/**
 * U45: a screen with inner steps (the sign-up's questions, "Trocar e-mail"): while there is a step to go back to,
 * one extra entry of the same route sits on top, so the phone's back button lands on the screen's own entry — the
 * screen sees it (`subscribe`, `isInnerEntry() === false`) and goes back one step instead of leaving.
 */
export function holdBack(): void {
  if (!usesPaths() || entryState().inner) return;
  history.pushState({ ...entryState(), inner: true }, '');
  remember();
}

/** U45: no step left to go back to: the extra entry goes away (the back button leaves the screen again). */
export function releaseBack(): void {
  if (usesPaths() && entryState().inner) traverse(-1);
}

export function isInnerEntry(): boolean {
  return Boolean(entryState().inner);
}

/** Forgets the back stack (after signing out, "back" must not return into the account). */
export function resetHistory(): void {
  backStack.length = 0;
}

function dispatch(): void {
  location_ = { path: currentPath(), seq: getLocation().seq + 1 };
  listeners.forEach((fn) => fn());
}

/** The back/forward buttons (and the app's own history.go). */
function onPopState(): void {
  const own = ownTraversal;
  ownTraversal = false;
  // U45: something is loading (entering with Google, creating the account…): the back button waits.
  if (isBusy() && !own && shown) {
    history.pushState(shown.state, '', shown.url);
    return;
  }
  const { depth, from } = entryState();
  if (typeof depth === 'number') {
    if (depth < backStack.length) backStack.length = depth;
    else if (depth > backStack.length && from) backStack.push(from);
  }
  remember();
  dispatch();
}

let started = false;
export function startRouter(): void {
  if (started) return;
  started = true;
  if (usesPaths()) {
    if (window.location.hash.startsWith('#/')) replaceUrl(currentPath());
    // U45: the first entry too says how deep the back stack is (the back button may come back to it).
    if (typeof entryState().depth !== 'number') {
      const loc = window.location;
      history.replaceState({ ...entryState(), depth: 0 }, '', loc.pathname + loc.search + loc.hash);
    }
    remember();
    window.addEventListener('popstate', onPopState);
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
