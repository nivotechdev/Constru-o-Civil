import { useSyncExternalStore, type ReactNode } from 'react';
import { useDb, useRole } from '../hooks/useStore';
import { currentCompany, currentWorker } from '../services/selectors';
import { getVersion, subscribe } from '../services/store';
import type { Role } from '../types/models';
import { cx } from '../utils/cx';
import { AppNav, type AccountSummary } from './AppNav';

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
  // The legacy app rebuilt the navigation on every state change; remounting it keeps its imperatively
  // placed tab indicators exactly as they were (see AppNav).
  const storeVersion = useSyncExternalStore(subscribe, getVersion);

  const isMural = path === '/mural';
  const showMobileNav = TAB_ROOTS[role] && TAB_ROOTS[role].has(path);

  let account: AccountSummary;
  if (role === 'recrutador') {
    const company = currentCompany(db);
    account = { name: company.name, photo: company.logoUrl ?? null };
  } else {
    const worker = currentWorker(db);
    account = { name: worker.name, initials: worker.initials, photo: worker.photoUrl ?? null };
  }

  return (
    <div className={cx('lg:flex lg:flex-col lg:min-h-screen', isMural ? 'bg-white' : '')}>
      <AppNav
        key={storeVersion}
        role={role}
        active={tabIdForPath(path, role)}
        showMobilePill={showMobileNav}
        account={account}
      />
      <main
        className={cx(
          'flex-1 min-w-0',
          showMobileNav ? 'pb-28 lg:pb-0' : '',
          isMural
            ? 'bg-white min-h-screen'
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
