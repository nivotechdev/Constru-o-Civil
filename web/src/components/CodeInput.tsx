// The 6-number code field (the WhatsApp code in the sign-up, the e-mail code — U11). One real input
// (typing, pasting the whole code at once, backspace and the phone's "código" autofill work natively)
// laid over six boxes that show the digits. Where the browser lets the page read the clipboard, "Colar código" fills it in one
// tap from what was copied in the e-mail.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../utils/cx';
import { FieldError } from './FieldError';
import { Icon } from './icons/Icon';
import { CODE_LENGTH, codeFrom } from '../utils/code';

interface CodeInputProps {
  /** id of the (visually hidden) input, so the screen can focus it. */
  id: string;
  label: string;
  code: string;
  error?: string | null;
  onCode: (code: string) => void;
  onEnter?: () => void;
  /** Shows "Colar código" (reads the clipboard; when it can't, puts the caret in the field to paste). */
  pasteButton?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function CodeInput({
  id,
  label,
  code,
  error,
  onCode,
  onEnter,
  pasteButton = false,
  autoFocus = false,
  disabled = false
}: CodeInputProps) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && onEnter) {
      e.preventDefault();
      onEnter();
    }
  };
  const canReadClipboard = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText);
  async function paste() {
    try {
      const pasted = codeFrom(await navigator.clipboard.readText());
      if (pasted) {
        onCode(pasted);
        return;
      }
    } catch {
      /* no permission: the field gets the caret so the phone's own "Colar" works */
    }
    ref.current?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-concrete-900">
        {label}
      </label>
      <div className="relative">
        <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden="true">
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const current = focused && (i === code.length || (i === CODE_LENGTH - 1 && code.length === CODE_LENGTH));
            return (
              <span
                key={i}
                className={cx(
                  'flex items-center justify-center h-14 sm:h-16 rounded-control border-2 bg-concrete-0 font-mono font-bold text-2xl text-concrete-900 transition-colors',
                  disabled && 'bg-concrete-50 text-concrete-500',
                  error
                    ? 'border-danger-500'
                    : current
                      ? 'border-brand-500 ring-4 ring-brand-100'
                      : code[i]
                        ? 'border-concrete-400'
                        : 'border-concrete-300'
                )}
              >
                {code[i] || ''}
              </span>
            );
          })}
        </div>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          value={code}
          disabled={disabled}
          aria-label={`${label}: ${CODE_LENGTH} números`}
          aria-invalid={error ? 'true' : undefined}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text"
          // Pasting "123 456" or a whole sentence keeps just the code.
          onPaste={(e) => {
            const pasted = codeFrom(e.clipboardData.getData('text'));
            if (pasted) {
              e.preventDefault();
              onCode(pasted);
            }
          }}
          onChange={(e) => onCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      {error ? <FieldError message={error} /> : null}
      {pasteButton && canReadClipboard ? (
        <button
          type="button"
          disabled={disabled}
          className="self-start inline-flex items-center gap-1.5 h-10 px-3 -ml-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60"
          onClick={() => void paste()}
        >
          <Icon name="copy" size={16} />
          Colar código
        </button>
      ) : null}
    </div>
  );
}
