// The one table of status transitions of a candidacy. Nothing else changes `Application.status`: the
// services in applications.ts call `transition`, and the back end must enforce the same table (see
// docs/CONTRATO-BACKEND.md). Pure functions, tested in src/__tests__/applicationMachine.test.ts.
import type { Actor, Application, ApplicationStatus } from '../types/models';
import { serviceError } from './errors';

export type ApplicationAction =
  | 'analisar'
  | 'aprovar'
  | 'recusar'
  | 'desfazer_aprovacao'
  | 'contratar'
  | 'desistir'
  | 'cancelar_contratacao'
  | 'concluir'
  | 'marcar_falta'
  | 'expirar';

interface Transition {
  from: ApplicationStatus[];
  to: ApplicationStatus;
  /** Who may run it. */
  by: Actor[];
  /** Where it happens, for the contract document. */
  where: string;
}

/**
 * Besides these, a candidacy is created ("enviada", by the worker, on "Confirmar candidatura") and
 * deleted (by the worker, while "enviada"/"em_analise", on the job's page). Reviews don't change the
 * status: each side's review sets `workerReviewed`/`companyReviewed` on a "concluida" candidacy.
 */
export const TRANSITIONS: Record<ApplicationAction, Transition> = {
  analisar: {
    from: ['enviada'],
    to: 'em_analise',
    by: ['construtora', 'sistema'],
    where: 'A construtora abre o perfil do candidato (automático)'
  },
  aprovar: {
    from: ['enviada', 'em_analise'],
    to: 'pre_selecionado',
    by: ['construtora'],
    where: 'Gerenciar vaga / Perfil do candidato › Aprovar'
  },
  recusar: {
    from: ['enviada', 'em_analise'],
    to: 'nao_selecionado',
    by: ['construtora', 'sistema'],
    where: 'Recusar, ou automático ao preencher a última vaga / encerrar a vaga'
  },
  desfazer_aprovacao: {
    from: ['pre_selecionado'],
    to: 'em_analise',
    by: ['construtora'],
    where: 'Perfil do candidato › Desfazer'
  },
  contratar: {
    from: ['pre_selecionado'],
    to: 'contratado',
    by: ['construtora'],
    where: 'Gerenciar vaga / Perfil do candidato › Confirmar contratação'
  },
  desistir: {
    from: ['pre_selecionado', 'contratado'],
    to: 'desistiu',
    by: ['trabalhador'],
    where: 'Você avançou › Não vou poder ir'
  },
  cancelar_contratacao: {
    from: ['pre_selecionado', 'contratado'],
    to: 'cancelado_pela_construtora',
    by: ['construtora'],
    where: 'Perfil do candidato › Cancelar contratação'
  },
  concluir: {
    from: ['contratado'],
    to: 'concluida',
    by: ['construtora', 'sistema'],
    where: 'Perfil do candidato › Marcar diária como concluída, ou automático depois da data final'
  },
  marcar_falta: {
    from: ['contratado'],
    to: 'nao_compareceu',
    by: ['construtora'],
    where: 'Perfil do candidato › Não compareceu'
  },
  expirar: {
    from: ['pre_selecionado'],
    to: 'expirada',
    by: ['sistema'],
    where: 'Automático: a vaga venceu sem a contratação ser confirmada'
  }
};

export function canTransition(status: ApplicationStatus, action: ApplicationAction, actor: Actor): boolean {
  const t = TRANSITIONS[action];
  return t.from.includes(status) && t.by.includes(actor);
}

/** The candidacy after `action`; throws `conflito` when the table doesn't allow it. */
export function transition(
  app: Application,
  action: ApplicationAction,
  actor: Actor,
  at: string,
  reason: string | null = null
): Application {
  if (!canTransition(app.status, action, actor)) {
    throw serviceError('conflito', 'Essa candidatura mudou de situação. Atualize a tela e confira.');
  }
  const to = TRANSITIONS[action].to;
  return {
    ...app,
    status: to,
    statusChangedAt: at,
    events: [...app.events, { status: to, at, by: actor, reason }],
    autoRejected: action === 'recusar' && actor === 'sistema' && reason === 'vaga_preenchida'
  };
}

/** A new candidacy, as the worker sends it. */
export function newApplication(id: string, jobId: string, workerId: string, at: string): Application {
  return {
    id,
    jobId,
    workerId,
    status: 'enviada',
    createdAt: at,
    statusChangedAt: at,
    events: [{ status: 'enviada', at, by: 'trabalhador', reason: null }],
    autoRejected: false,
    workerReviewed: false,
    companyReviewed: false
  };
}

/** Pending: the company hasn't decided yet. */
export const isPending = (status: ApplicationStatus) => status === 'enviada' || status === 'em_analise';
/** Holding a slot of the job (picked or hired). */
export const holdsSlot = (status: ApplicationStatus) => status === 'pre_selecionado' || status === 'contratado';
/**
 * Takes one of the job's places: picked, hired, or already done the diária (Y02) — a concluded diária
 * doesn't put the job back on the mural.
 */
export const occupiesSlot = (status: ApplicationStatus) => holdsSlot(status) || status === 'concluida';
/** Contact by WhatsApp is open for both sides. */
export const contactOpen = (status: ApplicationStatus) => holdsSlot(status);

/** When the status last became `status` (e.g. when the contact opened), if it ever did. */
export function lastEventAt(app: Application, status: ApplicationStatus): string | null {
  for (let i = app.events.length - 1; i >= 0; i--) if (app.events[i].status === status) return app.events[i].at;
  return null;
}

/** Whether `side` may still review this candidacy. */
export function canReview(app: Application, side: 'trabalhador' | 'construtora'): boolean {
  return app.status === 'concluida' && !(side === 'trabalhador' ? app.workerReviewed : app.companyReviewed);
}
