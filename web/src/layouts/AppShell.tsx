import { useSyncExternalStore, type ReactNode } from 'react';
import { useDb, useRole, useUI } from '../hooks/useStore';
import { currentCompany, currentWorker } from '../services/selectors';
import { COMPANY_PROFILE_DEFAULTS, COMPANY_PROFILE_KEY, type CompanyProfileUI } from '../services/sharedUI';
import { getVersion, subscribe } from '../services/store';
import type { Role } from '../types/models';
import { cx } from '../utils/cx';
import { AppNav, type AccountSummary } from './AppNav';

const TAB_ROOTS: Record<Role, Set<string>> = {
  trabalhador: new Set(['/mural', '/minhas-candidaturas', '/perfil']),
  recrutador: new Set(['/mural', '/criar-vaga', '/empresa'])
};

// Desktop/tablet content width per screen: the mural spans the whole window, focused tasks (forms,
// confirmations) get a narrow centered column, everything else a page column.
const NARROW_SCREENS = new Set([
  '/criar-vaga',
  '/perfil/editar',
  '/empresa/editar',
  '/configuracoes',
  '/configuracoes/privacidade',
  '/notificacoes',
  '/confirmar/:id',
  '/enviado/:id',
  '/avaliar/:id',
  '/selecionado/:id',
  '/vaga-publicada/:id',
  '/impulsionar/:id',
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
  const [companyProfile] = useUI<CompanyProfileUI>(COMPANY_PROFILE_KEY, COMPANY_PROFILE_DEFAULTS);

  const isMural = path === '/mural';
  const showMobileNav = TAB_ROOTS[role] && TAB_ROOTS[role].has(path);

  let account: AccountSummary;
  if (role === 'recrutador') {
    account = { name: currentCompany(db).name, photo: companyProfile.logo };
  } else {
    const worker = currentWorker(db);
    account = { name: worker.name, initials: worker.initials };
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
