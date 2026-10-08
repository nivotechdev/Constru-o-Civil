// The app's single source of truth — a typed port of the legacy in-memory store (app/js/store.js).
//
// Without a Supabase project configured, the "database" is seeded from data/seed.ts and lives only in
// memory, exactly like the legacy app (a reload brings the seed back) — every mutation below has this
// mock branch, unchanged, so the existing mock/parity test suites keep passing. Once
// `isSupabaseConfigured()` is true, the same exported functions instead read and write the real
// project (see supabaseMappers.ts for the row <-> domain translation) and `db` starts empty, filled in
// by the `ensureXLoaded` functions below as screens need each slice.
//
// Every mutation is declared `async` so both branches share one call signature. The mock branch never
// awaits anything inside itself, so it still finishes synchronously before the function returns its
// Promise — callers (and the mock/parity tests, which call these without awaiting) keep seeing the
// mutation applied immediately, exactly like before.
import * as seed from '../data/seed';
import type {
  Application,
  ApplicationStatus,
  Company,
  Database,
  Decision,
  Job,
  Role,
  Worker,
  WorkerPost
} from '../types/models';
import { applicationFor, applicationsForJob, approvedCount } from './selectors';
import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  companyFromOwnProfile,
  companyFromPerfilPublico,
  jobToVagaInsert,
  mapCandidaturaRow,
  mapPublicacaoRow,
  mapVagaRow,
  placeholderCompany,
  placeholderWorker,
  reviewSummaryFromRows,
  workerFromOwnProfile,
  workerFromPerfilPublico,
  type AvaliacaoRowWithAvaliador
} from './supabaseMappers';
import type { Session } from '@supabase/supabase-js';
import type { TableRow, TableUpdate } from '../types/supabase';

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function emptyDb(): Database {
  return {
    companies: {},
    workers: {},
    jobs: {},
    applications: [],
    savedJobIds: [],
    deletedJobIds: [],
    workerPosts: []
  };
}

function freshDb(): Database {
  if (isSupabaseConfigured()) return emptyDb();
  return {
    companies: clone(seed.COMPANIES),
    workers: clone(seed.WORKERS),
    jobs: clone(seed.JOBS),
    applications: clone(seed.APPLICATIONS),
    savedJobIds: [...seed.SAVED_JOB_IDS],
    deletedJobIds: [],
    workerPosts: clone(seed.WORKER_POSTS)
  };
}

interface State {
  /** Demo account switch (mock mode) — which side of the marketplace is "logged in". Real mode
   *  derives the role from `profile.tipo` instead (see `getRole`); this field is then unused. */
  role: Role;
  db: Database;
  /** Screen-local UI state, keyed per screen. It survives navigation, like the legacy `ui` bag. */
  ui: Record<string, object>;
  // ---- real mode only, below ----
  session: Session | null;
  profile: TableRow<'profiles'> | null;
  /** Becomes true once the initial session/profile check has resolved. */
  authReady: boolean;
  /** CPF/CNPJ decrypted on demand via the `meu_documento` RPC. */
  myDocumento: string | null;
}

let state: State = {
  role: 'trabalhador',
  db: freshDb(),
  ui: {},
  session: null,
  profile: null,
  authReady: !isSupabaseConfigured(),
  myDocumento: null
};

const listeners = new Set<() => void>();
let version = 0;

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(): void {
  version++;
  listeners.forEach((fn) => fn());
}

/** Increments on every store change (see components/LegacyRerender.tsx and layouts/AppShell.tsx). */
export function getVersion(): number {
  return version;
}

export function getRole(): Role {
  if (state.profile) return state.profile.tipo === 'construtora' ? 'recrutador' : 'trabalhador';
  return state.role;
}

export function getDb(): Database {
  return state.db;
}

export function setRole(role: Role): void {
  state = { ...state, role };
  notify();
}

// ---- session & profile (real mode) ----

export function isAuthReady(): boolean {
  return state.authReady;
}
export function getSession(): Session | null {
  return state.session;
}
export function isSignedIn(): boolean {
  return Boolean(state.session);
}
export function getProfile(): TableRow<'profiles'> | null {
  return state.profile;
}
export function getMyDocumento(): string | null {
  return state.myDocumento;
}

// Mesma lista de colunas usada aqui e em updateProfile() — se um campo novo entrar em `profiles` e
// for editável, precisa entrar nos dois lugares, senão ele salva certinho mas some da tela no próximo
// carregamento de sessão (bug real do front vanilla, fase 4).
const PROFILE_COLUMNS =
  'id, nome, email, tipo, ativo, criado_em, atualizado_em, cargo, regiao, especialidades, tipo_obra, regiao_atuacao, foto_url, capa_url, whatsapp, biografia';

/** Seeds `db.companies[uid]`/`db.workers[uid]` from the freshly loaded profile, if it has a `tipo` yet. */
function cacheOwnProfile(row: TableRow<'profiles'>, cnpj: string | null): void {
  if (row.tipo === 'construtora') {
    updateDb((db) => ({ ...db, companies: { ...db.companies, [row.id]: companyFromOwnProfile(row, cnpj) } }));
  } else if (row.tipo === 'pedreiro') {
    updateDb((db) => ({ ...db, workers: { ...db.workers, [row.id]: workerFromOwnProfile(row) } }));
  }
}

async function loadProfile(userId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  if (!error && data) {
    state.profile = data as unknown as TableRow<'profiles'>;
    cacheOwnProfile(state.profile, null);
    return;
  }
  // A troca de sessão pode chegar um instante antes do trigger que cria a linha de profile terminar
  // de gravar — uma única retentativa cobre essa corrida.
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const retry = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  state.profile = retry.error ? null : (retry.data as unknown as TableRow<'profiles'>);
  if (state.profile) cacheOwnProfile(state.profile, null);
}

async function ensureConsentimentos(userId: string): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase.from('consentimentos').select('id').eq('usuario_id', userId).limit(1);
  if (error || (data && data.length)) return;
  const hoje = new Date().toISOString().slice(0, 10);
  await supabase.from('consentimentos').insert([
    { usuario_id: userId, documento: 'termos_de_uso', versao: hoje },
    { usuario_id: userId, documento: 'politica_privacidade', versao: hoje }
  ]);
}

let lastUserId: string | null | undefined;

/** Call once at startup (see main.tsx). No-op in mock mode. */
export async function initAuth(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabase();
  if (!supabase) return;

  const {
    data: { session }
  } = await supabase.auth.getSession();
  state.session = session;
  lastUserId = session?.user?.id || null;
  if (session) {
    await loadProfile(session.user.id);
    await ensureConsentimentos(session.user.id);
  }
  state.authReady = true;
  notify();

  supabase.auth.onAuthStateChange(async (_event, nextSession) => {
    const uid = nextSession?.user?.id || null;
    // Troca de conta na mesma aba (logout seguido de login com outro usuário) — sem isso, os caches
    // "carreguei uma vez" abaixo continuam achando que já têm os dados certos e nunca buscam de novo,
    // vazando o que a conta anterior via para a conta nova (bug real do front vanilla, fase 5).
    if (uid !== lastUserId) resetSessionCaches();
    lastUserId = uid;
    state.session = nextSession;
    if (nextSession) {
      await loadProfile(nextSession.user.id);
      await ensureConsentimentos(nextSession.user.id);
    } else {
      state.profile = null;
    }
    notify();
  });
}

/**
 * Forces an immediate session/profile read, bypassing the `onAuthStateChange` race: right after
 * `signInWithPassword` resolves, that listener has been scheduled but not necessarily run yet, so a
 * caller that needs the profile right away (Login's post-sign-in redirect) awaits this instead.
 */
export async function refreshSession(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await getSupabase();
  if (!supabase) return;
  const {
    data: { session }
  } = await supabase.auth.getSession();
  state.session = session;
  if (session) await loadProfile(session.user.id);
  notify();
}

/** Whether the signed-in profile still needs the onboarding questions (`CompleteProfile`). */
export function profileNeedsCompleting(): boolean {
  if (!state.profile) return false;
  return state.profile.tipo === 'construtora' ? !state.profile.tipo_obra : !state.profile.cargo;
}

export async function ensureMyDocumentoLoaded(): Promise<void> {
  if (state.myDocumento !== null || !state.session) return;
  const supabase = await getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase.rpc('meu_documento');
  if (!error) {
    state.myDocumento = data || '';
    notify();
  }
}

export function currentUserId(): string | null {
  return state.session?.user?.id || null;
}

/** Limpa os caches "carreguei uma vez" quando a sessão troca de usuário na mesma aba. */
function resetSessionCaches(): void {
  profileLoaded.clear();
  reviewsLoaded.clear();
  portfolioLoaded.clear();
  jobApplicationsLoaded.clear();
  myApplicationsLoadedFor.clear();
  jobsLoaded = false;
  jobsLoading = false;
  savedJobsLoaded = false;
  state.db = freshDb();
  state.myDocumento = null;
}

// ---- companies & workers (real mode: lazy profile cache) ----

const profileLoaded = new Set<string>();

/** Fetches someone else's public profile (via `perfil_publico`) the first time it's needed. */
export async function ensureProfileLoaded(id: string | undefined | null): Promise<void> {
  if (!id || !isSupabaseConfigured() || state.db.companies[id] || state.db.workers[id] || profileLoaded.has(id))
    return;
  profileLoaded.add(id);
  const supabase = await getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase.rpc('perfil_publico', { p_id: id });
  const row = data?.[0];
  if (error || !row) {
    profileLoaded.delete(id);
    return;
  }
  updateDb((db) =>
    row.tipo === 'construtora'
      ? { ...db, companies: { ...db.companies, [id]: companyFromPerfilPublico(row) } }
      : { ...db, workers: { ...db.workers, [id]: workerFromPerfilPublico(row) } }
  );
}

// ---- screen UI state ----

export type UIDefaults<T extends object> = T | (() => T);

/** Returns the UI bag for `key`, creating it from `defaults` the first time (without notifying). */
export function getUI<T extends object>(key: string, defaults: UIDefaults<T>): T {
  if (!(key in state.ui)) {
    state.ui[key] = typeof defaults === 'function' ? (defaults as () => T)() : Object.assign({}, defaults);
  }
  return state.ui[key] as T;
}

export type UIPatch<T> = Partial<T> | ((current: T) => Partial<T>);

export function setUI<T extends object>(key: string, patch: UIPatch<T>): void {
  const cur = (state.ui[key] || {}) as T;
  const next = Object.assign({}, cur, typeof patch === 'function' ? patch(cur) : patch);
  state = { ...state, ui: { ...state.ui, [key]: next } };
  notify();
}

export function resetUI(key: string): void {
  const ui = { ...state.ui };
  delete ui[key];
  state = { ...state, ui };
  notify();
}

// ---- data mutations ----

function updateDb(recipe: (db: Database) => Database): void {
  state = { ...state, db: recipe(state.db) };
  notify();
}

export async function createJob(job: Job): Promise<string> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const insert = jobToVagaInsert(job, state.profile?.nome || null);
    const { data, error } = await supabase.from('vagas').insert(insert).select().single();
    if (error) throw error;
    const mapped = mapVagaRow(data);
    updateDb((db) => ({ ...db, jobs: { ...db.jobs, [mapped.id]: mapped } }));
    return mapped.id;
  }
  updateDb((db) => ({ ...db, jobs: { ...db.jobs, [job.id]: job } }));
  return job.id;
}

export function deleteJobPost(jobId: string): void {
  updateDb((db) => ({ ...db, deletedJobIds: [...db.deletedJobIds, jobId] }));
}

export async function updateJob(jobId: string, patch: Partial<Job>): Promise<void> {
  const job = state.db.jobs[jobId];
  if (!job) return;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const dbPatch: TableUpdate<'vagas'> = {};
    if ('photos' in patch) {
      dbPatch.fotos = patch.photos && patch.photos.length ? patch.photos : null;
      dbPatch.foto_url = patch.photos?.[0] || null;
    }
    if ('boosted' in patch) dbPatch.impulsionada = patch.boosted;
    if ('urgent' in patch) dbPatch.urgente = patch.urgent;
    const { data, error } = await supabase.from('vagas').update(dbPatch).eq('id', jobId).select().single();
    if (error) throw error;
    const mapped = mapVagaRow(data);
    updateDb((db) => ({ ...db, jobs: { ...db.jobs, [jobId]: mapped } }));
    return;
  }
  updateDb((db) => ({ ...db, jobs: { ...db.jobs, [jobId]: { ...job, ...patch } } }));
}

export async function updateCompany(companyId: string, patch: Partial<Company>): Promise<void> {
  if (isSupabaseConfigured()) {
    const dbPatch: TableUpdate<'profiles'> = {};
    if ('name' in patch) dbPatch.nome = patch.name;
    if ('tipoObra' in patch) dbPatch.tipo_obra = patch.tipoObra;
    if ('location' in patch) dbPatch.regiao_atuacao = patch.location;
    if ('whatsapp' in patch) dbPatch.whatsapp = patch.whatsapp;
    // Cover/logo photos aren't part of the Company model yet (they live in the screen-local UI bags
    // in sharedUI.ts) — real Storage upload for them is wired in the profiles/media follow-up phase.
    await updateOwnProfile(dbPatch);
    const company = state.db.companies[companyId] || placeholderCompany(companyId, patch.name || '');
    updateDb((db) => ({ ...db, companies: { ...db.companies, [companyId]: { ...company, ...patch } } }));
    return;
  }
  const company = state.db.companies[companyId];
  if (company) updateDb((db) => ({ ...db, companies: { ...db.companies, [companyId]: { ...company, ...patch } } }));
}

export async function updateWorker(workerId: string, patch: Partial<Worker>): Promise<void> {
  if (isSupabaseConfigured()) {
    const dbPatch: TableUpdate<'profiles'> = {};
    if ('name' in patch) dbPatch.nome = patch.name;
    if ('role' in patch) dbPatch.cargo = patch.role;
    if ('region' in patch) dbPatch.regiao = patch.region;
    if ('specialties' in patch) dbPatch.especialidades = patch.specialties;
    // Profile/cover photos: see the note in updateCompany above — same follow-up phase.
    await updateOwnProfile(dbPatch);
    const worker = state.db.workers[workerId] || placeholderWorker(workerId, patch.name || '');
    updateDb((db) => ({ ...db, workers: { ...db.workers, [workerId]: { ...worker, ...patch } } }));
    return;
  }
  const worker = state.db.workers[workerId];
  if (worker) updateDb((db) => ({ ...db, workers: { ...db.workers, [workerId]: { ...worker, ...patch } } }));
}

async function updateOwnProfile(patch: TableUpdate<'profiles'>): Promise<void> {
  const supabase = await getSupabase();
  if (!supabase || !state.session) throw new Error('Sem sessão.');
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', state.session.user.id)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  state.profile = { ...state.profile, ...(data as unknown as TableRow<'profiles'>) };
}

const isPending = (a: Application) => a.status === 'enviada' || a.status === 'em_analise';

export async function closeJob(jobId: string): Promise<void> {
  const job = state.db.jobs[jobId];
  if (!job) return;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { error } = await supabase.rpc('fechar_vaga', { p_vaga_id: jobId });
    if (error) throw error;
    const { data } = await supabase.from('vagas').select('*').eq('id', jobId).single();
    if (data) {
      const mapped = mapVagaRow(data);
      updateDb((db) => ({ ...db, jobs: { ...db.jobs, [jobId]: mapped } }));
    }
    await ensureApplicationsForJobLoaded(jobId, { force: true });
    return;
  }
  const hired = approvedCount(state.db, jobId) > 0;
  const closedJob: Job = { ...job, closed: true, ...(hired ? {} : { semContratacao: true }) };
  updateDb((db) => ({
    ...db,
    jobs: { ...db.jobs, [jobId]: closedJob },
    applications: db.applications.map((a) =>
      a.jobId === jobId && isPending(a) ? { ...a, status: 'nao_selecionado' } : a
    )
  }));
}

export async function applyToJob(jobId: string, workerId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { data, error } = await supabase
      .from('candidaturas')
      .insert({
        vaga_id: jobId,
        candidato_id: workerId,
        nome_candidato: state.profile?.nome || '',
        email_candidato: state.profile?.email || ''
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        await ensureMyApplicationsLoaded({ force: true });
        return;
      }
      throw error;
    }
    const app = mapCandidaturaRow(data);
    updateDb((db) => ({ ...db, applications: [...db.applications, app] }));
    return;
  }
  updateDb((db) =>
    applicationFor(db, jobId, workerId)
      ? db
      : { ...db, applications: [...db.applications, { id: 'a' + Date.now(), jobId, workerId, status: 'enviada' }] }
  );
}

export async function cancelApplication(jobId: string, workerId: string): Promise<void> {
  const app = applicationFor(state.db, jobId, workerId);
  if (!app) return;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { error } = await supabase.from('candidaturas').delete().eq('id', app.id);
    if (error) throw error;
    updateDb((db) => ({ ...db, applications: db.applications.filter((a) => a.id !== app.id) }));
    return;
  }
  const i = state.db.applications.findIndex((a) => a.jobId === jobId && a.workerId === workerId);
  if (i >= 0) updateDb((db) => ({ ...db, applications: db.applications.filter((_, k) => k !== i) }));
}

export async function decideApplication(jobId: string, workerId: string, decision: Decision): Promise<void> {
  const app = applicationFor(state.db, jobId, workerId);
  if (!app) return;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { error } = await supabase.rpc('decidir_candidatura', {
      p_candidatura_id: app.id,
      p_decisao: decision || 'recusado'
    });
    if (error) throw error;
    await ensureApplicationsForJobLoaded(jobId, { force: true });
    return;
  }
  const status =
    decision === 'aprovado' ? 'pre_selecionado' : decision === 'recusado' ? 'nao_selecionado' : 'em_analise';
  let db: Database = {
    ...state.db,
    applications: state.db.applications.map((a) => (a === app ? { ...a, status } : a))
  };
  const job = db.jobs[jobId];
  // Filling the last slot turns every still-pending candidate down.
  if (decision === 'aprovado' && job && approvedCount(db, jobId) >= (job.slots || 1)) {
    const pending = new Set(applicationsForJob(db, jobId).filter(isPending));
    db = {
      ...db,
      applications: db.applications.map((a) => (pending.has(a) ? { ...a, status: 'nao_selecionado' } : a))
    };
  }
  updateDb(() => db);
}

export async function markReviewed(
  jobId: string,
  workerId: string,
  review?: { nota: number; comentario?: string | null }
): Promise<void> {
  const app = applicationFor(state.db, jobId, workerId);
  if (!app) return;
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    if (app.status === 'pre_selecionado' || app.status === 'contratado') {
      const { error } = await supabase.rpc('concluir_candidatura', { p_candidatura_id: app.id });
      if (error) throw error;
    }
    const { error } = await supabase.rpc('postar_avaliacao', {
      p_candidatura_id: app.id,
      p_nota: review?.nota ?? 5,
      p_comentario: review?.comentario ?? null
    });
    if (error) throw error;
    updateDb((db) => ({
      ...db,
      applications: db.applications.map((a) => (a.id === app.id ? { ...a, status: 'avaliada' as ApplicationStatus } : a))
    }));
    return;
  }
  updateDb((db) => ({
    ...db,
    applications: db.applications.map((a) => (a === app ? { ...a, status: 'avaliada' } : a))
  }));
}

export async function toggleSavedJob(jobId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    const uid = state.session?.user?.id;
    if (!supabase || !uid) throw new Error('Sem sessão.');
    const saved = state.db.savedJobIds.includes(jobId);
    updateDb((db) => ({
      ...db,
      savedJobIds: saved ? db.savedJobIds.filter((id) => id !== jobId) : [...db.savedJobIds, jobId]
    }));
    if (saved) {
      const { error } = await supabase.from('vagas_salvas').delete().eq('trabalhador_id', uid).eq('vaga_id', jobId);
      if (error) {
        updateDb((db) => ({ ...db, savedJobIds: [...db.savedJobIds, jobId] }));
        throw error;
      }
    } else {
      const { error } = await supabase.from('vagas_salvas').insert({ trabalhador_id: uid, vaga_id: jobId });
      if (error && error.code !== '23505') {
        updateDb((db) => ({ ...db, savedJobIds: db.savedJobIds.filter((id) => id !== jobId) }));
        throw error;
      }
    }
    return;
  }
  updateDb((db) => ({
    ...db,
    savedJobIds: db.savedJobIds.includes(jobId)
      ? db.savedJobIds.filter((id) => id !== jobId)
      : [...db.savedJobIds, jobId]
  }));
}

export async function addWorkerPost(
  workerId: string,
  { mediaUrl, mediaType, caption }: Pick<WorkerPost, 'mediaUrl' | 'mediaType' | 'caption'>
): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { data, error } = await supabase
      .from('publicacoes_trabalhador')
      .insert({
        trabalhador_id: workerId,
        midia_url: mediaUrl || '',
        midia_tipo: mediaType === 'video' ? 'video' : 'imagem',
        legenda: caption || null
      })
      .select()
      .single();
    if (error) throw error;
    const post = mapPublicacaoRow(data);
    updateDb((db) => ({ ...db, workerPosts: [post, ...db.workerPosts] }));
    return;
  }
  const post: WorkerPost = {
    id: 'wp' + Date.now(),
    workerId,
    mediaUrl,
    mediaType,
    caption,
    date: new Date().toISOString().slice(0, 10)
  };
  updateDb((db) => ({ ...db, workerPosts: [post, ...db.workerPosts] }));
}

export async function deleteWorkerPost(postId: string): Promise<void> {
  const i = state.db.workerPosts.findIndex((p) => p.id === postId);
  if (i < 0) return;
  const removed = state.db.workerPosts[i];
  updateDb((db) => ({ ...db, workerPosts: db.workerPosts.filter((_, k) => k !== i) }));
  if (isSupabaseConfigured()) {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase indisponível.');
    const { error } = await supabase.from('publicacoes_trabalhador').delete().eq('id', postId);
    if (error) {
      updateDb((db) => ({ ...db, workerPosts: [...db.workerPosts.slice(0, i), removed, ...db.workerPosts.slice(i)] }));
      throw error;
    }
  }
}

// ---- real-mode data loading ----

let jobsLoaded = false;
let jobsLoading = false;

export async function ensureJobsLoaded(): Promise<void> {
  if (!isSupabaseConfigured() || jobsLoaded || jobsLoading) return;
  jobsLoading = true;
  const supabase = await getSupabase();
  if (!supabase) {
    jobsLoading = false;
    return;
  }
  const { data, error } = await supabase.from('vagas').select('*').order('criado_em', { ascending: false });
  jobsLoading = false;
  if (error || !data) return;
  const jobs: Record<string, Job> = {};
  const companies: Record<string, Company> = { ...state.db.companies };
  for (const row of data) {
    const job = mapVagaRow(row);
    jobs[job.id] = job;
    if (row.autor_nome && !companies[job.companyId]) {
      companies[job.companyId] = placeholderCompany(job.companyId, row.autor_nome, job.location);
    }
  }
  jobsLoaded = true;
  updateDb((db) => ({ ...db, jobs: { ...db.jobs, ...jobs }, companies }));
}

const jobApplicationsLoaded = new Set<string>();

export async function ensureApplicationsForJobLoaded(jobId: string, { force = false } = {}): Promise<void> {
  if (!isSupabaseConfigured() || (!force && jobApplicationsLoaded.has(jobId))) return;
  jobApplicationsLoaded.add(jobId);
  const supabase = await getSupabase();
  if (!supabase) {
    jobApplicationsLoaded.delete(jobId);
    return;
  }
  const { data, error } = await supabase.from('candidaturas').select('*').eq('vaga_id', jobId);
  if (error || !data) {
    jobApplicationsLoaded.delete(jobId);
    return;
  }
  const apps = data.map(mapCandidaturaRow);
  const workers: Record<string, Worker> = { ...state.db.workers };
  data.forEach((row) => {
    if (row.nome_candidato && !workers[row.candidato_id]) {
      workers[row.candidato_id] = placeholderWorker(row.candidato_id, row.nome_candidato);
    }
  });
  updateDb((db) => ({
    ...db,
    applications: [...db.applications.filter((a) => !apps.some((n) => n.id === a.id)), ...apps],
    workers
  }));
}

const myApplicationsLoadedFor = new Set<string>();

export async function ensureMyApplicationsLoaded({ force = false } = {}): Promise<void> {
  const uid = state.session?.user?.id;
  if (!isSupabaseConfigured() || !uid || (!force && myApplicationsLoadedFor.has(uid))) return;
  myApplicationsLoadedFor.add(uid);
  const supabase = await getSupabase();
  if (!supabase) {
    myApplicationsLoadedFor.delete(uid);
    return;
  }
  const { data, error } = await supabase.from('candidaturas').select('*').eq('candidato_id', uid);
  if (error || !data) {
    myApplicationsLoadedFor.delete(uid);
    return;
  }
  const apps = data.map(mapCandidaturaRow);
  updateDb((db) => ({
    ...db,
    applications: [...db.applications.filter((a) => !apps.some((n) => n.id === a.id)), ...apps]
  }));
}

let savedJobsLoaded = false;

export async function ensureSavedJobsLoaded(): Promise<void> {
  if (!isSupabaseConfigured() || savedJobsLoaded || !state.session) return;
  savedJobsLoaded = true;
  const supabase = await getSupabase();
  if (!supabase) {
    savedJobsLoaded = false;
    return;
  }
  const { data, error } = await supabase
    .from('vagas_salvas')
    .select('vaga_id')
    .eq('trabalhador_id', state.session.user.id);
  if (error || !data) {
    savedJobsLoaded = false;
    return;
  }
  updateDb((db) => ({ ...db, savedJobIds: data.map((r) => r.vaga_id) }));
}

const portfolioLoaded = new Set<string>();

export async function ensurePortfolioLoaded(workerId: string | undefined | null): Promise<void> {
  if (!workerId || !isSupabaseConfigured() || portfolioLoaded.has(workerId)) return;
  portfolioLoaded.add(workerId);
  const supabase = await getSupabase();
  if (!supabase) {
    portfolioLoaded.delete(workerId);
    return;
  }
  const { data, error } = await supabase
    .from('publicacoes_trabalhador')
    .select('*')
    .eq('trabalhador_id', workerId)
    .order('criado_em', { ascending: false });
  if (error || !data) {
    portfolioLoaded.delete(workerId);
    return;
  }
  const posts = data.map(mapPublicacaoRow);
  updateDb((db) => ({
    ...db,
    workerPosts: [...posts, ...db.workerPosts.filter((p) => p.workerId !== workerId)]
  }));
}

const reviewsLoaded = new Set<string>();

/** Loads a profile's received reviews and folds the rating/count into its cached record. */
export async function ensureReviewsLoaded(profileId: string | undefined | null): Promise<void> {
  if (!profileId || !isSupabaseConfigured() || reviewsLoaded.has(profileId)) return;
  reviewsLoaded.add(profileId);
  const supabase = await getSupabase();
  if (!supabase) {
    reviewsLoaded.delete(profileId);
    return;
  }
  const { data, error } = await supabase
    .from('avaliacoes')
    .select('nota, comentario, criado_em, avaliador:avaliador_id(nome)')
    .eq('avaliado_id', profileId)
    .order('criado_em', { ascending: false });
  if (error || !data) {
    reviewsLoaded.delete(profileId);
    return;
  }
  const summary = reviewSummaryFromRows(data as unknown as AvaliacaoRowWithAvaliador[]);
  updateDb((db) => ({
    ...db,
    companies: db.companies[profileId] ? { ...db.companies, [profileId]: { ...db.companies[profileId], ...summary } } : db.companies,
    workers: db.workers[profileId] ? { ...db.workers, [profileId]: { ...db.workers[profileId], ...summary } } : db.workers
  }));
}

/** The other side's WhatsApp for a specific application — only released from `pre_selecionado` on. */
export async function getWhatsappContato(candidaturaId: string): Promise<string | null> {
  const supabase = await getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('contato_whatsapp', { p_candidatura_id: candidaturaId });
  if (error) throw error;
  return data;
}

/** Uploads to the `avatars` bucket (profile photos, job photos) and returns the public URL. */
export async function uploadImage(file: File, filename: string): Promise<string> {
  const supabase = await getSupabase();
  const uid = state.session?.user?.id;
  if (!supabase || !uid) throw new Error('Sem sessão.');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${uid}/${filename}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl + '?v=' + Date.now();
}
