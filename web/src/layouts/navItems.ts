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
    { id: 'minhas-candidaturas', icon: 'file-check', label: 'Inscrições', path: '/minhas-candidaturas' },
    { id: 'perfil', icon: 'user', label: 'Perfil', path: '/perfil' }
  ],
  recrutador: [
    { id: 'mural', icon: 'house', label: 'Início', path: '/mural' },
    { id: 'minhas-vagas', icon: 'briefcase', label: 'Vagas', desktopLabel: 'Minhas vagas', path: '/minhas-vagas' },
    { id: 'criar-vaga', icon: 'plus', label: 'Publicar', desktopLabel: 'Publicar vaga', path: '/criar-vaga' },
    { id: 'empresa', icon: 'building-2', label: 'Perfil', path: '/empresa' }
  ]
};
