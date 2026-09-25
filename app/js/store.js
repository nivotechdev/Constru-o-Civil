import * as seed from './data/seed.js';
import { supabase } from './supabase.js';
import { formatJobDate } from './utils/format.js';

function clone(x) { return JSON.parse(JSON.stringify(x)); }

// Fábrica do "banco" local (mock + cache do real) — usada tanto no estado
// inicial quanto pra zerar tudo quando a sessão troca de usuário na mesma
// aba (resetSessionCaches), pra não deixar dado de uma conta vazando pra outra.
function freshDb() {
  return {
    jobs: clone(seed.JOBS),
    // Preenchidas ao carregar vagas reais (mapVagaRow), a partir de `autor_nome`
    // — só o suficiente pra não quebrar telas que chamam getCompany(job.companyId)
    // com um id real. Fase 4 troca isso por uma leitura de verdade de `profiles`.
    realCompanies: {},
    // Mesma ideia, para o candidato de uma candidatura real (a partir de
    // `nome_candidato`, denormalizado em `candidaturas`).
    realWorkers: {},
    jobsLoaded: false,
    jobsLoading: false,
    applications: clone(seed.APPLICATIONS),
    savedJobIds: [...seed.SAVED_JOB_IDS],
    deletedJobIds: [],
    workerPosts: clone(seed.WORKER_POSTS)
  };
}

const state = {
  session: null, // Supabase auth session, or null when signed out
  profile: null, // row from `profiles` for the signed-in user (nome, email, tipo, ...)
  myDocumento: null, // CPF/CNPJ descriptografado (meu_documento()), carregado sob demanda
  myReviewStats: {}, // { rating, reviewCount, jobsDone, reviews } — preenchido por ensureReviewsLoaded quando o perfil visitado é o da própria sessão
  authReady: false, // becomes true once the initial getSession()+profile load resolves
  db: freshDb(),
  ui: {}
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function notify() { listeners.forEach((fn) => fn()); }

// ---- auth/session ----
// `tipo` on `profiles` is the source of truth for which side of the marketplace
// an account is on (`pedreiro`/`construtora` — immutable once set by a DB trigger).
// Screens only ever see the app's own vocabulary (`trabalhador`/`recrutador`).
function roleFromTipo(tipo) {
  if (tipo === 'construtora') return 'recrutador';
  if (tipo === 'pedreiro') return 'trabalhador';
  return null; // signed in but profile not created yet, or tipo not chosen yet (e.g. first Google login)
}

// Mesma lista de colunas usada aqui e em updateProfile() — se um campo novo
// entrar em profiles e for editável, precisa entrar nos dois lugares, senão
// ele salva certinho mas some da tela no próximo carregamento de sessão
// (foi exatamente esse bug: loadProfile só buscava id/nome/email/tipo).
const PROFILE_COLUMNS = 'id, nome, email, tipo, cargo, regiao, especialidades, tipo_obra, regiao_atuacao, foto_url, capa_url, whatsapp, biografia';

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (!error && data) { state.profile = data; return; }
  // A troca de sessão pode chegar um instante antes do trigger que cria a
  // linha de profile terminar de gravar — uma única retentativa cobre essa
  // corrida (mesmo padrão usado no front antigo, controllers/principal.js).
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const retry = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
  state.profile = retry.error ? null : retry.data;
}

// A confirmação de e-mail está LIGADA neste projeto (diferente do que o
// comentário do front antigo registro.js dizia — verificado testando o
// cadastro de verdade): `auth.signUp()` não devolve sessão nenhuma até a
// pessoa clicar no link, então o insert em `consentimentos` feito dentro de
// signUp() (que precisa de auth.uid(), ou seja, de sessão) não roda ainda
// nesse momento. Isso garante, de forma idempotente, que o consentimento LGPD
// fica registrado assim que a sessão realmente existir — nem que seja só no
// primeiro login pós-confirmação.
async function ensureConsentimentos(userId) {
  const { data, error } = await supabase.from('consentimentos').select('id').eq('usuario_id', userId).limit(1);
  if (error || (data && data.length)) return;
  const hoje = new Date().toISOString().slice(0, 10);
  await supabase.from('consentimentos').insert([
    { usuario_id: userId, documento: 'termos_de_uso', versao: hoje },
    { usuario_id: userId, documento: 'politica_privacidade', versao: hoje }
  ]);
}

let lastUserId = undefined;

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  state.session = session;
  lastUserId = session?.user?.id || null;
  if (session) { await loadProfile(session.user.id); await ensureConsentimentos(session.user.id); }
  state.authReady = true;
  notify();

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const uid = session?.user?.id || null;
    // Troca de conta dentro da MESMA aba (logout seguido de login com outro
    // usuário, sem recarregar a página) — sem isso, os caches "carreguei uma
    // vez" abaixo (vagas salvas, candidaturas de uma vaga, etc.) continuam
    // achando que já têm os dados certos e nunca buscam de novo, vazando o
    // que a conta anterior via para a conta nova.
    if (uid !== lastUserId) resetSessionCaches();
    lastUserId = uid;
    state.session = session;
    if (session) { await loadProfile(session.user.id); await ensureConsentimentos(session.user.id); }
    else state.profile = null;
    notify();
  });
}

export function isAuthReady() { return state.authReady; }
export function getSession() { return state.session; }
export function isSignedIn() { return Boolean(state.session); }
export function getProfile() { return state.profile; }
export function getRole() { return roleFromTipo(state.profile?.tipo); }

export async function signUp({ email, senha, nome, tipoPerfil, documento, jaTentouLiberar = false }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome, tipo: tipoPerfil, documento } }
  });

  if (!error) {
    // Só há sessão (auth.uid()) aqui se a confirmação por e-mail estiver
    // desligada; caso contrário, ensureConsentimentos() cuida disso assim
    // que a sessão passar a existir de verdade (ver initAuth acima).
    if (data.session) await ensureConsentimentos(data.user.id);
    return data;
  }

  // Auto-recuperação de cadastro-fantasma (mesma lógica do front antigo,
  // controllers/registro.js): um e-mail ou documento "preso" numa tentativa
  // anterior nunca confirmada é liberado e a tentativa é refeita uma única vez
  // antes de admitir qualquer erro para quem está se cadastrando.
  if (!jaTentouLiberar) {
    if (error.code === 'user_already_exists') {
      try { await supabase.rpc('reiniciar_cadastro_pendente_email', { p_email: email }); } catch (_) { /* segue mesmo se falhar */ }
      return signUp({ email, senha, nome, tipoPerfil, documento, jaTentouLiberar: true });
    }
    if (error.code === 'unexpected_failure' || error.code === 'database_error_saving_new_user') {
      try { await supabase.rpc('reiniciar_cadastro_pendente_documento', { p_documento: documento }); } catch (_) { /* segue mesmo se falhar */ }
      return signUp({ email, senha, nome, tipoPerfil, documento, jaTentouLiberar: true });
    }
  }
  throw error;
}

export async function signIn({ email, senha }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function sendPasswordResetEmail(email) {
  // Sem fragmento de rota no redirectTo de propósito: o Supabase acrescenta os
  // tokens de recuperação como o PRÓPRIO fragmento (#access_token=...&type=recovery)
  // — se já houvesse um "#/algumaRota" aqui, viraria um `location.hash` com dois
  // "#" dentro dele, quebrando o roteador. `consumeRecoveryTokenFromUrl` (main.js)
  // trata esse fragmento antes do roteador rodar e só então navega para a tela.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  if (error) throw error;
}

export async function setRecoverySession({ access_token, refresh_token }) {
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export async function updatePassword(senha) {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) throw error;
}

export async function resendSignupEmail(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw error;
}

// LGPD (fase 6) — as duas RPCs já existiam desde o schema original do front
// antigo (baseline.sql), só precisavam de uma tela nova chamando-as de verdade.
export async function exportMyData() {
  const { data, error } = await supabase.rpc('exportar_meus_dados');
  if (error) throw error;
  return data;
}

export async function deleteMyAccount() {
  const { error } = await supabase.rpc('excluir_minha_conta');
  if (error) throw error;
  await supabase.auth.signOut();
}

export function getUI(key, defaults) {
  if (!(key in state.ui)) state.ui[key] = typeof defaults === 'function' ? defaults() : Object.assign({}, defaults);
  return state.ui[key];
}
export function setUI(key, patch) {
  const cur = state.ui[key] || {};
  state.ui[key] = Object.assign({}, cur, typeof patch === 'function' ? patch(cur) : patch);
  notify();
}
export function resetUI(key) { delete state.ui[key]; notify(); }

// ---- companies & workers (directory) ----
// `realCompanies`/`realWorkers` são preenchidas por três caminhos: o nome
// denormalizado de uma vaga (mapVagaRow) ou candidatura (cacheCandidaturaRow)
// real, e agora (fase 4) a leitura completa via a RPC perfil_publico
// (ensureProfileLoaded) quando alguém visita um perfil que ainda não estava
// em cache por nenhum desses dois caminhos.
const PLACEHOLDER_COMPANY = { name: 'Construtora', location: '', rating: 0, reviewCount: 0, verified: false, reviews: [] };
export function getCompany(id) {
  return seed.COMPANIES[id] || state.db.realCompanies[id] || Object.assign({ id }, PLACEHOLDER_COMPANY);
}
export function allCompanies() { return Object.values(seed.COMPANIES); }
// Sem seed.js misturado aqui de propósito: usar os dados de uma construtora
// de demonstração (Meridiano etc.) como "base" de uma conta real mostraria
// tipo de obra/região que não têm nada a ver com quem está logado.
export function currentCompany() {
  if (!state.profile) return seed.COMPANIES[seed.CURRENT_COMPANY_ID];
  return Object.assign({
    id: currentCompanyId(), name: state.profile.nome,
    tipoObra: state.profile.tipo_obra || '', location: state.profile.regiao_atuacao || '',
    whatsapp: state.profile.whatsapp || '', foto_url: state.profile.foto_url || null, capa_url: state.profile.capa_url || null,
    cnpj: state.myDocumento || '', rating: 0, reviewCount: 0, verified: false,
    verifiedSince: '', sinceLabel: '', respondTime: '', paidCount: 0, reviews: []
  }, state.myReviewStats);
}
export function currentCompanyId() { return state.session ? state.session.user.id : seed.CURRENT_COMPANY_ID; }

// getWorker() real (com fallback pra candidato de candidatura real) está
// definido mais abaixo, junto com o resto de applications.
export function allWorkers() { return Object.values(seed.WORKERS); }
export function currentWorker() {
  if (!state.profile) return seed.WORKERS[seed.CURRENT_WORKER_ID];
  return Object.assign({
    id: currentWorkerId(), name: state.profile.nome, initials: initials(state.profile.nome),
    role: state.profile.cargo || '', region: state.profile.regiao || '', distance: '',
    rating: 0, jobsDone: 0, verified: false, novo: false,
    specialties: state.profile.especialidades || [], facts: [], reviews: [],
    foto_url: state.profile.foto_url || null
  }, state.myReviewStats);
}
export function currentWorkerId() { return state.session ? state.session.user.id : seed.CURRENT_WORKER_ID; }

export async function ensureMyDocumentoLoaded() {
  if (state.myDocumento !== null || !state.session) return;
  const { data, error } = await supabase.rpc('meu_documento');
  if (!error) { state.myDocumento = data || ''; notify(); }
}

const profileLoaded = new Set();
export async function ensureProfileLoaded(id) {
  if (!id || seed.COMPANIES[id] || seed.WORKERS[id] || profileLoaded.has(id)) return;
  profileLoaded.add(id);
  const { data, error } = await supabase.rpc('perfil_publico', { p_id: id }).maybeSingle();
  if (error || !data) { profileLoaded.delete(id); notify(); return; }
  if (data.tipo === 'construtora') {
    state.db.realCompanies[id] = {
      id, name: data.nome, tipoObra: data.tipo_obra || '', location: data.regiao_atuacao || '',
      foto_url: data.foto_url, capa_url: data.capa_url, cnpj: data.documento || '',
      rating: 0, reviewCount: 0, verified: false, verifiedSince: '', sinceLabel: '', respondTime: '', paidCount: 0, reviews: []
    };
  } else {
    state.db.realWorkers[id] = {
      id, name: data.nome, initials: initials(data.nome), role: data.cargo || '', region: data.regiao || '',
      distance: '', rating: 0, jobsDone: 0, verified: false, novo: false,
      specialties: data.especialidades || [], facts: [], reviews: [], foto_url: data.foto_url
    };
  }
  notify();
}

export async function updateProfile(patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', state.session.user.id).select(PROFILE_COLUMNS).single();
  if (error) throw error;
  state.profile = Object.assign({}, state.profile, data);
  notify();
}

export async function uploadImage(file, filename) {
  const uid = state.session.user.id;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${uid}/${filename}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl + '?v=' + Date.now();
}

// ---- jobs ----
// `state.db.jobs` mistura as vagas de demonstração (seed.js) com as vagas
// reais carregadas de `vagas` (Supabase) — os ids não colidem (mock usa
// "BC-xxxx", banco usa uuid). As vagas de demonstração somem de vez só no
// corte final (fase 7), quando as telas que ainda dependem delas (aplicações,
// perfis — fases 3/4) também estiverem ligadas ao banco real.
function mapVagaRow(row) {
  return {
    id: row.id,
    companyId: row.autor_id,
    autorNome: row.autor_nome,
    role: row.titulo,
    pay: row.valor == null ? null : Number(row.valor),
    location: row.cidade,
    address: row.endereco,
    distance: '0 km', // sem geolocalização real ainda (schema: `localizacao` fica null por enquanto)
    date: formatJobDate(row.data_servico),
    dateLong: formatJobDate(row.data_servico) + (row.horario ? ' · ' + row.horario : ''),
    hours: row.horario,
    duration: row.duracao,
    urgent: Boolean(row.urgente),
    boosted: Boolean(row.impulsionada),
    slots: row.slots || 1,
    description: row.descricao,
    requirements: row.requisitos || [],
    closed: row.status !== 'aberta',
    semContratacao: Boolean(row.sem_contratacao),
    photo: row.foto_url || null
  };
}

function cacheVagaRow(row) {
  const job = mapVagaRow(row);
  state.db.jobs[job.id] = job;
  if (job.autorNome && !seed.COMPANIES[job.companyId]) {
    state.db.realCompanies[job.companyId] = Object.assign({ id: job.companyId, name: job.autorNome, location: job.location }, PLACEHOLDER_COMPANY, { name: job.autorNome, location: job.location });
  }
  return job;
}

export async function ensureJobsLoaded() {
  if (state.db.jobsLoaded || state.db.jobsLoading) return;
  state.db.jobsLoading = true;
  const { data, error } = await supabase.from('vagas').select('*').order('criado_em', { ascending: false });
  state.db.jobsLoading = false;
  if (error) { notify(); return; }
  data.forEach(cacheVagaRow);
  state.db.jobsLoaded = true;
  notify();
}

export async function createJob(job) {
  const { data, error } = await supabase.from('vagas').insert({
    autor_id: job.companyId,
    autor_nome: state.profile?.nome || null,
    titulo: job.role,
    valor: job.pay,
    cidade: job.location,
    endereco: job.address,
    data_servico: job.date,
    horario: job.hours,
    duracao: job.duration,
    slots: job.slots,
    requisitos: job.requirements,
    descricao: job.description,
    foto_url: job.photo,
    urgente: job.urgent
  }).select().single();
  if (error) throw error;
  const mapped = cacheVagaRow(data);
  notify();
  return mapped.id;
}

export function allJobs() { return Object.values(state.db.jobs); }
export function getJob(id) { return state.db.jobs[id]; }
export function activeJobs() { return allJobs().filter((j) => state.db.deletedJobIds.indexOf(j.id) < 0); }
export function isMine(job) { return job.companyId === currentCompanyId(); }
export function successfulJobsForCompany(companyId) {
  return allJobs().filter((j) => j.companyId === companyId && j.closed && !j.semContratacao).length;
}

// TODO(fase 3/5): updateJob/closeJob/deleteJobPost ainda só mexem no cache
// local (state.db.jobs) — não persistem no Supabase. Não quebra nada porque
// nenhuma tela da fase 2 chama essas três; passam a gravar de verdade quando
// as telas que as usam (JobManage, CompanyProfileScreen, BoostJob) forem ligadas.
export function deleteJobPost(jobId) { state.db.deletedJobIds.push(jobId); notify(); }
export async function updateJob(jobId, patch) {
  const dbPatch = {};
  if ('photo' in patch) dbPatch.foto_url = patch.photo;
  if ('boosted' in patch) dbPatch.impulsionada = patch.boosted;
  if ('urgent' in patch) dbPatch.urgente = patch.urgent;
  const { data, error } = await supabase.from('vagas').update(dbPatch).eq('id', jobId).select().single();
  if (error) throw error;
  cacheVagaRow(data);
  notify();
}

// closeJob() real (chama a RPC fechar_vaga) está definido mais abaixo, junto
// com o resto de applications.

// ---- applications ----
// Mesmo esquema de cache das vagas: state.db.applications mistura candidaturas
// de demonstração (seed.js) com candidaturas reais (candidaturas, Supabase),
// carregadas sob demanda por ensureMyApplicationsLoaded/ensureApplicationsForJobLoaded.
function initials(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
}

const PLACEHOLDER_WORKER = { name: 'Trabalhador', initials: '?', role: '', region: '', distance: '', rating: 0, jobsDone: 0, verified: false, novo: false, specialties: [], facts: [], reviews: [] };

function cacheCandidaturaRow(row) {
  const app = { id: row.id, jobId: row.vaga_id, workerId: row.candidato_id, status: row.status };
  const i = state.db.applications.findIndex((a) => a.id === app.id);
  if (i >= 0) state.db.applications[i] = app; else state.db.applications.push(app);
  if (row.nome_candidato && !seed.WORKERS[app.workerId]) {
    state.db.realWorkers[app.workerId] = Object.assign({ id: app.workerId }, PLACEHOLDER_WORKER, { name: row.nome_candidato, initials: initials(row.nome_candidato) });
  }
  return app;
}

const jobApplicationsLoaded = new Set();
export async function ensureApplicationsForJobLoaded(jobId, { force = false } = {}) {
  if (!force && jobApplicationsLoaded.has(jobId)) return;
  jobApplicationsLoaded.add(jobId);
  const { data, error } = await supabase.from('candidaturas').select('*').eq('vaga_id', jobId);
  if (error) { jobApplicationsLoaded.delete(jobId); notify(); return; }
  data.forEach(cacheCandidaturaRow);
  notify();
}

const myApplicationsLoadedFor = new Set();
export async function ensureMyApplicationsLoaded() {
  const uid = state.session?.user?.id;
  if (!uid || myApplicationsLoadedFor.has(uid)) return;
  myApplicationsLoadedFor.add(uid);
  const { data, error } = await supabase.from('candidaturas').select('*').eq('candidato_id', uid);
  if (error) { myApplicationsLoadedFor.delete(uid); notify(); return; }
  data.forEach(cacheCandidaturaRow);
  notify();
}

export function getWorker(id) { return seed.WORKERS[id] || state.db.realWorkers[id] || Object.assign({ id }, PLACEHOLDER_WORKER); }

export function applicationsForJob(jobId) { return state.db.applications.filter((a) => a.jobId === jobId); }
export function applicationsForWorker(workerId) { return state.db.applications.filter((a) => a.workerId === workerId); }
export function applicationFor(jobId, workerId) { return state.db.applications.find((a) => a.jobId === jobId && a.workerId === workerId) || null; }

export function approvedCount(jobId) {
  return state.db.applications.filter((a) => a.jobId === jobId && (a.status === 'pre_selecionado' || a.status === 'contratado')).length;
}
export function pendingCount(jobId) {
  return state.db.applications.filter((a) => a.jobId === jobId && (a.status === 'enviada' || a.status === 'em_analise')).length;
}
export function isJobFull(job) { return approvedCount(job.id) >= (job.slots || 1); }
export function isJobClosed(job) { return Boolean(job.closed) || isJobFull(job); }

export async function applyToJob(jobId, workerId) {
  const { data, error } = await supabase.from('candidaturas').insert({
    vaga_id: jobId, candidato_id: workerId,
    nome_candidato: state.profile?.nome || '', email_candidato: state.profile?.email || ''
  }).select().single();
  if (error) {
    if (error.code === '23505') { await ensureMyApplicationsLoaded(); return; } // já existia — idempotente
    throw error;
  }
  cacheCandidaturaRow(data);
  notify();
}

export async function cancelApplication(jobId, workerId) {
  const app = applicationFor(jobId, workerId);
  if (!app) return;
  const { error } = await supabase.from('candidaturas').delete().eq('id', app.id);
  if (error) throw error;
  const i = state.db.applications.findIndex((a) => a.id === app.id);
  if (i >= 0) state.db.applications.splice(i, 1);
  notify();
}

export async function decideApplication(jobId, workerId, decision) {
  const app = applicationFor(jobId, workerId);
  if (!app) return;
  const { error } = await supabase.rpc('decidir_candidatura', { p_candidatura_id: app.id, p_decisao: decision });
  if (error) throw error;
  await ensureApplicationsForJobLoaded(jobId, { force: true });
}

export async function markConcluded(jobId, workerId) {
  const app = applicationFor(jobId, workerId);
  if (!app) return;
  const { error } = await supabase.rpc('concluir_candidatura', { p_candidatura_id: app.id });
  if (error) throw error;
  app.status = 'concluida';
  notify();
}

export async function postReview(jobId, workerId, { nota, comentario }) {
  const app = applicationFor(jobId, workerId);
  if (!app) return;
  const { error } = await supabase.rpc('postar_avaliacao', { p_candidatura_id: app.id, p_nota: nota, p_comentario: comentario || null });
  if (error) throw error;
  app.status = 'avaliada';
  notify();
}

// Avaliações de um perfil (trabalhador ou construtora) — leitura pública
// (RLS: qualquer autenticado/verificado), carregada sob demanda por perfil.
const reviewsLoaded = new Set();
export async function ensureReviewsLoaded(profileId) {
  if (!profileId || reviewsLoaded.has(profileId)) return;
  reviewsLoaded.add(profileId);
  const { data, error } = await supabase
    .from('avaliacoes')
    .select('nota, comentario, criado_em, avaliador:avaliador_id(nome)')
    .eq('avaliado_id', profileId)
    .order('criado_em', { ascending: false });
  if (error) { reviewsLoaded.delete(profileId); notify(); return; }
  const reviews = data.map((r) => ({ author: r.avaliador?.nome || 'Bicos', company: r.avaliador?.nome || 'Bicos', value: r.nota, text: r.comentario || '', date: r.criado_em.slice(0, 10) }));
  const media = reviews.length ? reviews.reduce((s, r) => s + r.value, 0) / reviews.length : 0;
  const patch = { reviews, rating: Math.round(media * 10) / 10, reviewCount: reviews.length, jobsDone: reviews.length };
  if (state.db.realWorkers[profileId]) Object.assign(state.db.realWorkers[profileId], patch);
  if (state.db.realCompanies[profileId]) Object.assign(state.db.realCompanies[profileId], patch);
  if (profileId === state.session?.user?.id) state.myReviewStats = patch;
  notify();
}

// Único caminho que devolve o WhatsApp do outro lado de uma candidatura —
// a RPC no banco só libera a partir de pré-selecionado (ver migração 005).
export async function getWhatsappContato(candidaturaId) {
  const { data, error } = await supabase.rpc('contato_whatsapp', { p_candidatura_id: candidaturaId });
  if (error) throw error;
  return data;
}

export async function closeJob(jobId) {
  const { error } = await supabase.rpc('fechar_vaga', { p_vaga_id: jobId });
  if (error) throw error;
  const { data } = await supabase.from('vagas').select('*').eq('id', jobId).single();
  if (data) cacheVagaRow(data);
  await ensureApplicationsForJobLoaded(jobId, { force: true });
  notify();
}

// ---- saved jobs ----
let savedJobsLoaded = false;
export async function ensureSavedJobsLoaded() {
  if (savedJobsLoaded || !state.session) return;
  savedJobsLoaded = true;
  const { data, error } = await supabase.from('vagas_salvas').select('vaga_id').eq('trabalhador_id', state.session.user.id);
  if (error) { savedJobsLoaded = false; notify(); return; }
  state.db.savedJobIds = data.map((r) => r.vaga_id);
  notify();
}
export function isJobSaved(jobId) { return state.db.savedJobIds.indexOf(jobId) >= 0; }
export async function toggleSavedJob(jobId) {
  const uid = state.session.user.id;
  const i = state.db.savedJobIds.indexOf(jobId);
  if (i >= 0) {
    state.db.savedJobIds.splice(i, 1);
    notify();
    const { error } = await supabase.from('vagas_salvas').delete().eq('trabalhador_id', uid).eq('vaga_id', jobId);
    if (error) { state.db.savedJobIds.push(jobId); notify(); throw error; }
  } else {
    state.db.savedJobIds.push(jobId);
    notify();
    const { error } = await supabase.from('vagas_salvas').insert({ trabalhador_id: uid, vaga_id: jobId });
    if (error && error.code !== '23505') { state.db.savedJobIds = state.db.savedJobIds.filter((id) => id !== jobId); notify(); throw error; }
  }
}
export function savedJobs() { return state.db.savedJobIds.map((id) => getJob(id)).filter(Boolean); }

// ---- worker portfolio posts (photo/video, Instagram-style, no likes/comments) ----
const portfolioLoaded = new Set();
export async function ensurePortfolioLoaded(workerId) {
  if (!workerId || portfolioLoaded.has(workerId)) return;
  portfolioLoaded.add(workerId);
  const { data, error } = await supabase.from('publicacoes_trabalhador').select('*').eq('trabalhador_id', workerId).order('criado_em', { ascending: false });
  if (error) { portfolioLoaded.delete(workerId); notify(); return; }
  state.db.workerPosts = state.db.workerPosts.filter((p) => p.workerId !== workerId || String(p.id).startsWith('wp'));
  data.forEach((row) => {
    state.db.workerPosts.unshift({ id: row.id, workerId: row.trabalhador_id, mediaUrl: row.midia_url, mediaType: row.midia_tipo === 'video' ? 'video' : 'image', caption: row.legenda, date: row.criado_em.slice(0, 10) });
  });
  notify();
}
export function postsForWorker(workerId) {
  return state.db.workerPosts.filter((p) => p.workerId === workerId).sort((a, b) => (a.date < b.date ? 1 : -1));
}
export async function addWorkerPost(workerId, { file, mediaType, caption }) {
  const ext = (file.name.split('.').pop() || (mediaType === 'video' ? 'mp4' : 'jpg')).toLowerCase();
  const path = `${workerId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('portfolio').upload(path, file, { upsert: false, cacheControl: '3600' });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from('portfolio').getPublicUrl(path);
  const { data, error } = await supabase.from('publicacoes_trabalhador')
    .insert({ trabalhador_id: workerId, midia_url: pub.publicUrl, midia_tipo: mediaType === 'video' ? 'video' : 'imagem', legenda: caption || null })
    .select().single();
  if (error) throw error;
  state.db.workerPosts.unshift({ id: data.id, workerId, mediaUrl: data.midia_url, mediaType, caption: data.legenda, date: data.criado_em.slice(0, 10) });
  notify();
}
export async function deleteWorkerPost(postId) {
  const i = state.db.workerPosts.findIndex((p) => p.id === postId);
  if (i < 0) return;
  const removed = state.db.workerPosts[i];
  state.db.workerPosts.splice(i, 1);
  notify();
  const { error } = await supabase.from('publicacoes_trabalhador').delete().eq('id', postId);
  if (error) { state.db.workerPosts.splice(i, 0, removed); notify(); throw error; }
}

// Limpa todos os caches "carreguei uma vez" quando a sessão troca de usuário
// dentro da mesma aba (logout seguido de login com outra conta, sem recarregar
// a página) — sem isso, cada `ensureXLoaded` acima acha que já tem os dados
// certos e nunca busca de novo, vazando o que a conta anterior via para a
// conta nova (foi um bug real, pego testando troca de conta na Fase 5).
function resetSessionCaches() {
  profileLoaded.clear();
  jobApplicationsLoaded.clear();
  reviewsLoaded.clear();
  portfolioLoaded.clear();
  savedJobsLoaded = false;
  state.db = freshDb();
  state.myDocumento = null;
  state.myReviewStats = {};
}
