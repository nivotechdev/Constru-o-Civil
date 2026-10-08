import { useLayoutEffect, useSyncExternalStore } from 'react';
import { getVersion, subscribe } from '../services/store';

// Page scroll right before each store change (this listener is registered before any component's).
let scrollBefore = 0;
subscribe(() => {
  scrollBefore = window.scrollY;
});

/**
 * The legacy app re-created the whole screen's DOM on every state change. React updates the DOM in
 * place instead, which changes a few micro-interactions; after each store change this component puts
 * them back exactly as they were:
 *
 * 1. Focus: only a field with a stable `data-focus-id` (text inputs and textareas with an id) kept its
 *    focus across the rebuild; anything else — a button just clicked, a select, a checkbox — lost it
 *    (otherwise e.g. the password "eye" button would stay focused and light up its field's ring).
 * 2. CSS transitions never ran on a state change (new elements start in their final state): the
 *    sign-up progress bar, the password meter, switches and checkboxes jump instead of animating.
 * 3. Entrance animations (sheets, dialogs, the account menu) restarted on every change made inside them.
 * 4. A sheet's inner scroll went back to the top.
 *    The field that kept its focus was focused again, which scrolls it into view when it isn't fully
 *    visible.
 * 5. The page didn't scroll-anchor: content growing above the viewport (e.g. validation messages)
 *    pushed what was on screen down, instead of the browser compensating the scroll position.
 *
 * Removing this component from App.tsx gives the smoother React behaviour; nothing else depends on it.
 */
function fullyVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
}

export function LegacyRerender() {
  const version = useSyncExternalStore(subscribe, getVersion);
  useLayoutEffect(() => {
    const app = document.getElementById('app');
    if (!version || !app) return;

    const active = document.activeElement;
    const keepsFocus = active instanceof HTMLElement && app.contains(active) && active.hasAttribute('data-focus-id');
    if (active instanceof HTMLElement && app.contains(active) && !keepsFocus) active.blur();

    document.documentElement.classList.add('legacy-rerender');
    void app.offsetWidth; // apply the new styles with transitions and scroll anchoring off
    document.documentElement.classList.remove('legacy-rerender');
    if (window.scrollY !== scrollBefore) window.scrollTo(0, scrollBefore);
    // The legacy app re-focused the rebuilt field, and focus() brings a field that isn't fully visible
    // into view.
    if (keepsFocus && !fullyVisible(active)) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    for (const animation of app.getAnimations({ subtree: true })) {
      if (animation instanceof CSSAnimation) {
        animation.currentTime = 0;
        animation.play();
      }
    }
    app.querySelectorAll('.overflow-y-auto').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [version]);
  return null;
}
