import { useLayoutEffect, useRef, type ChangeEvent } from 'react';

// AUD-089: a field with autoFocus takes the focus when it appears, so a new step of a form (the WhatsApp code, the
// e-mail code) brings the keyboard up. It never takes the focus from someone who is already typing somewhere else.
// (The browser's own rule, "only the first autofocus of a document", left the later steps without a cursor.)

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
    if (!autoFocus) return;
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
