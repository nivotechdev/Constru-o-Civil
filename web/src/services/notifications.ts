// The logged-in side's notifications. Demo data, as in the legacy app: a fixed list per side, the
// newest first; the navigation's bell counts the unread ones.
import type { AppNotification, Role } from '../types/models';
import { setUI } from './store';

const WORKER: AppNotification[] = [
  {
    kind: 'pre_selecionado',
    title: 'Você foi pré-selecionado',
    text: 'Construtora Meridiano quer falar com você sobre Pedreiro de acabamento.',
    time: 'Há 12 min',
    read: false
  },
  {
    kind: 'bico_urgente',
    title: 'Bico urgente perto de você',
    text: 'Pintor em Mooca, hoje às 8h. A combinar.',
    time: 'Há 2h',
    read: false
  },
  {
    kind: 'avaliar_diaria',
    title: 'Avalie sua última diária',
    text: 'Obra Cangaíba · Servente de obra, 30 ago.',
    time: 'Ontem',
    read: true
  },
  {
    kind: 'candidatura_em_analise',
    title: 'Candidatura em análise',
    text: 'Reforma Serra de Bragança está avaliando seu perfil.',
    time: '2 dias atrás',
    read: true
  }
];

const RECRUITER: AppNotification[] = [
  {
    kind: 'novos_candidatos',
    title: '2 novos candidatos',
    text: 'Pedreiro de acabamento · Tatuapé recebeu novas candidaturas.',
    time: 'Há 30 min',
    read: false
  },
  {
    kind: 'bico_fechado',
    title: 'Bico fechado',
    text: 'Todas as vagas de Servente de obra foram preenchidas.',
    time: 'Há 3h',
    read: false
  },
  {
    kind: 'avaliar_trabalhador',
    title: 'Avalie o trabalhador',
    text: 'Marcos Aurélio concluiu a diária em 21 ago.',
    time: 'Ontem',
    read: false
  }
];

// Which side has marked everything as read ("Marcar todas como lidas"); lives in the store like the rest
// of the session, so the bell's badge follows it everywhere.
export const NOTIFICATIONS_READ_KEY = 'notifications-read';
export type NotificationsReadUI = Record<Role, boolean>;
export const NOTIFICATIONS_READ_DEFAULTS: NotificationsReadUI = { trabalhador: false, recrutador: false };

export function notificationsFor(role: Role, allRead = false): AppNotification[] {
  const list = role === 'recrutador' ? RECRUITER : WORKER;
  return allRead ? list.map((n) => ({ ...n, read: true })) : list;
}

/** The bell's badge. */
export function unreadCount(role: Role, allRead = false): number {
  return notificationsFor(role, allRead).filter((n) => !n.read).length;
}

export function markAllNotificationsRead(role: Role): void {
  setUI<NotificationsReadUI>(
    NOTIFICATIONS_READ_KEY,
    role === 'recrutador' ? { recrutador: true } : { trabalhador: true }
  );
}
