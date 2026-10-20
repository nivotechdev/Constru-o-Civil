// U32: "Sobre você" / "Sobre a empresa" — the short presentation each profile shows, with what is left to write.
import { MAX_ABOUT } from '../utils/profileText';
import { cx } from '../utils/cx';
import { FieldError } from './FieldError';
import { TextArea } from './TextArea';

interface AboutFieldProps {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  error?: string;
  onInput: (value: string) => void;
}

export function AboutField({ id, label, hint, placeholder, value, error, onInput }: AboutFieldProps) {
  const left = MAX_ABOUT - value.length;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-concrete-900">
        {label}
      </label>
      <span id={id + '-hint'} className="text-sm text-concrete-500">
        {hint}
      </span>
      <TextArea
        id={id}
        rows={5}
        placeholder={placeholder}
        value={value}
        maxLength={MAX_ABOUT}
        aria-describedby={id + '-hint'}
        aria-invalid={error ? 'true' : undefined}
        className={cx(
          'w-full px-3 py-2.5 bg-concrete-0 rounded-control border outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none',
          error ? 'border-danger-500' : 'border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
        )}
        onInput={(v) => onInput(v.slice(0, MAX_ABOUT))}
      />
      <span className={cx('text-xs self-end', left < 40 ? 'text-warning-600' : 'text-concrete-500')} aria-live="polite">
        {`${value.length}/${MAX_ABOUT}`}
      </span>
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
