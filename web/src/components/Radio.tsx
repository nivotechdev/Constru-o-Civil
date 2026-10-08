import { useId } from 'react';
import { cx } from '../utils/cx';
import { Icon, type IconName } from './icons/Icon';

interface RadioCardProps {
  name: string;
  icon: IconName;
  label: string;
  description: string;
  checked?: boolean;
  onChange?: () => void;
}

/** Card-style radio: used for the "Trabalhador vs Recrutador" account-type choice. */
export function RadioCard({ name, icon, label, description, checked = false, onChange }: RadioCardProps) {
  const fieldId = useId();
  return (
    <label
      htmlFor={fieldId}
      className={cx(
        'flex items-center gap-3.5 min-h-[5.5rem] p-4 rounded-card border cursor-pointer transition-colors',
        checked ? 'bg-brand-50 border-brand-500' : 'bg-white border-concrete-300 hover:bg-concrete-50'
      )}
    >
      <input
        id={fieldId}
        type="radio"
        name={name}
        checked={checked}
        className="sr-only"
        onChange={() => onChange && onChange()}
      />
      <span
        className={cx(
          'inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0',
          checked ? 'bg-brand-500 text-white' : 'bg-concrete-100 text-concrete-600'
        )}
      >
        <Icon name={icon} size={22} />
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className={cx('text-base font-bold', checked ? 'text-brand-600' : 'text-concrete-900')}>{label}</span>
        <span className="text-sm text-concrete-500">{description}</span>
      </span>
    </label>
  );
}
