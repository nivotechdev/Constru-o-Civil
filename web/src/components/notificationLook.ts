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
const NEUTRAL = { bg: 'bg-concrete-100', fg: 'var(--gray-500)' };

/** How each kind of notification looks, in the list screen and in the bell's panel. */
export const NOTIFICATION_LOOK: Record<NotificationKind, Look> = {
  novos_candidatos: { icon: 'users', ...BRAND },
  candidatura_em_analise: { icon: 'file-check', ...BRAND },
  pre_selecionado: { icon: 'circle-check', ...SUCCESS },
  nao_selecionado: { icon: 'circle-x', ...NEUTRAL },
  contratado: { icon: 'handshake', ...SUCCESS },
  desistencia: { icon: 'user-x', ...DANGER },
  contratacao_cancelada: { icon: 'circle-x', ...DANGER },
  nao_compareceu: { icon: 'calendar-x', ...DANGER },
  avaliar_diaria: { icon: 'star', ...ACCENT },
  avaliar_trabalhador: { icon: 'star', ...ACCENT },
  vaga_editada: { icon: 'pencil', ...BRAND },
  impulsionamento: { icon: 'rocket', ...BRAND },
  bico_urgente: { icon: 'zap', ...DANGER },
  bico_fechado: { icon: 'circle-check', ...SUCCESS },
  verificacao: { icon: 'shield-check', ...BRAND }
};
