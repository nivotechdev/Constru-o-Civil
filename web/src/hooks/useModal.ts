// X05: what every dialog, sheet and full-screen viewer does for keyboard and screen-reader users — focus
// moves into it when it opens, Tab stays inside, Esc closes it, and focus goes back to what opened it.
// Only the top-most open one answers (a confirmation over a sheet closes first).
import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: HTMLElement[] = [];

// U69: while any dialog, sheet or full-screen viewer is open, the page behind it does not scroll (a finger on the
// sheet used to move the mural behind it, and the sheet drifted up with it). Counted, so nested ones share one lock.
let scrollLocks = 0;
function lockPageScroll(): () => void {
  const root = document.documentElement;
  if (scrollLocks++ === 0) {
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
  }
  return () => {
    if (--scrollLocks > 0) return;
    root.style.overflow = '';
    root.style.overscrollBehavior = '';
  };
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/** Put the returned ref on the dialog box (give it tabIndex={-1}). */
export function useModal<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const node = ref.current;
    if (!open || !node) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(node);
    // A field marked autofocus inside keeps it; otherwise the box itself (its title is read first).
    if (!node.contains(document.activeElement)) node.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== node) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables(node);
      if (!items.length) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const unlock = lockPageScroll();
    return () => {
      unlock();
      document.removeEventListener('keydown', onKey, true);
      const i = stack.lastIndexOf(node);
      if (i >= 0) stack.splice(i, 1);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
