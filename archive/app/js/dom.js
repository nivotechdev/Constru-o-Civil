// Minimal hyperscript-style DOM helper. No framework — just less boilerplate than
// raw createElement/appendChild calls when composing components out of components.
export function h(tag, props, ...children) {
  const parts = tag.split('.');
  const tagName = parts[0] || 'div';
  const classes = parts.slice(1);
  const el = document.createElement(tagName);
  if (classes.length) el.className = classes.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        el.className = el.className ? el.className + ' ' + v : v;
      } else if (k.startsWith('on') && typeof v === 'function') {
        el.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k === 'style' && typeof v === 'object') {
        Object.assign(el.style, v);
      } else if (k === 'html') {
        el.innerHTML = v;
      } else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') {
        el[k] = v;
      } else {
        el.setAttribute(k, v);
      }
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function mount(el, ...children) {
  clear(el);
  appendChildren(el, children);
  return el;
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

// Design sizes are authored as familiar px-equivalent numbers (matching the source
// design system's scale, e.g. icon size 20) but every emitted CSS length is rem.
export function rem(px) {
  return (px / 16) + 'rem';
}

export function frag(...children) {
  const f = document.createDocumentFragment();
  appendChildren(f, children);
  return f;
}
