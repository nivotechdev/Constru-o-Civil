// The account menu's entries, the same on every screen size: the desktop dropdown (AppNav). On phones the
// profile's gear opens Configurações (components/SettingsButton.tsx, U44).
import type { IconName } from '../components/icons/Icon';
import type { Role } from '../types/models';

export interface MenuEntry {
  icon: IconName;
  label: string;
  path: string;
}

export const ACCOUNT_MENU: Record<Role, MenuEntry[]> = {
  trabalhador: [
    { icon: 'user', label: 'Meu perfil', path: '/perfil' },
    { icon: 'bookmark', label: 'Vagas salvas', path: '/vagas-salvas' },
    { icon: 'bell', label: 'Notificações', path: '/notificacoes' },
    { icon: 'settings', label: 'Configurações', path: '/configuracoes' },
    { icon: 'circle-help', label: 'Ajuda', path: '/ajuda' }
  ],
  recrutador: [
    { icon: 'building-2', label: 'Minha empresa', path: '/empresa' },
    { icon: 'history', label: 'Bicos fechados', path: '/historico' },
    { icon: 'bell', label: 'Notificações', path: '/notificacoes' },
    { icon: 'settings', label: 'Configurações', path: '/configuracoes' },
    { icon: 'circle-help', label: 'Ajuda', path: '/ajuda' }
  ]
};
