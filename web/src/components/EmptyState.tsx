import { Button } from './Button';
import { Icon, type IconName } from './icons/Icon';

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description?: string;
  actionLabel?: string | null;
  onAction?: (() => void) | null;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-4 px-6 py-12">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-concrete-100">
        <Icon name={icon} size={30} color="var(--text-subtle)" />
      </span>
      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="text-base font-bold text-concrete-900">{title}</h3>
        {description ? <p className="text-sm text-concrete-500">{description}</p> : null}
      </div>
      {actionLabel ? (
        <Button label={actionLabel} variant="secondary" size="sm" onClick={onAction ? () => onAction() : undefined} />
      ) : null}
    </div>
  );
}
