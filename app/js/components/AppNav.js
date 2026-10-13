import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';
import { getUI, setUI } from '../store.js';
import { Logo } from './Logo.js';

const ITEMS = {
  trabalhador: [
    { id: 'mural', icon: 'hammer', label: 'Vagas', path: '/mural' },
    { id: 'minhas-candidaturas', icon: 'file-check', label: 'Minhas', desktopLabel: 'Candidaturas', path: '/minhas-candidaturas' },
    { id: 'perfil', icon: 'user', label: 'Perfil', path: '/perfil' }
  ],
  recrutador: [
    { id: 'mural', icon: 'hammer', label: 'Início', path: '/mural' },
    { id: 'criar-vaga', icon: 'plus', label: 'Publicar', desktopLabel: 'Publicar vaga', path: '/criar-vaga' },
    { id: 'empresa', icon: 'building-2', label: 'Perfil', path: '/empresa' }
  ]
};

const MENU = {
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

const MENU_KEY = 'app-nav';

if (typeof window !== 'undefined') {
  // One listener for the lifetime of the page: the header element itself is rebuilt on
  // every render, so it's looked up rather than captured.
  window.addEventListener('scroll', () => {
    const header = document.querySelector('.app-header');
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
  }, { passive: true });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && getUI(MENU_KEY, { menuOpen: false }).menuOpen) setUI(MENU_KEY, { menuOpen: false });
  });
  window.addEventListener('resize', () => { placeIndicator(false); placePillDot(false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeIndicator(false));
}

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Phone tab bar: where the blue circle last sat, so a rebuilt tab bar can roll it from
// there to the newly active tab.
let lastPillDot = null;

function placePillDot(animate) {
  const dot = document.querySelector('.nav-pill-dot');
  if (!dot || !dot.parentElement.getClientRects().length) return; // tab bar hidden (desktop)
  const tab = dot.parentElement.querySelector('[aria-current="page"]');
  if (!tab) { dot.style.opacity = '0'; lastPillDot = null; return; }
  const x = tab.offsetLeft + (tab.offsetWidth - dot.offsetWidth) / 2;
  const icon = tab.querySelector('.icon');
  const slide = animate && lastPillDot != null && lastPillDot !== x && !reducedMotion();
  dot.style.transition = 'none';
  if (slide) {
    dot.style.transform = `translateX(${lastPillDot}px)`;
    // The icon turns white as the circle arrives under it, not before.
    if (icon) { icon.style.transition = 'none'; icon.style.color = 'var(--gray-500)'; }
    void dot.offsetWidth;
    dot.style.transition = `transform 420ms ${EASE}`;
    if (icon) { icon.style.transition = 'color 200ms ease 180ms'; icon.style.color = '#fff'; }
  }
  dot.style.transform = `translateX(${x}px)`;
  dot.style.opacity = '1';
  lastPillDot = x;
}

// Where the active-tab underline was last drawn. The header is rebuilt on every render, so
// a new underline starts from here and slides to the newly active tab.
let lastIndicator = null;

function placeIndicator(animate) {
  const bar = document.querySelector('.app-header .nav-indicator');
  if (!bar || !bar.parentElement.offsetParent) return; // header hidden on phones
  const tab = bar.parentElement.querySelector('[aria-current="page"]');
  if (!tab) { bar.style.opacity = '0'; lastIndicator = null; return; }
  const target = { x: tab.offsetLeft, w: tab.offsetWidth };
  const slide = animate && lastIndicator && !reducedMotion() && (lastIndicator.x !== target.x || lastIndicator.w !== target.w);
  bar.style.transition = 'none';
  if (slide) {
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

/**
 * The app's single navigation component. Floating tab pill on phones; on tablet and
 * desktop (>= 770px) a full-width top bar with the logo, the same tabs centered, and
 * notifications + account menu on the right.
 */
export function AppNav({ role, active, navigate, showMobilePill = true, notifications = 0, account = {} }) {
  const items = ITEMS[role] || ITEMS.trabalhador;

  const mobile = showMobilePill ? h('nav', {
    'aria-label': 'Navegação principal',
    class: 'lg:hidden fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-3.5 rounded-full px-5 py-2 shadow-raised border border-white/60',
    style: { bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))', backgroundColor: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px) saturate(1.6)', WebkitBackdropFilter: 'blur(16px) saturate(1.6)' }
  },
    // One shared blue circle behind the icons; it rolls to the tab you open.
    h('span', {
      'aria-hidden': 'true',
      class: 'nav-pill-dot pointer-events-none absolute left-0 top-1/2 -mt-5 w-10 h-10 rounded-full bg-brand-500 shadow-[0_4px_12px_rgba(29,75,237,0.35)]',
      style: lastPillDot != null ? { transform: `translateX(${lastPillDot}px)` } : { opacity: '0' }
    }),
    ...items.map((it) => navPill(it, active, navigate))
  ) : null;
  if (mobile) requestAnimationFrame(() => placePillDot(true));

  return h('div', { class: 'contents' }, mobile, topBar({ role, items, active, navigate, notifications, account }));
}

function navPill(it, active, navigate) {
  const isActive = active === it.id;
  return h('button', {
    type: 'button', 'aria-label': it.label, 'aria-current': isActive ? 'page' : null,
    class: 'relative z-10 inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-100 active:scale-95 transition-transform',
    onClick: () => navigate(it.path)
  },
    Icon(it.icon, { size: 22, color: isActive ? '#fff' : 'var(--gray-500)' })
  );
}

function topBar({ role, items, active, navigate, notifications, account }) {
  const menu = getUI(MENU_KEY, { menuOpen: false });
  const go = (path) => { setUI(MENU_KEY, { menuOpen: false }); navigate(path); };

  const logo = h('button', { type: 'button', class: 'inline-flex items-center pl-1 rounded-full outline-none focus-visible:ring-4 focus-visible:ring-brand-100', 'aria-label': 'Bicos, ir para o início', onClick: () => go('/mural') }, Logo());

  // One shared underline for the tabs, just under the icons; it slides between tabs.
  const indicator = h('span', {
    'aria-hidden': 'true',
    class: 'nav-indicator pointer-events-none absolute left-0 top-[calc(100%+0.375rem)] h-[2px] rounded-full bg-brand-500',
    style: lastIndicator ? { transform: `translateX(${lastIndicator.x}px)`, width: `${lastIndicator.w}px` } : { opacity: '0' }
  });
  const tabs = h('nav', { 'aria-label': 'Navegação principal', class: 'relative flex items-center gap-7 xl:gap-9' },
    ...items.map((it) => topTab(it, active, go)),
    indicator
  );
  requestAnimationFrame(() => placeIndicator(true));

  const bell = h('button', {
    type: 'button', 'aria-label': notifications ? `Notificações, ${notifications} novas` : 'Notificações', title: 'Notificações',
    class: 'relative inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/70 text-concrete-900 ring-1 ring-concrete-900/5 transition-colors hover:bg-white',
    onClick: () => go('/notificacoes')
  },
    Icon('bell', { size: 18 }),
    notifications ? h('span', { class: 'absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-danger-500 text-white text-[0.625rem] font-bold leading-[1.125rem] text-center ring-2 ring-white' }, String(notifications)) : null
  );

  const avatar = h('span', { class: cx('inline-flex items-center justify-center w-8 h-8 rounded-full overflow-hidden text-xs font-bold', role === 'recrutador' ? 'bg-brand-50' : 'bg-accent-50 text-accent-600') },
    account.photo ? h('img', { src: account.photo, alt: '', class: 'w-full h-full object-cover' })
      : role === 'recrutador' ? Icon('building-2', { size: 16, color: 'var(--brand)' }) : (account.initials || '')
  );

  const menuButton = h('button', {
    type: 'button', 'aria-label': 'Menu da conta', 'aria-haspopup': 'menu', 'aria-expanded': menu.menuOpen ? 'true' : 'false',
    class: cx('inline-flex items-center gap-2.5 h-11 pl-3.5 pr-1.5 rounded-full border bg-white/80 transition-shadow hover:bg-white hover:shadow-raised', menu.menuOpen ? 'border-concrete-300 shadow-raised' : 'border-concrete-200'),
    onClick: () => setUI(MENU_KEY, { menuOpen: !menu.menuOpen })
  }, Icon('menu', { size: 18, color: 'var(--gray-700)' }), avatar);

  const dropdown = menu.menuOpen ? [
    h('div', { class: 'fixed inset-0 z-40', 'aria-hidden': 'true', onClick: () => setUI(MENU_KEY, { menuOpen: false }) }),
    h('div', { role: 'menu', class: 'absolute right-0 top-full mt-3 z-50 w-72 py-2 bg-white rounded-2xl border border-concrete-200 shadow-float animate-fade-in' },
      h('div', { class: 'flex items-center gap-3 px-4 pt-2 pb-3' },
        h('span', { class: cx('inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden shrink-0 text-sm font-bold', role === 'recrutador' ? 'bg-brand-50' : 'bg-accent-50 text-accent-600') },
          account.photo ? h('img', { src: account.photo, alt: '', class: 'w-full h-full object-cover' })
            : role === 'recrutador' ? Icon('building-2', { size: 20, color: 'var(--brand)' }) : (account.initials || '')
        ),
        h('div', { class: 'flex flex-col min-w-0' },
          h('span', { class: 'font-semibold text-concrete-900 truncate' }, account.name || ''),
          h('span', { class: 'text-sm text-concrete-500 truncate' }, role === 'recrutador' ? 'Conta de recrutador' : 'Conta de trabalhador')
        )
      ),
      h('div', { class: 'h-px bg-concrete-200 my-1' }),
      ...(MENU[role] || MENU.trabalhador).map((m) => menuItem(m, () => go(m.path))),
      h('div', { class: 'h-px bg-concrete-200 my-1' }),
      menuItem({ icon: 'log-out', label: 'Sair da conta', danger: true }, () => go('/login'))
    )
  ] : [];

  // Logo on the left, tabs centred, notifications and account on the right. At the top of
  // the page it sits flat on the page; once you scroll it lifts into a floating frosted
  // island (the desktop sibling of the phone's tab bar), and settles back at the top.
  return h('header', { class: cx('app-header hidden lg:block sticky top-0 z-30 page-x pt-3 pb-2 pointer-events-none', window.scrollY > 8 ? 'is-scrolled' : '') },
    h('div', { class: 'app-island pointer-events-auto w-full max-w-[1000px] mx-auto h-[4.25rem] grid grid-cols-[1fr_auto_1fr] items-center gap-6 pl-3 pr-2.5 rounded-full' },
      h('div', { class: 'flex items-center min-w-0' }, logo),
      tabs,
      h('div', { class: 'flex items-center justify-end gap-2' },
        bell,
        h('div', { class: 'relative' }, menuButton, ...dropdown)
      )
    )
  );
}

function topTab(it, active, go) {
  const isActive = active === it.id;
  return h('button', {
    type: 'button', 'aria-current': isActive ? 'page' : null,
    class: cx('group relative inline-flex items-center gap-2.5 rounded-xl text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-4 focus-visible:ring-brand-100', isActive ? 'text-concrete-900' : 'text-concrete-500 hover:text-concrete-900'),
    onClick: () => go(it.path)
  },
    h('span', {
      class: cx('relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200',
        isActive ? 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-raised' : 'bg-concrete-100 text-concrete-600 group-hover:bg-concrete-200 group-hover:scale-105')
    },
      Icon(it.icon, { size: 19 })
    ),
    it.desktopLabel || it.label
  );
}

function menuItem(m, onClick) {
  return h('button', {
    type: 'button', role: 'menuitem',
    class: cx('w-full flex items-center gap-3 px-4 h-11 text-left text-[0.9375rem] transition-colors hover:bg-concrete-50', m.danger ? 'text-danger-500 font-semibold' : 'text-concrete-800'),
    onClick
  }, Icon(m.icon, { size: 18, color: m.danger ? 'var(--red-500)' : 'var(--gray-500)' }), m.label);
}
