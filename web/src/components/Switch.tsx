import { useId } from 'react';
import { cx } from '../utils/cx';

interface SwitchProps {
  label: string;
  description?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

/** On/off toggle with a label (and optional description) on the left. */
export function Switch({ label, description, checked = false, onChange }: SwitchProps) {
  const fieldId = useId();
  return (
    <label htmlFor={fieldId} className="flex items-center gap-3 min-h-12 py-2 cursor-pointer select-none">
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-concrete-900">{label}</span>
        {description ? <span className="text-sm text-concrete-500">{description}</span> : null}
      </span>
      <input
        id={fieldId}
        type="checkbox"
        checked={checked}
        className="sr-only"
        onChange={(e) => onChange && onChange(e.target.checked)}
      />
      <span
        className={cx(
          'relative inline-flex items-center w-11 h-6 rounded-full shrink-0 transition-colors',
          checked ? 'bg-brand-500' : 'bg-concrete-300'
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-card transition-transform',
            checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
          )}
        />
      </span>
    </label>
  );
}
