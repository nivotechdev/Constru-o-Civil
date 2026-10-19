// Minimal hash router: no history/query complexity needed — screen-local ephemeral
// state (search text, wizard step, open sheets) lives in the store's `ui` bag instead
// of the URL, so every route change is a real navigation.
const routes = [];
let onChange = null;

// In-app back stack (independent of the browser's own history, which is unreliable
// inside an embedded/iframed viewer): every non-replace navigate() records the path
// it left, so goBack() can return to wherever the user actually came from.
const backStack = [];

export function route(pattern, handler) {
  const keys = [];
  const regexStr = pattern.replace(/:[^/]+/g, (m) => {
    keys.push(m.slice(1));
    return '([^/]+)';
  });
  routes.push({ pattern, handler, regex: new RegExp('^' + regexStr + '$'), keys });
}

export function onRouteChange(fn) { onChange = fn; }

export function currentPath() {
  const h = location.hash.slice(1);
  return h || '/';
}

export function match(path) {
  for (const r of routes) {
    const m = r.regex.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { handler: r.handler, params, pattern: r.pattern };
    }
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  if (!replace) {
    const from = currentPath();
    if (from !== path) backStack.push(from);
  }
  if (replace) {
    history.replaceState(null, '', location.pathname + location.search + '#' + path);
    dispatch();
  } else {
    location.hash = path;
  }
}

/** Returns to wherever the user actually came from; falls back only when there's no recorded history (e.g. a fresh deep link). */
export function goBack(fallback = '/mural') {
  const prev = backStack.pop();
  navigate(prev || fallback, { replace: true });
}

function dispatch() {
  const path = currentPath();
  const m = match(path);
  if (onChange) onChange(m, path);
}

export function startRouter() {
  window.addEventListener('hashchange', dispatch);
  dispatch();
}
