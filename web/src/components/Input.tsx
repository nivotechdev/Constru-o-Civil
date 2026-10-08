import { useId, type HTMLAttributes, type KeyboardEvent } from 'react';
import { useTextField } from '../hooks/useTextField';
import { cx } from '../utils/cx';
import { FieldError } from './FieldError';
import { Icon, type IconName } from './icons/Icon';

interface InputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  icon?: IconName;
  value?: string;
  onInput?: (value: string) => void;
  error?: string | null;
  hint?: string | null;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  mono?: boolean;
  suffix?: string;
  autoFocus?: boolean;
  /** Red border only, for fields that share one message with a neighbour. */
  invalid?: boolean;
  /** Called when Enter is pressed in the field (e.g. to go to the next step of a form). */
  onEnter?: () => void;
}

// Enter (outside an IME composition) runs `onEnter`.
function enterHandler(onEnter?: () => void) {
  if (!onEnter) return undefined;
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onEnter();
    }
  };
}

/** Text field. */
export function Input({
  id,
  label,
  placeholder = '',
  icon,
  value = '',
  onInput,
  error,
  hint,
  type = 'text',
  inputMode,
  mono = false,
  suffix,
  autoFocus = false,
  invalid = false,
  onEnter
}: InputProps) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [fieldRef, handleChange] = useTextField<HTMLInputElement>(onInput, autoFocus);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label ? (
        <label htmlFor={fieldId} className="text-sm font-semibold text-concrete-900">
          {label}
        </label>
      ) : null}
      <div
        className={cx(
          'flex items-center gap-2 min-h-12 px-3 bg-white rounded-control border transition-colors duration-150',
          error || invalid
            ? 'border-danger-500'
            : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
        )}
      >
        {icon ? <Icon name={icon} size={20} color="var(--text-subtle)" /> : null}
        <input
          ref={fieldRef}
          id={fieldId}
          data-focus-id={id}
          type={type}
          placeholder={placeholder}
          inputMode={inputMode || undefined}
          className={cx(
            'flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400',
            mono ? 'font-mono' : ''
          )}
          value={value}
          onChange={handleChange}
          onKeyDown={enterHandler(onEnter)}
        />
        {suffix ? <span className="text-sm text-concrete-500 font-semibold shrink-0">{suffix}</span> : null}
      </div>
      {error ? <FieldError message={error} /> : hint ? <span className="text-sm text-concrete-500">{hint}</span> : null}
    </div>
  );
}

interface PasswordInputProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  onInput?: (value: string) => void;
  error?: string | null;
  visible?: boolean;
  onToggleVisible?: () => void;
  onEnter?: () => void;
}

/** Input with a show/hide eye toggle, used for every password field in the app. */
export function PasswordInput({
  id,
  label = 'Senha',
  placeholder = 'Sua senha',
  value = '',
  onInput,
  error,
  visible,
  onToggleVisible,
  onEnter
}: PasswordInputProps) {
  const autoId = useId();
  const fieldId = id || autoId;
  const [fieldRef, handleChange] = useTextField<HTMLInputElement>(onInput);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label htmlFor={fieldId} className="text-sm font-semibold text-concrete-900">
        {label}
      </label>
      <div
        className={cx(
          'flex items-center gap-2 min-h-12 pl-3 pr-1.5 bg-white rounded-control border transition-colors duration-150',
          error
            ? 'border-danger-500'
            : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
        )}
      >
        <input
          ref={fieldRef}
          id={fieldId}
          data-focus-id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          className="flex-1 min-w-0 h-11 bg-transparent outline-none text-base text-concrete-900 placeholder:text-concrete-400"
          onChange={handleChange}
          onKeyDown={enterHandler(onEnter)}
        />
        <button
          type="button"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-concrete-500 hover:bg-concrete-100 shrink-0"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={onToggleVisible}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={22} />
        </button>
      </div>
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
