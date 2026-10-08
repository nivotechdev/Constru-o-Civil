import type { MouseEvent, MouseEventHandler } from 'react';
import { cx } from '../utils/cx';
import { Icon, type IconName } from './icons/Icon';

interface TagProps {
  label: string;
  icon?: IconName;
  selected?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onRemove?: (e: MouseEvent) => void;
}

/** A clickable chip: filter option, specialty selector, requirement toggle. */
export function Tag({ label, icon, selected = false, onClick, onRemove }: TagProps) {
  return (
    <button
      type="button"
      aria-pressed={onRemove ? undefined : selected ? 'true' : 'false'}
      className={cx(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        selected
          ? 'bg-brand-50 border border-brand-500 text-brand-600'
          : 'bg-white border border-concrete-300 text-concrete-700 hover:bg-concrete-50'
      )}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      <span>{label}</span>
      {onRemove ? (
        <span
          className="ml-0.5 -mr-1 inline-flex items-center justify-center w-4 h-4"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
        >
          <Icon name="x" size={14} />
        </span>
      ) : null}
    </button>
  );
}
