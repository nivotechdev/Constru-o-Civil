import { useLayoutEffect, useState } from 'react';
import { Icon, type IconName } from '../components/icons/Icon';
import { Logo } from '../components/Logo';
import { NotificationsPanel } from '../components/NotificationsPanel';
import { useNotifications } from '../hooks/useNotifications';
import { useUI } from '../hooks/useStore';
import { navigate } from '../services/router';
import { MENU_DEFAULTS, MENU_KEY, type MenuUI } from '../services/sharedUI';
import { getUI, setUI } from '../services/store';
import type { Role } from '../types/models';
import { cx } from '../utils/cx';

interface NavItem {
  id: string;
  icon: IconName;
  label: string;
  desktopLabel?: string;
  path: string;
}

const ITEMS: Record<Role, NavItem[]> = {
  trabalhador: [
    { id: 'mural', icon: 'hammer', label: 'Vagas', path: '/mural' },
    {
      id: 'minhas-candidaturas',
      icon: 'file-check',
      label: 'Minhas',
      desktopLabel: 'Candidaturas',
      path: '/minhas-candidaturas'
    },
    { id: 'perfil', icon: 'user', label: 'Perfil', path: '/perfil' }
  ],
  recrutador: [
    { id: 'mural', icon: 'hammer', label: 'Início', path: '/mural' },
    { id: 'criar-vaga', icon: 'plus', label: 'Publicar', desktopLabel: 'Publicar vaga', path: '/criar-vaga' },
    { id: 'empresa', icon: 'building-2', label: 'Perfil', path: '/empresa' }
  ]
};

interface MenuEntry {
  icon: IconName;
  label: string;
  path: string;
}

const MENU: Record<Role, MenuEntry[]> = {
  trabalhador: [
    { icon: 'user', label: 'Meu perfil', path: '/perfil' },
    { icon: 'bookmark', label: 'Vagas salvas', path: '/vagas-salvas' },
    { icon: 'bell', label: 'Notificações', path: '/notificacoes' },
    { icon: 'settings', label: 'Configurações', path: '/configuracoes' }
  ],
  recrutador: [
    { icon: 'building-2', label: 'Minha empresa', path: '/empresa' },
    { icon: 'history', label: 'Bicos fechados', path: '/historico' },
    { icon: 'bell', label: 'Notificações', path: '/notificacoes' },
    { icon: 'settings', label: 'Configurações', path: '/configuracoes' }
  ]
};

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Phone tab bar: where the blue circle last sat, so a newly mounted tab bar can roll it from there
// to the newly active tab.
let lastPillDot: number | null = null;

function placePillDot(animate: boolean) {
  const dot = document.querySelector<HTMLElement>('.nav-pill-dot');
  if (!dot || !dot.parentElement || !dot.parentElement.getClientRects().length) return; // tab bar hidden (desktop)
  const tab = dot.parentElement.querySelector<HTMLElement>('[aria-current="page"]');
  if (!tab) {
    dot.style.opacity = '0';
    lastPillDot = null;
    return;
  }
  const x = tab.offsetLeft + (tab.offsetWidth - dot.offsetWidth) / 2;
  const icon = tab.querySelector<HTMLElement>('.icon');
  const slide = animate && lastPillDot != null && lastPillDot !== x && !reducedMotion();
  dot.style.transition = 'none';
  if (slide) {
    dot.style.transform = `translateX(${lastPillDot}px)`;
    // The icon turns white as the circle arrives under it, not before.
    if (icon) {
      icon.style.transition = 'none';
      icon.style.color = 'var(--gray-500)';
    }
    void dot.offsetWidth;
    dot.style.transition = `transform 420ms ${EASE}`;
    if (icon) {
      icon.style.transition = 'color 200ms ease 180ms';
      icon.style.color = '#fff';
    }
  }
  dot.style.transform = `translateX(${x}px)`;
  dot.style.opacity = '1';
  lastPillDot = x;
}

// Where the active-tab underline was last drawn, so a newly mounted header slides it from there.
let lastIndicator: { x: number; w: number } | null = null;

function placeIndicator(animate: boolean) {
  const bar = document.querySelector<HTMLElement>('.app-header .nav-indicator');
  if (!bar || !bar.parentElement || !bar.parentElement.offsetParent) return; // header hidden on phones
  const tab = bar.parentElement.querySelector<HTMLElement>('[aria-current="page"]');
  if (!tab) {
    bar.style.opacity = '0';
    lastIndicator = null;
    return;
  }
  const target = { x: tab.offsetLeft, w: tab.offsetWidth };
  const slide =
    animate && lastIndicator && !reducedMotion() && (lastIndicator.x !== target.x || lastIndicator.w !== target.w);
  bar.style.transition = 'none';
  if (slide && lastIndicator) {
    bar.style.transform = `translateX(${lastIndicator.x}px)`;
    bar.style.width = `${lastIndicator.w}px`;
    void bar.offsetWidth; // commit the start position before transitioning
    bar.style.transition = `transform 380ms ${EASE}, width 380ms ${EASE}`;
  }
  bar.style.transform = `translateX(${target.x}px)`;
  bar.style.width = `${target.w}px`;
  bar.style.opacity = '1';
  lastIndicator = target;
}

// Page-lifetime listeners, installed once (the header itself remounts on every route change, so it's
// looked up rather than captured).
let globalListeners = false;
function installGlobalListeners() {
  if (globalListeners) return;
  globalListeners = true;
  window.addEventListener(
    'scroll',
    () => {
      const header = document.querySelector('.app-header');
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    },
    { passive: true }
  );
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const menus = getUI<MenuUI>(MENU_KEY, MENU_DEFAULTS);
    if (menus.menuOpen || menus.notificationsOpen)
      setUI<MenuUI>(MENU_KEY, { menuOpen: false, notificationsOpen: false });
  });
  window.addEventListener('resize', () => {
    placeIndicator(false);
    placePillDot(false);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeIndicator(false));
}

export interface AccountSummary {
  name?: string;
  initials?: string;
  photo?: string | null;
}

interface AppNavProps {
  role: Role;
  active: string | null;
  showMobilePill?: boolean;
  account?: AccountSummary;
}

/**
 * The app's single navigation component. Floating tab pill on phones; on tablet and desktop
 * (>= 770px) a full-width top bar with the logo, the same tabs centered, and notifications + account
 * menu on the right. Mounted afresh on every route and state change (like the legacy app, which rebuilt
 * it on every render), so the pill circle and the tab underline roll from where they last were.
 */
export function AppNav({ role, active, showMobilePill = true, account = {} }: AppNavProps) {
  const items = ITEMS[role] || ITEMS.trabalhador;

  // Starting position, captured at mount; from then on placePillDot()/placeIndicator() own the style.
  const [dotStyle] = useState(() =>
    lastPillDot != null ? { transform: `translateX(${lastPillDot}px)` } : { opacity: '0' }
  );

  useLayoutEffect(() => {
    installGlobalListeners();
    if (showMobilePill) placePillDot(true);
    placeIndicator(true);
  });

  return (
    <div className="contents">
      {showMobilePill ? (
        <nav
          aria-label="Navegação principal"
          className="lg:hidden fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-3.5 rounded-full px-5 py-2 shadow-raised border border-white/60"
          style={{
            bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
            backgroundColor: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(16px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.6)'
          }}
        >
          {/* One shared blue circle behind the icons; it rolls to the tab you open. */}
          <span
            aria-hidden="true"
            className="nav-pill-dot pointer-events-none absolute left-0 top-1/2 -mt-5 w-10 h-10 rounded-full bg-brand-500 shadow-[0_4px_12px_rgba(29,75,237,0.35)]"
            style={dotStyle}
          />
          {items.map((it) => {
            const isActive = active === it.id;
            return (
              <button
                key={it.id}
                type="button"
                aria-label={it.label}
                aria-current={isActive ? 'page' : undefined}
                className="relative z-10 inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-100 active:scale-95 transition-transform"
                onClick={() => navigate(it.path)}
              >
                <Icon name={it.icon} size={22} color={isActive ? '#fff' : 'var(--gray-500)'} />
              </button>
            );
          })}
        </nav>
      ) : null}
      <TopBar role={role} items={items} active={active} account={account} />
    </div>
  );
}

interface TopBarProps {
  role: Role;
  items: NavItem[];
  active: string | null;
  account: AccountSummary;
}

function TopBar({ role, items, active, account }: TopBarProps) {
  const [menu, setMenu] = useUI<MenuUI>(MENU_KEY, MENU_DEFAULTS);
  const go = (path: string) => {
    setMenu({ menuOpen: false, notificationsOpen: false });
    navigate(path);
  };
  const notifications = useNotifications(role);
  const [indicatorStyle] = useState(() =>
    lastIndicator ? { transform: `translateX(${lastIndicator.x}px)`, width: `${lastIndicator.w}px` } : { opacity: '0' }
  );

  const avatar = (size: 'sm' | 'lg') => (
    <span
      className={cx(
        size === 'sm'
          ? 'inline-flex items-center justify-center w-8 h-8 rounded-full overflow-hidden text-xs font-bold'
          : 'inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden shrink-0 text-sm font-bold',
        role === 'recrutador' ? 'bg-brand-50' : 'bg-accent-50 text-accent-600'
      )}
    >
      {account.photo ? (
        <img src={account.photo} alt="" className="w-full h-full object-cover" />
      ) : role === 'recrutador' ? (
        <Icon name="building-2" size={size === 'sm' ? 16 : 20} color="var(--brand)" />
      ) : (
        account.initials || ''
      )}
    </span>
  );

  // Logo on the left, tabs centred, notifications and account on the right. At the top of the page
  // it sits flat on the page; once you scroll it lifts into a floating frosted island (the desktop
  // sibling of the phone's tab bar), and settles back at the top.
  return (
    <header
      className={cx(
        'app-header hidden lg:block sticky top-0 z-30 page-x pt-3 pb-2 pointer-events-none',
        window.scrollY > 8 ? 'is-scrolled' : ''
      )}
    >
      <div className="app-island pointer-events-auto w-full max-w-[1000px] mx-auto h-[4.25rem] grid grid-cols-[1fr_auto_1fr] items-center gap-6 pl-3 pr-2.5 rounded-full">
        <div className="flex items-center min-w-0">
          <button
            type="button"
            className="inline-flex items-center pl-1 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
            aria-label="Bicos, ir para o início"
            onClick={() => go('/mural')}
          >
            <Logo />
          </button>
        </div>
        {/* One shared underline for the tabs, just under the icons; it slides between tabs. */}
        <nav aria-label="Navegação principal" className="relative flex items-center gap-7 xl:gap-9">
          {items.map((it) => {
            const isActive = active === it.id;
            return (
              <button
                key={it.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={cx(
                  'group relative inline-flex items-center gap-2.5 rounded-xl text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
                  isActive ? 'text-concrete-900' : 'text-concrete-500 hover:text-concrete-900'
                )}
                onClick={() => go(it.path)}
              >
                <span
                  className={cx(
                    'relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-raised'
                      : 'bg-concrete-100 text-concrete-600 group-hover:bg-concrete-200 group-hover:scale-105'
                  )}
                >
                  <Icon name={it.icon} size={19} />
                </span>
                {it.desktopLabel || it.label}
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="nav-indicator pointer-events-none absolute left-0 top-[calc(100%+0.375rem)] h-[2px] rounded-full bg-brand-500"
            style={indicatorStyle}
          />
        </nav>
        <div className="flex items-center justify-end gap-2">
          <div className="relative">
            <button
              type="button"
              aria-label={notifications.unread ? `Notificações, ${notifications.unread} novas` : 'Notificações'}
              aria-haspopup="dialog"
              aria-expanded={menu.notificationsOpen ? 'true' : 'false'}
              title="Notificações"
              className={cx(
                'relative inline-flex items-center justify-center w-11 h-11 rounded-full text-concrete-900 ring-1 transition-colors hover:bg-white',
                menu.notificationsOpen ? 'bg-white ring-concrete-300 shadow-raised' : 'bg-white/70 ring-concrete-900/5'
              )}
              onClick={() => setMenu({ notificationsOpen: !menu.notificationsOpen, menuOpen: false })}
            >
              <Icon name="bell" size={18} />
              {notifications.unread ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-danger-500 text-white text-[0.625rem] font-bold leading-[1.125rem] text-center ring-2 ring-white">
                  {String(notifications.unread)}
                </span>
              ) : null}
            </button>
            {menu.notificationsOpen ? (
              <NotificationsPanel
                list={notifications.list}
                unread={notifications.unread}
                onMarkAllRead={notifications.markAllRead}
                onSeeAll={() => go('/notificacoes')}
                onClose={() => setMenu({ notificationsOpen: false })}
                className="absolute right-0 top-full mt-3 w-[24rem]"
              />
            ) : null}
          </div>
          <div className="relative">
            <button
              type="button"
              aria-label="Menu da conta"
              aria-haspopup="menu"
              aria-expanded={menu.menuOpen ? 'true' : 'false'}
              className={cx(
                'inline-flex items-center gap-2.5 h-11 pl-3.5 pr-1.5 rounded-full border bg-white/80 transition-shadow hover:bg-white hover:shadow-raised',
                menu.menuOpen ? 'border-concrete-300 shadow-raised' : 'border-concrete-200'
              )}
              onClick={() => setMenu({ menuOpen: !menu.menuOpen, notificationsOpen: false })}
            >
              <Icon name="menu" size={18} color="var(--gray-700)" />
              {avatar('sm')}
            </button>
            {menu.menuOpen ? (
              <>
                <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setMenu({ menuOpen: false })} />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-3 z-50 w-72 py-2 bg-white rounded-2xl border border-concrete-200 shadow-float animate-fade-in"
                >
                  <div className="flex items-center gap-3 px-4 pt-2 pb-3">
                    {avatar('lg')}
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-concrete-900 truncate">{account.name || ''}</span>
                      <span className="text-sm text-concrete-500 truncate">
                        {role === 'recrutador' ? 'Conta de recrutador' : 'Conta de trabalhador'}
                      </span>
                    </div>
                  </div>
                  <div className="h-px bg-concrete-200 my-1" />
                  {(MENU[role] || MENU.trabalhador).map((m) => (
                    <MenuItem key={m.path} icon={m.icon} label={m.label} onClick={() => go(m.path)} />
                  ))}
                  <div className="h-px bg-concrete-200 my-1" />
                  <MenuItem icon="log-out" label="Sair da conta" danger onClick={() => go('/login')} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  danger = false,
  onClick
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cx(
        'w-full flex items-center gap-3 px-4 h-11 text-left text-[0.9375rem] transition-colors hover:bg-concrete-50',
        danger ? 'text-danger-500 font-semibold' : 'text-concrete-800'
      )}
      onClick={onClick}
    >
      <Icon name={icon} size={18} color={danger ? 'var(--red-500)' : 'var(--gray-500)'} />
      {label}
    </button>
  );
}
