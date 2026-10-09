// Single source of truth for how a candidacy's status reads on screen — for the worker (badge + next
// step on "Minhas candidaturas") and for the company (the candidate's badge on "Gerenciar vaga").
import type { Application, ApplicationStatus } from '../types/models';
import type { StatusBadge } from '../types/ui';

interface StatusInfo extends StatusBadge {
  hint: string;
  /** Route the application's tile opens. */
  to: string;
}

type AppLike = Pick<Application, 'status' | 'jobId' | 'workerReviewed'>;

/** The worker's view of their candidacy. */
export function statusInfo(app: AppLike): StatusInfo {
  const jobId = app.jobId;
  switch (app.status) {
    case 'enviada':
    case 'em_analise':
      return { label: 'Em análise', tone: 'warning', icon: 'clock', hint: 'Ver a vaga', to: '/vaga/' + jobId };
    case 'pre_selecionado':
      return {
        label: 'Pré-selecionado',
        tone: 'brand',
        icon: 'message-circle',
        hint: 'Falar no WhatsApp',
        to: '/selecionado/' + jobId
      };
    case 'contratado':
      return {
        label: 'Contratado',
        tone: 'success',
        icon: 'circle-check',
        hint: 'Falar no WhatsApp',
        to: '/selecionado/' + jobId
      };
    case 'concluida':
      return app.workerReviewed
        ? { label: 'Diária concluída', tone: 'neutral', icon: 'circle-check', hint: 'Ver o bico', to: '/vaga/' + jobId }
        : { label: 'Avalie a diária', tone: 'accent', icon: 'star', hint: 'Avaliar a obra', to: '/avaliar/' + jobId };
    case 'nao_selecionado':
      return { label: 'Não foi essa vez', tone: 'danger', icon: 'circle-x', hint: 'Ver a vaga', to: '/vaga/' + jobId };
    case 'desistiu':
      return { label: 'Você desistiu', tone: 'neutral', icon: 'user-x', hint: 'Ver a vaga', to: '/vaga/' + jobId };
    case 'cancelado_pela_construtora':
      return {
        label: 'Cancelado pela construtora',
        tone: 'danger',
        icon: 'circle-x',
        hint: 'Ver a vaga',
        to: '/vaga/' + jobId
      };
    case 'nao_compareceu':
      return {
        label: 'Falta registrada',
        tone: 'danger',
        icon: 'calendar-x',
        hint: 'Ver a vaga',
        to: '/vaga/' + jobId
      };
  }
}

/** The company's view of a candidate on one of its jobs. */
export function candidateBadge(app: Pick<Application, 'status' | 'companyReviewed'>): StatusBadge {
  const BADGES: Record<ApplicationStatus, StatusBadge> = {
    enviada: { label: 'Novo', tone: 'brand', icon: 'circle' },
    em_analise: { label: 'Em análise', tone: 'warning', icon: 'clock' },
    pre_selecionado: { label: 'Aprovado', tone: 'success', icon: 'circle-check' },
    contratado: { label: 'Contratado', tone: 'success', icon: 'handshake' },
    concluida: app.companyReviewed
      ? { label: 'Diária concluída', tone: 'neutral', icon: 'circle-check' }
      : { label: 'Avaliar', tone: 'accent', icon: 'star' },
    nao_selecionado: { label: 'Recusado', tone: 'danger', icon: 'circle-x' },
    desistiu: { label: 'Desistiu', tone: 'neutral', icon: 'user-x' },
    cancelado_pela_construtora: { label: 'Cancelado', tone: 'danger', icon: 'circle-x' },
    nao_compareceu: { label: 'Não compareceu', tone: 'danger', icon: 'calendar-x' }
  };
  return BADGES[app.status];
}

/** Statuses of a candidacy still going on (shown first on "Minhas candidaturas"). */
export const IN_PROGRESS = new Set<ApplicationStatus>(['enviada', 'em_analise', 'pre_selecionado', 'contratado']);

/** Still going on, or waiting for the worker's review. */
export function isInProgress(app: AppLike): boolean {
  return IN_PROGRESS.has(app.status) || (app.status === 'concluida' && !app.workerReviewed);
}
