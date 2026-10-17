import { h, rem } from '../dom.js';
import { ICON_DATA } from './iconData.js';

// Same technique the source design system specified: Lucide's SVGs, loaded as a CSS
// mask over `currentColor` so the icon inherits text color (including inside a filled
// button) with zero inline SVG markup and zero JS icon bundle. The SVGs themselves are
// vendored locally (see icons/, scripts/gen-icons.cjs) and inlined here as data: URIs —
// not referenced by path — because `mask-image`/`-webkit-mask-image` triggers a CORS
// check even for same-directory files when the page is opened via file://, unlike a
// plain <img src>. A data: URI has no such restriction under any origin.

// Google's official multi-color "G" mark (as widely embedded in "Sign in with Google"
// buttons) — a real color mark rather than a currentColor glyph, so it's built as its
// own inline SVG instead of going through the mask-image technique above.
const GOOGLE_G_SVG = `<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
  <path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.6154z"/>
  <path fill="#34A853" d="M9 18c2.43 0 4.4673-.8064 5.9564-2.1805l-2.9087-2.2581c-.8064.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5831-5.0359-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/>
  <path fill="#FBBC05" d="M3.9641 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.9641 10.71z"/>
  <path fill="#EA4335" d="M9 3.5782c1.3214 0 2.5077.4541 3.4405 1.346l2.5818-2.5818C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.9641 7.29C4.6718 5.1627 6.6559 3.5782 9 3.5782z"/>
</svg>`;

export function GoogleIcon({ size = 20 } = {}) {
  const el = h('span', { class: 'shrink-0 inline-flex', style: { width: rem(size), height: rem(size) } });
  el.innerHTML = GOOGLE_G_SVG;
  el.firstElementChild.setAttribute('width', '100%');
  el.firstElementChild.setAttribute('height', '100%');
  return el;
}

export function Icon(name, { size = 20, color, className = '', label } = {}) {
  const url = ICON_DATA[name];
  const el = h('span', {
    class: `icon shrink-0 ${className}`,
    style: {
      width: rem(size),
      height: rem(size),
      WebkitMaskImage: url ? `url("${url}")` : 'none',
      maskImage: url ? `url("${url}")` : 'none',
      color: color || 'currentColor'
    }
  });
  if (!url) el.style.backgroundColor = 'transparent';
  if (label) {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', label);
  } else {
    el.setAttribute('aria-hidden', 'true');
  }
  return el;
}
