import { useLayoutEffect, useRef, type ChangeEvent } from 'react';

// Browsers only honour `autofocus` for the first such element a document ever sees; later ones are
// ignored. The legacy app relied on that native behaviour (its fields were plain DOM nodes with the
// attribute), so it's emulated here instead of React's autoFocus, which focuses on every mount.
let autofocusProcessed = false;

type Field = HTMLInputElement | HTMLTextAreaElement;

/**
 * Wiring shared by every controlled text field: keeps the caret where it was when the value is
 * reformatted on input (CPF/CNPJ/phone masks, digits-only fields) — at the end if it was at the end — and
 * applies the once-per-document autofocus rule above.
 */
export function useTextField<T extends Field>(onValue: ((value: string) => void) | undefined, autoFocus = false) {
  const ref = useRef<T>(null);
  // Caret to restore after a re-format: a position, or 'end' when the user was typing at the end.
  const selection = useRef<[number | null, number | null] | 'end' | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const sel = selection.current;
    selection.current = null;
    if (!el || !sel || document.activeElement !== el) return;
    const [start, end] = sel === 'end' ? [el.value.length, el.value.length] : sel;
    if (typeof start !== 'number') return;
    try {
      el.setSelectionRange(start, end);
    } catch {
      /* not a text-selectable input */
    }
  });

  useLayoutEffect(() => {
    if (!autoFocus || autofocusProcessed) return;
    autofocusProcessed = true;
    const active = document.activeElement;
    if (!active || active === document.body) ref.current?.focus();
  }, [autoFocus]);

  const onChange = (e: ChangeEvent<T>) => {
    const { selectionStart, selectionEnd, value } = e.target;
    // Typing at the end stays at the end even when a mask adds characters ("(11) 9…", "123.4…").
    selection.current = selectionStart === value.length ? 'end' : [selectionStart, selectionEnd];
    if (onValue) onValue(e.target.value);
  };

  return [ref, onChange] as const;
}
