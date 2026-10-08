import type { NotificationKind } from '../types/models';
import type { IconName } from './icons/Icon';

interface Look {
  icon: IconName;
  /** Background of the icon circle. */
  bg: string;
  /** Icon colour. */
  fg: string;
}

const SUCCESS = { bg: 'bg-success-50', fg: 'var(--green-500)' };
const DANGER = { bg: 'bg-danger-50', fg: 'var(--red-500)' };
const ACCENT = { bg: 'bg-accent-50', fg: 'var(--teal-500)' };
const BRAND = { bg: 'bg-brand-50', fg: 'var(--brand)' };

/** How each kind of notification looks, in the list screen and in the bell's panel. */
export const NOTIFICATION_LOOK: Record<NotificationKind, Look> = {
  pre_selecionado: { icon: 'circle-check', ...SUCCESS },
  bico_urgente: { icon: 'zap', ...DANGER },
  avaliar_diaria: { icon: 'star', ...ACCENT },
  candidatura_em_analise: { icon: 'file-check', ...BRAND },
  novos_candidatos: { icon: 'users', ...BRAND },
  bico_fechado: { icon: 'circle-check', ...SUCCESS },
  avaliar_trabalhador: { icon: 'star', ...ACCENT }
};
