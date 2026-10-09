import { useId, type ReactNode } from 'react';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';

interface CheckboxProps {
  label: ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export function Checkbox({ label, checked = false, onChange }: CheckboxProps) {
  const fieldId = useId();
  return (
    <label htmlFor={fieldId} className="flex items-center gap-3 min-h-12 py-2 cursor-pointer select-none">
      <input
        id={fieldId}
        type="checkbox"
        checked={checked}
        className="sr-only peer"
        onChange={(e) => onChange && onChange(e.target.checked)}
      />
      <span
        className={cx(
          'inline-flex items-center justify-center w-6 h-6 rounded shrink-0 border-2 transition-colors',
          checked ? 'bg-brand-500 border-brand-500' : 'border-concrete-400 bg-white'
        )}
      >
        {checked ? <Icon name="check" size={16} color="#fff" /> : null}
      </span>
      <span className="text-sm text-concrete-900">{label}</span>
    </label>
  );
}
