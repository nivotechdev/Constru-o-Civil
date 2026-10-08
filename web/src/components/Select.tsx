import { useId } from 'react';
import { cx } from '../utils/cx';
import { FieldError } from './FieldError';
import { Icon } from './icons/Icon';

interface SelectProps {
  label?: string;
  placeholder?: string;
  options?: string[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string | null;
}

export function Select({ label, placeholder = 'Selecione', options = [], value = '', onChange, error }: SelectProps) {
  const fieldId = useId();
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label ? (
        <label htmlFor={fieldId} className="text-sm font-semibold text-concrete-900">
          {label}
        </label>
      ) : null}
      <div
        className={cx(
          'relative flex items-center min-h-12 px-3 bg-white rounded-control border',
          error
            ? 'border-danger-500'
            : 'border-concrete-300 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100'
        )}
      >
        <select
          id={fieldId}
          className={cx(
            'flex-1 min-w-0 h-11 bg-transparent outline-none text-base appearance-none pr-6 cursor-pointer',
            value ? 'text-concrete-900' : 'text-concrete-400'
          )}
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 text-concrete-500">
          <Icon name="chevron-down" size={18} />
        </span>
      </div>
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}
