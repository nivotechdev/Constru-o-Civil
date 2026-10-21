// The tabs of the app's navigation — the phone's bottom bar and the desktop top bar (layouts/AppNav.tsx).
import type { IconName } from '../components/icons/Icon';
import type { Role } from '../types/models';

export interface NavItem {
  id: string;
  icon: IconName;
  label: string;
  desktopLabel?: string;
  path: string;
}

export const NAV_ITEMS: Record<Role, NavItem[]> = {
  trabalhador: [
    { id: 'mural', icon: 'briefcase', label: 'Vagas', path: '/mural' },
    { id: 'minhas-candidaturas', icon: 'file-check', label: 'Candidaturas', path: '/minhas-candidaturas' },
    { id: 'perfil', icon: 'user', label: 'Perfil', path: '/perfil' }
  ],
  recrutador: [
    { id: 'mural', icon: 'house', label: 'Início', path: '/mural' },
    { id: 'minhas-vagas', icon: 'briefcase', label: 'Vagas', desktopLabel: 'Minhas vagas', path: '/minhas-vagas' },
    { id: 'criar-vaga', icon: 'plus', label: 'Publicar', desktopLabel: 'Publicar vaga', path: '/criar-vaga' },
    { id: 'empresa', icon: 'building-2', label: 'Perfil', path: '/empresa' }
  ]
};

/** U47: the tab the screen belongs to, by position — the screen slides in from that side (layouts/AppShell.tsx). */
export function tabIndex(role: Role, id: string | null): number {
  return id ? (NAV_ITEMS[role] || NAV_ITEMS.trabalhador).findIndex((it) => it.id === id) : -1;
}
