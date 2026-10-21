import { useState, type ReactNode } from 'react';
import { useDb, useRole } from '../hooks/useStore';
import { currentCompany, currentWorker } from '../services/selectors';
import type { Role } from '../types/models';
import { cx } from '../utils/cx';
import { AppNav, type AccountSummary } from './AppNav';
import { tabIndex } from './navItems';

const TAB_ROOTS: Record<Role, Set<string>> = {
  trabalhador: new Set(['/mural', '/minhas-candidaturas', '/perfil']),
  recrutador: new Set(['/mural', '/minhas-vagas', '/criar-vaga', '/empresa'])
};

// Desktop/tablet content width per screen: the mural spans the whole window, focused tasks (forms,
// confirmations) get a narrow centered column, everything else a page column.
const NARROW_SCREENS = new Set([
  '/criar-vaga',
  '/vaga-editar/:id',
  '/perfil/editar',
  '/perfil/verificar',
  '/empresa/editar',
  '/configuracoes',
  '/configuracoes/privacidade',
  '/configuracoes/excluir-conta',
  '/configuracoes/senha',
  '/configuracoes/email',
  '/configuracoes/bloqueados',
  '/configuracoes/avisos',
  '/pagamentos',
  '/whatsapp',
  '/notificacoes',
  '/confirmar/:id',
  '/enviado/:id',
  '/avaliar/:id',
  '/avaliar-trabalhador/:jobId/:workerId',
  '/selecionado/:id',
  '/vaga-publicada/:id',
  '/impulsionar/:id',
  '/impulsionar/:id/:plan',
  '/fechado/:id',
  '/avaliacoes/:type/:id'
]);

function tabIdForPath(path: string, role: Role): string | null {
  if (role === 'trabalhador') {
    if (path === '/mural') return 'mural';
    if (path === '/minhas-candidaturas') return 'minhas-candidaturas';
    if (path === '/perfil') return 'perfil';
  } else {
    if (path === '/mural') return 'mural';
    if (path === '/minhas-vagas' || path === '/historico') return 'minhas-vagas';
    if (path === '/criar-vaga') return 'criar-vaga';
    if (path === '/empresa') return 'empresa';
  }
  return null;
}

/**
 * U47: how a screen comes in. Between the tabs of the bottom bar it slides in from the side of the tab (left or
 * right), with the bar's pill; any other screen fades in. Only a fade there: a slide moves the screen, and a bar fixed
 * to the bottom of it (e.g. "Quero esse bico") would be dragged along while it lasts. Never on the first screen of a
 * visit (nothing to come from, and it would only delay the first paint).
 */
let lastTab: { role: Role; index: number } | null = null;
let shownBefore = false;

function screenEntrance(role: Role, active: string | null): string {
  const index = tabIndex(role, active);
  const from = lastTab;
  const first = !shownBefore;
  shownBefore = true;
  lastTab = index >= 0 ? { role, index } : null;
  if (first) return '';
  if (index >= 0 && from && from.role === role && from.index !== index)
    return from.index < index ? 'animate-screen-from-right' : 'animate-screen-from-left';
  return 'animate-screen-in';
}

interface AppShellProps {
  path: string;
  /** The matched route pattern (e.g. "/vaga/:id"). */
  pattern: string;
  children: ReactNode;
}

/** Logged-in area: navigation (pill on phones, top bar from 770px) + the screen in <main>. */
export function AppShell({ path, pattern, children }: AppShellProps) {
  const role = useRole();
  const db = useDb();

  const isMural = path === '/mural';
  const showMobileNav = TAB_ROOTS[role] && TAB_ROOTS[role].has(path);
  const active = tabIdForPath(path, role);
  // Decided once per screen (the shell is mounted afresh on every navigation).
  const [entrance] = useState(() => screenEntrance(role, active));

  let account: AccountSummary;
  if (role === 'recrutador') {
    const company = currentCompany(db);
    account = { name: company.name, photo: company.logoUrl ?? null };
  } else {
    const worker = currentWorker(db);
    account = { name: worker.name, initials: worker.initials, photo: worker.photoUrl ?? null };
  }

  return (
    <div className={cx('lg:flex lg:flex-col lg:min-h-screen', isMural ? 'bg-concrete-0' : '')}>
      {/* X05: not remounted on every data change (that dropped the keyboard focus in the bar). */}
      <AppNav role={role} active={active} showMobilePill={showMobileNav} account={account} />
      <main
        className={cx(
          'flex-1 min-w-0',
          entrance,
          showMobileNav ? 'pb-28 lg:pb-0' : '',
          isMural
            ? 'bg-concrete-0 min-h-screen'
            : cx(
                'lg:w-full lg:mx-auto lg:px-8 lg:pt-8 lg:pb-16',
                NARROW_SCREENS.has(pattern) ? 'lg:max-w-[40rem]' : 'lg:max-w-panel'
              )
        )}
      >
        {children}
      </main>
    </div>
  );
}
