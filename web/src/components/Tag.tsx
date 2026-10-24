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
  const look = cx(
    'inline-flex items-center gap-1.5 h-9 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150',
    selected
      ? 'bg-brand-50 border border-brand-500 text-brand-600'
      : 'bg-concrete-0 border border-concrete-300 text-concrete-700 hover:bg-concrete-50'
  );
  const ring =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';
  // U66: a chip with an "x" is a label plus its own button (the "x" used to sit under the chip's touch area and never
  // answered a tap).
  if (onRemove)
    return (
      <span className={cx(look, 'pl-3 pr-1')}>
        {icon ? <Icon name={icon} size={16} /> : null}
        <span>{label}</span>
        <button
          type="button"
          aria-label={`Tirar o filtro ${label}`}
          className={cx(
            'relative tap-target inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-brand-100',
            ring
          )}
          onClick={onRemove}
        >
          <Icon name="x" size={14} />
        </button>
      </span>
    );
  return (
    <button
      type="button"
      aria-pressed={selected ? 'true' : 'false'}
      className={cx('relative tap-target px-3', look, ring)}
      onClick={onClick}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      <span>{label}</span>
    </button>
  );
}
