import { createElement, use, type ComponentType } from 'react';
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
      promise = load().then((m) => {
        loaded = m;
        return m;
      });
    }
    return promise;
  };
  function Component(props: ScreenProps) {
    const mod = loaded ?? use(preload());
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
const JobPublished = screen(() => import('./pages/recruiter/JobPublished'));
const JobManage = screen(() => import('./pages/recruiter/JobManage'));
const JobClosed = screen(() => import('./pages/recruiter/JobClosed'));
const BoostJob = screen(() => import('./pages/recruiter/BoostJob'));
const History = screen(() => import('./pages/recruiter/History'));

// Order matters only for documentation: every pattern is anchored (^…$), so at most one matches.
export const ROUTES: CompiledRoute<Screen>[] = [
  compileRoute('/splash', Splash),
  compileRoute('/escolha-perfil', ChooseProfile),
  compileRoute('/cadastro/:role', Signup),
  compileRoute('/verificar-email', VerifyEmail),
  compileRoute('/completar-perfil/:role', CompleteProfile),
  compileRoute('/login', Login),
  compileRoute('/esqueci-senha', ForgotPassword),
  compileRoute('/redefinir-senha', ResetPassword),
  compileRoute('/notificacoes', Notifications),
  compileRoute('/configuracoes', Settings),
  compileRoute('/configuracoes/privacidade', Privacy),

  compileRoute('/mural', Feed),
  compileRoute('/vaga/:id', JobDetail),
  compileRoute('/confirmar/:id', ConfirmApplication),
  compileRoute('/enviado/:id', ApplicationSent),
  compileRoute('/minhas-candidaturas', MyApplications),
  compileRoute('/vagas-salvas', SavedJobs),
  compileRoute('/selecionado/:id', Selected),
  compileRoute('/avaliar/:id', RateJob),

  compileRoute('/perfil', WorkerProfile),
  compileRoute('/perfil/editar', EditWorkerProfile),
  compileRoute('/trabalhador/:id', WorkerProfile),
  compileRoute('/trabalhador/:id/:jobId', WorkerProfile),

  compileRoute('/empresa', CompanyProfile),
  compileRoute('/empresa/editar', EditCompanyProfile),
  compileRoute('/construtora/:id', CompanyProfile),
  compileRoute('/avaliacoes/:type/:id', Reviews),

  compileRoute('/criar-vaga', CreateJob),
  compileRoute('/vaga-publicada/:id', JobPublished),
  compileRoute('/vaga-gerenciar/:id', JobManage),
  compileRoute('/fechado/:id', JobClosed),
  compileRoute('/impulsionar/:id', BoostJob),
  compileRoute('/historico', History)
];

const AUTH_FLOW = new Set([
  '/splash',
  '/escolha-perfil',
  '/verificar-email',
  '/login',
  '/esqueci-senha',
  '/redefinir-senha'
]);

/** Sign-in/sign-up screens render full-bleed, without the app navigation. */
export function isAuthFlow(path: string): boolean {
  if (AUTH_FLOW.has(path)) return true;
  return path.startsWith('/cadastro/') || path.startsWith('/completar-perfil/');
}

export function preloadAllScreens(): void {
  for (const r of ROUTES) void r.value.preload();
}
