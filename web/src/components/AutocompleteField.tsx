// U51: a text field that suggests real values while the person types (city, street with its CEP, neighbourhood) — the
// WAI-ARIA combobox: arrows move through the list, Enter picks, Esc closes; a tap on a suggestion picks it. Typing
// freely still works (a suggestion is a help, not a must). The list opens above the field when there is no room
// below (the phone's keyboard takes half the screen).
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTextField } from '../hooks/useTextField';
import { cx } from '../utils/cx';
import { FieldError } from './FieldError';
import { Icon, type IconName } from './icons/Icon';

export interface Suggested<T> {
  items: T[];
  /** Who the data is from, shown under the list when the source asks for it ("Dados © OpenStreetMap"). */
  credit?: string;
}

interface AutocompleteFieldProps<T> {
  id: string;
  label: string;
  placeholder?: string;
  icon?: IconName;
  value: string;
  onInput: (value: string) => void;
  /** The suggestions for what was typed; called a moment after typing stops, the older call cancelled. */
  load: (typed: string, signal: AbortSignal) => Promise<Suggested<T>> | Suggested<T>;
  /** Letters before suggesting. */
  minChars?: number;
  optionKey: (item: T) => string;
  optionLabel: (item: T) => string;
  /** The second line of a suggestion ("Centro · 95020-000"). */
  optionDetail?: (item: T) => string | null;
  onChoose: (item: T) => void;
  /** Said in the list when nothing matches ("Nenhuma rua com esse nome."). */
  emptyText?: string;
  error?: string | null;
  hint?: ReactNode;
  inputMode?: 'text' | 'numeric';
  maxLength?: number;
  autoComplete?: string;
  /** Not searchable yet (e.g. the street before the city): the reason, said when the field is focused. */
  waitingText?: string | null;
}

type Status = 'idle' | 'loading' | 'ready' | 'error';
const LIST_MAX_PX = 264;

export function AutocompleteField<T>({
  id,
  label,
  placeholder = '',
  icon,
  value,
  onInput,
  load,
  minChars = 2,
  optionKey,
  optionLabel,
  optionDetail,
  onChoose,
  emptyText = 'Nenhuma sugestão. Pode continuar digitando.',
  error,
  hint,
  inputMode,
  maxLength,
  autoComplete = 'off',
  waitingText = null
}: AutocompleteFieldProps<T>) {
  const listId = useId() + '-lista';
  const messageId = id + '-msg';
  const [fieldRef, handleChange] = useTextField<HTMLInputElement>(onInput);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<Suggested<T>>({ items: [] });
  const [active, setActive] = useState(-1);
  const [above, setAbove] = useState(false);
  const typedRef = useRef<string | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(
    () => () => {
      ctl.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  // Only what the person types searches (not a value put there by a CEP or a choice).
  function search(typed: string) {
    typedRef.current = typed;
    ctl.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    setActive(-1);
    if (waitingText || typed.trim().length < minChars) {
      setStatus('idle');
      setResult({ items: [] });
      return;
    }
    setStatus('loading');
    timer.current = setTimeout(() => {
      const c = new AbortController();
      ctl.current = c;
      Promise.resolve()
        .then(() => loadRef.current(typed, c.signal))
        .then((r) => {
          if (c.signal.aborted || typedRef.current !== typed) return;
          setResult(r);
          setStatus('ready');
        })
        .catch(() => {
          if (!c.signal.aborted) setStatus('error');
        });
    }, 300);
  }

  const showList = open && (status !== 'idle' || Boolean(waitingText));

  // Opens above the field when the list wouldn't fit under it on the visible part of the screen.
  useLayoutEffect(() => {
    if (!showList || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const visible = window.visualViewport?.height ?? window.innerHeight;
    setAbove(visible - rect.bottom < Math.min(LIST_MAX_PX, 160) && rect.top > visible - rect.bottom);
  }, [showList, status, fieldRef]);

  function choose(item: T) {
    ctl.current?.abort();
    typedRef.current = null;
    setOpen(false);
    setStatus('idle');
    setResult({ items: [] });
    onChoose(item);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const n = result.items.length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? n - 1 : a - 1));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      // Enter never sends the form from here: it picks the suggestion in focus, or just closes the list.
      e.preventDefault();
      if (showList && active >= 0 && result.items[active]) choose(result.items[active]);
      else setOpen(false);
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const optionId = (i: number) => `${id}-opcao-${i}`;
  const items = status === 'ready' ? result.items : [];

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={id} className="text-sm font-semibold text-concrete-900">
        {label}
      </label>
      <div className="relative">
        <div
          className={cx(
            'flex items-center gap-2 min-h-12 px-3 bg-concrete-0 rounded-control border transition-colors duration-150',
            error
              ? 'border-danger-500'
              : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
          )}
        >
          {icon ? <Icon name={icon} size={20} color="var(--text-subtle)" /> : null}
          <input
            ref={fieldRef}
            id={id}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList ? 'true' : 'false'}
            aria-controls={listId}
            aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={error || hint ? messageId : undefined}
            placeholder={placeholder}
            inputMode={inputMode}
            maxLength={maxLength}
            autoComplete={autoComplete}
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400"
            value={value}
            onChange={(e) => {
              handleChange(e);
              setOpen(true);
              search(e.target.value);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={onKeyDown}
          />
          {status === 'loading' && open ? (
            <span
              aria-hidden="true"
              className="animate-spin-token shrink-0 text-concrete-400"
              style={{
                width: '1rem',
                height: '1rem',
                border: '2px solid currentColor',
                borderRightColor: 'transparent',
                borderRadius: '9999px'
              }}
            />
          ) : null}
        </div>
        <div
          hidden={!showList}
          className={cx(
            'absolute inset-x-0 z-30 overflow-y-auto overscroll-contain bg-concrete-0 border border-concrete-200 rounded-card shadow-float py-1',
            above ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
          style={{ maxHeight: LIST_MAX_PX }}
          // Keeps the focus in the field while a suggestion is tapped (the blur would close the list first).
          onMouseDown={(e) => e.preventDefault()}
        >
          <div id={listId} role="listbox" aria-label={`Sugestões de ${label.toLowerCase()}`} hidden={!items.length}>
            {items.map((item, i) => {
              const detail = optionDetail?.(item);
              return (
                <div
                  key={optionKey(item)}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active ? 'true' : 'false'}
                  className={cx(
                    'flex flex-col justify-center min-h-11 px-3 py-2 cursor-pointer',
                    i === active ? 'bg-brand-50' : 'hover:bg-concrete-50'
                  )}
                  onClick={() => choose(item)}
                >
                  <span className="text-[0.9375rem] font-semibold text-concrete-900 leading-snug">
                    {optionLabel(item)}
                  </span>
                  {detail ? <span className="text-xs text-concrete-500 leading-snug">{detail}</span> : null}
                </div>
              );
            })}
          </div>
          {showList && items.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-concrete-500" aria-live="polite">
              {waitingText ??
                (status === 'loading'
                  ? 'Buscando…'
                  : status === 'error'
                    ? 'Não deu para buscar sugestões agora. Pode continuar digitando.'
                    : emptyText)}
            </div>
          ) : null}
          {items.length && result.credit ? (
            <div className="px-3 pt-1 pb-0.5 text-[0.6875rem] text-concrete-500">{result.credit}</div>
          ) : null}
        </div>
      </div>
      {error ? (
        <FieldError id={messageId} message={error} />
      ) : hint ? (
        <span id={messageId} className="text-sm text-concrete-500">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
