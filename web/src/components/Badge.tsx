import type { Tone } from '../types/ui';
import { cx } from '../utils/cx';
import { Icon, type IconName } from './icons/Icon';

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-50 text-success-500',
  warning: 'bg-warning-50 text-warning-500',
  danger: 'bg-danger-50 text-danger-500',
  accent: 'bg-accent-50 text-accent-600',
  neutral: 'bg-concrete-100 text-concrete-500',
  inverse: 'bg-white/15 text-white'
};

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
}

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-xs font-bold whitespace-nowrap',
        TONES[tone] || TONES.neutral
      )}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {label}
    </span>
  );
}
