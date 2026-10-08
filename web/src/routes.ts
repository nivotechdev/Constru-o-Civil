import { createElement, use, type ComponentType } from 'react';
import type { Access } from './services/guards';
import { compileRoute, type CompiledRoute } from './services/router';
import type { ScreenProps } from './types/screen';

type ScreenModule = { default: ComponentType<ScreenProps> };
type Loader = () => Promise<ScreenModule>;

interface Screen {
  Component: ComponentType<ScreenProps>;
  /** Starts (or reuses) the download of the screen's chunk. */
  preload: () => Promise<ScreenModule>;
  isLoaded: () => boolean;
}

// Each screen is its own chunk (code splitting). Every chunk is also prefetched once the browser is
// idle (see App.tsx). Unlike React.lazy — which suspends for a tick even when the chunk is already
// there — a loaded screen renders synchronously, so navigating never shows an empty frame, just like
// the legacy app.
function screen(load: Loader): Screen {
  let loaded: ScreenModule | null = null;
  let promise: Promise<ScreenModule> | null = null;
  const preload = () => {
    if (!promise) {
      const p = load().then((m) => {
        loaded = m;
        // Marked the way React's use() reads a settled promise, so a screen whose chunk is already
        // here renders synchronously instead of suspending for a tick.
        Object.assign(p, { status: 'fulfilled', value: m });
        return m;
      });
      promise = p;
    }
    return promise;
  };
  function Component(props: ScreenProps) {
    // Always called (never conditionally): use() returns at once for a chunk that is already loaded.
    const mod = use(preload());
    return createElement(mod.default, props);
  }
  return { Component, preload, isLoaded: () => loaded !== null };
}

const Splash = screen(() => import('./pages/shared/Splash'));
const ChooseProfile = screen(() => import('./pages/shared/ChooseProfile'));
const Signup = screen(() => import('./pages/shared/Signup'));
const VerifyEmail = screen(() => import('./pages/shared/VerifyEmail'));
const CompleteProfile = screen(() => import('./pages/shared/CompleteProfile'));
const Login = screen(() => import('./pages/shared/Login'));
const ForgotPassword = screen(() => import('./pages/shared/ForgotPassword'));
const ResetPassword = screen(() => import('./pages/shared/ResetPassword'));
const Notifications = screen(() => import('./pages/shared/Notifications'));
const Settings = screen(() => import('./pages/shared/Settings'));
const Privacy = screen(() => import('./pages/shared/Privacy'));
const Terms = screen(() => import('./pages/shared/Terms'));
const DeleteAccount = screen(() => import('./pages/shared/DeleteAccount'));
const AccountDeleted = screen(() => import('./pages/shared/AccountDeleted'));
const PrivacyPolicy = screen(() => import('./pages/shared/PrivacyPolicy'));
const WorkerProfile = screen(() => import('./pages/shared/WorkerProfileScreen'));
const EditWorkerProfile = screen(() => import('./pages/shared/EditWorkerProfile'));
const CompanyProfile = screen(() => import('./pages/shared/CompanyProfileScreen'));
const EditCompanyProfile = screen(() => import('./pages/shared/EditCompanyProfile'));
const Reviews = screen(() => import('./pages/shared/ReviewsScreen'));

const Feed = screen(() => import('./pages/worker/feed/Feed'));
const JobDetail = screen(() => import('./pages/worker/JobDetail'));
const ConfirmApplication = screen(() => import('./pages/worker/ConfirmApplication'));
const ApplicationSent = screen(() => import('./pages/worker/ApplicationSent'));
const MyApplications = screen(() => import('./pages/worker/MyApplications'));
const SavedJobs = screen(() => import('./pages/worker/SavedJobs'));
const Selected = screen(() => import('./pages/worker/Selected'));
const RateJob = screen(() => import('./pages/worker/RateJob'));

const CreateJob = screen(() => import('./pages/recruiter/CreateJob'));
const EditJob = screen(() => import('./pages/recruiter/EditJob'));
const JobPublished = screen(() => import('./pages/recruiter/JobPublished'));
const JobManage = screen(() => import('./pages/recruiter/JobManage'));
const JobClosed = screen(() => import('./pages/recruiter/JobClosed'));
const BoostJob = screen(() => import('./pages/recruiter/BoostJob'));
const BoostPayment = screen(() => import('./pages/recruiter/BoostPayment'));
const History = screen(() => import('./pages/recruiter/History'));
const RateWorker = screen(() => import('./pages/recruiter/RateWorker'));

export interface RouteDef extends Screen {
  /** Who may open it (see services/guards.ts). */
  access: Access;
}

const guest = (s: Screen): RouteDef => ({ ...s, access: 'guest' });
const onboarding = (s: Screen): RouteDef => ({ ...s, access: 'onboarding' });
const anyone = (s: Screen): RouteDef => ({ ...s, access: 'public' });
const app = (s: Screen): RouteDef => ({ ...s, access: 'app' });
const worker = (s: Screen): RouteDef => ({ ...s, access: 'trabalhador' });
const company = (s: Screen): RouteDef => ({ ...s, access: 'recrutador' });

// Order matters only for documentation: every pattern is anchored (^…$), so at most one matches.
export const ROUTES: CompiledRoute<RouteDef>[] = [
  compileRoute('/splash', guest(Splash)),
  compileRoute('/escolha-perfil', guest(ChooseProfile)),
  compileRoute('/cadastro/:role', guest(Signup)),
  compileRoute('/verificar-email', onboarding(VerifyEmail)),
  compileRoute('/completar-perfil/:role', onboarding(CompleteProfile)),
  compileRoute('/login', guest(Login)),
  compileRoute('/esqueci-senha', anyone(ForgotPassword)),
  compileRoute('/redefinir-senha', anyone(ResetPassword)),
  compileRoute('/termos', anyone(Terms)),
  compileRoute('/privacidade', anyone(PrivacyPolicy)),
  compileRoute('/notificacoes', app(Notifications)),
  compileRoute('/configuracoes', app(Settings)),
  compileRoute('/configuracoes/privacidade', app(Privacy)),
  compileRoute('/configuracoes/excluir-conta', app(DeleteAccount)),
  compileRoute('/conta-excluida', anyone(AccountDeleted)),

  compileRoute('/mural', app(Feed)),
  compileRoute('/vaga/:id', app(JobDetail)),
  compileRoute('/confirmar/:id', worker(ConfirmApplication)),
  compileRoute('/enviado/:id', worker(ApplicationSent)),
  compileRoute('/minhas-candidaturas', worker(MyApplications)),
  compileRoute('/vagas-salvas', worker(SavedJobs)),
  compileRoute('/selecionado/:id', worker(Selected)),
  compileRoute('/avaliar/:id', worker(RateJob)),

  compileRoute('/perfil', worker(WorkerProfile)),
  compileRoute('/perfil/editar', worker(EditWorkerProfile)),
  compileRoute('/trabalhador/:id', app(WorkerProfile)),
  compileRoute('/trabalhador/:id/:jobId', company(WorkerProfile)),

  compileRoute('/empresa', company(CompanyProfile)),
  compileRoute('/empresa/editar', company(EditCompanyProfile)),
  compileRoute('/construtora/:id', app(CompanyProfile)),
  compileRoute('/avaliacoes/:type/:id', app(Reviews)),

  compileRoute('/criar-vaga', company(CreateJob)),
  compileRoute('/vaga-editar/:id', company(EditJob)),
  compileRoute('/vaga-publicada/:id', company(JobPublished)),
  compileRoute('/vaga-gerenciar/:id', company(JobManage)),
  compileRoute('/fechado/:id', company(JobClosed)),
  compileRoute('/impulsionar/:id', company(BoostJob)),
  compileRoute('/impulsionar/:id/:plan', company(BoostPayment)),
  compileRoute('/historico', company(History)),
  compileRoute('/avaliar-trabalhador/:jobId/:workerId', company(RateWorker))
];

const AUTH_FLOW = new Set([
  '/splash',
  '/escolha-perfil',
  '/verificar-email',
  '/login',
  '/esqueci-senha',
  '/redefinir-senha',
  '/termos',
  '/privacidade',
  '/conta-excluida'
]);

/** Sign-in/sign-up screens render full-bleed, without the app navigation. */
export function isAuthFlow(path: string): boolean {
  if (AUTH_FLOW.has(path)) return true;
  return path.startsWith('/cadastro/') || path.startsWith('/completar-perfil/');
}

export function preloadAllScreens(): void {
  for (const r of ROUTES) void r.value.preload();
}
