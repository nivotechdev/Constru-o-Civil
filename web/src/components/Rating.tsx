import { Icon } from './icons/Icon';

interface RatingProps {
  value?: number;
  count?: number | null;
  showValue?: boolean;
  editable?: boolean;
  onChange?: (value: number) => void;
  size?: number;
}

export function Rating({ value = 0, count, showValue = true, editable = false, onChange, size = 14 }: RatingProps) {
  if (!value && !editable) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-sm text-concrete-400">Novo na plataforma</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Icon
            key={i}
            name="star"
            size={editable ? 28 : size}
            color={i <= Math.round(value) ? 'var(--amber-500)' : 'var(--gray-300)'}
            className={editable ? 'cursor-pointer' : ''}
            onClick={editable ? () => onChange && onChange(i) : undefined}
          />
        ))}
      </span>
      {showValue && !editable ? (
        <>
          <span className="text-sm font-semibold text-concrete-900">{value.toFixed(1).replace('.', ',')}</span>
          {count != null ? <span className="text-sm text-concrete-500">{`(${count})`}</span> : null}
        </>
      ) : null}
    </span>
  );
}
