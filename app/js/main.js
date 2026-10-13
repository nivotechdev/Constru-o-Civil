import { mount, cx } from './dom.js';
import { route, onRouteChange, startRouter, navigate, currentPath } from './router.js';
import * as store from './store.js';
import { AppNav } from './components/AppNav.js';

import renderSplash from './screens/shared/Splash.js';
import renderChooseProfile from './screens/shared/ChooseProfile.js';
import renderSignup from './screens/shared/Signup.js';
import renderVerifyEmail from './screens/shared/VerifyEmail.js';
import renderCompleteProfile from './screens/shared/CompleteProfile.js';
import renderLogin from './screens/shared/Login.js';
import renderForgotPassword from './screens/shared/ForgotPassword.js';
import renderResetPassword from './screens/shared/ResetPassword.js';
import renderNotifications from './screens/shared/Notifications.js';
import renderSettings from './screens/shared/Settings.js';
import renderPrivacy from './screens/shared/Privacy.js';
import renderWorkerProfile from './screens/shared/WorkerProfileScreen.js';
import renderEditWorkerProfile from './screens/shared/EditWorkerProfile.js';
import renderCompanyProfile from './screens/shared/CompanyProfileScreen.js';
import renderEditCompanyProfile from './screens/shared/EditCompanyProfile.js';
import renderReviews from './screens/shared/ReviewsScreen.js';

import renderFeed from './screens/worker/Feed.js';
import renderJobDetail from './screens/worker/JobDetail.js';
import renderConfirmApplication from './screens/worker/ConfirmApplication.js';
import renderApplicationSent from './screens/worker/ApplicationSent.js';
import renderMyApplications from './screens/worker/MyApplications.js';
import renderSavedJobs from './screens/worker/SavedJobs.js';
import renderSelected from './screens/worker/Selected.js';
import renderRateJob from './screens/worker/RateJob.js';

import renderCreateJob from './screens/recruiter/CreateJob.js';
import renderJobPublished from './screens/recruiter/JobPublished.js';
import renderJobManage from './screens/recruiter/JobManage.js';
import renderJobClosed from './screens/recruiter/JobClosed.js';
import renderBoostJob from './screens/recruiter/BoostJob.js';
import renderHistory from './screens/recruiter/History.js';

route('/splash', () => renderSplash(navigate));
route('/escolha-perfil', () => renderChooseProfile(navigate));
route('/cadastro/:role', (p) => renderSignup(navigate, p));
route('/verificar-email', () => renderVerifyEmail(navigate));
route('/completar-perfil/:role', (p) => renderCompleteProfile(navigate, p));
route('/login', () => renderLogin(navigate));
route('/esqueci-senha', () => renderForgotPassword(navigate));
route('/redefinir-senha', () => renderResetPassword(navigate));
route('/notificacoes', () => renderNotifications(navigate));
route('/configuracoes', () => renderSettings(navigate));
route('/configuracoes/privacidade', () => renderPrivacy(navigate));

route('/mural', () => renderFeed(navigate));
route('/vaga/:id', (p) => renderJobDetail(navigate, p));
route('/confirmar/:id', (p) => renderConfirmApplication(navigate, p));
route('/enviado/:id', (p) => renderApplicationSent(navigate, p));
route('/minhas-candidaturas', () => renderMyApplications(navigate));
route('/vagas-salvas', () => renderSavedJobs(navigate));
route('/selecionado/:id', (p) => renderSelected(navigate, p));
route('/avaliar/:id', (p) => renderRateJob(navigate, p));

route('/perfil', () => renderWorkerProfile(navigate, {}));
route('/perfil/editar', () => renderEditWorkerProfile(navigate));
route('/trabalhador/:id', (p) => renderWorkerProfile(navigate, p));
route('/trabalhador/:id/:jobId', (p) => renderWorkerProfile(navigate, p));

route('/empresa', () => renderCompanyProfile(navigate, {}));
route('/empresa/editar', () => renderEditCompanyProfile(navigate));
route('/construtora/:id', (p) => renderCompanyProfile(navigate, p));
route('/avaliacoes/:type/:id', (p) => renderReviews(navigate, p));

route('/criar-vaga', () => renderCreateJob(navigate));
route('/vaga-publicada/:id', (p) => renderJobPublished(navigate, p));
route('/vaga-gerenciar/:id', (p) => renderJobManage(navigate, p));
route('/fechado/:id', (p) => renderJobClosed(navigate, p));
route('/impulsionar/:id', (p) => renderBoostJob(navigate, p));
route('/historico', () => renderHistory(navigate));

const AUTH_FLOW = new Set(['/splash', '/escolha-perfil', '/verificar-email', '/login', '/esqueci-senha', '/redefinir-senha']);
const TAB_ROOTS = { trabalhador: new Set(['/mural', '/minhas-candidaturas', '/perfil']), recrutador: new Set(['/mural', '/criar-vaga', '/empresa']) };

function isAuthFlow(path) {
  if (AUTH_FLOW.has(path)) return true;
  return path.startsWith('/cadastro/') || path.startsWith('/completar-perfil/');
}

// Desktop/tablet content width per screen: the mural spans the whole window, focused
// tasks (forms, confirmations) get a narrow centered column, everything else a page column.
const NARROW_SCREENS = new Set([
  '/criar-vaga', '/perfil/editar', '/empresa/editar', '/configuracoes', '/configuracoes/privacidade', '/notificacoes',
  '/confirmar/:id', '/enviado/:id', '/avaliar/:id', '/selecionado/:id', '/vaga-publicada/:id', '/impulsionar/:id',
  '/fechado/:id', '/avaliacoes/:type/:id'
]);

const appEl = document.getElementById('app');

function build(m, path) {
  const content = m.handler(m.params);

  if (isAuthFlow(path)) {
    return content;
  }

  const role = store.getRole();
  const activeId = tabIdForPath(path, role);
  const isMural = path === '/mural';

  const showMobileNav = TAB_ROOTS[role] && TAB_ROOTS[role].has(path);
  const nav = AppNav({
    role, active: activeId, navigate, showMobilePill: showMobileNav,
    notifications: role === 'recrutador' ? 3 : 2, account: accountSummary(role)
  });

  const shell = document.createElement('div');
  shell.className = cx('lg:flex lg:flex-col lg:min-h-screen', isMural ? 'bg-white' : '');
  shell.appendChild(nav);
  const main = document.createElement('main');
  main.className = cx(
    'flex-1 min-w-0',
    showMobileNav ? 'pb-28 lg:pb-0' : '',
    isMural ? 'bg-white min-h-screen' : cx('lg:w-full lg:mx-auto lg:px-8 lg:pt-8 lg:pb-16', NARROW_SCREENS.has(m.pattern) ? 'lg:max-w-[40rem]' : 'lg:max-w-panel')
  );
  main.appendChild(content);
  shell.appendChild(main);
  return shell;
}

function accountSummary(role) {
  if (role === 'recrutador') {
    const company = store.currentCompany();
    return { name: company.name, photo: store.getUI('company-profile', { capa: null, logo: null, deleteId: null }).logo };
  }
  const worker = store.currentWorker();
  return { name: worker.name, initials: worker.initials };
}

function tabIdForPath(path, role) {
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

function notFoundScreen() {
  const div = document.createElement('div');
  div.className = 'flex flex-col items-center justify-center min-h-screen gap-3 text-center px-6';
  div.innerHTML = '<h1 class="font-display font-bold text-2xl text-concrete-900">Página não encontrada</h1><p class="text-concrete-500">Volte para o início.</p>';
  return div;
}

let lastRender = null; // { m, path } — a store-triggered re-render (no args) replays the current route

function render(m, path) {
  if (path === undefined) {
    if (!lastRender) return;
    ({ m, path } = lastRender);
  } else {
    lastRender = { m, path };
  }

  if (path === '/') { navigate('/splash', { replace: true }); return; }
  if (!m) { mount(appEl, notFoundScreen()); return; }

  const captured = captureFocus();
  mount(appEl, build(m, path));
  applyFocus(captured);
}

onRouteChange((m, path) => {
  window.scrollTo(0, 0);
  store.getUI('app-nav', { menuOpen: false }).menuOpen = false; // a route change always closes the account menu
  render(m, path);
});

function captureFocus() {
  const active = document.activeElement;
  if (!active || !appEl.contains(active)) return null;
  const id = active.getAttribute('data-focus-id');
  if (!id) return null;
  return { id, start: active.selectionStart, end: active.selectionEnd };
}

function applyFocus(captured) {
  if (!captured) return;
  const el = appEl.querySelector(`[data-focus-id="${cssEscape(captured.id)}"]`);
  if (!el) return;
  el.focus();
  if (typeof captured.start === 'number' && el.setSelectionRange) {
    try { el.setSelectionRange(captured.start, captured.end); } catch (e) { /* not a text-selectable input */ }
  }
}

function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

store.subscribe(render);
startRouter();
