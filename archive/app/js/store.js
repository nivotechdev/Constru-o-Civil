import * as seed from './data/seed.js';

function clone(x) { return JSON.parse(JSON.stringify(x)); }

const state = {
  role: 'trabalhador', // demo account switch — which side of the marketplace is "logged in"
  db: {
    jobs: clone(seed.JOBS),
    applications: clone(seed.APPLICATIONS),
    savedJobIds: [...seed.SAVED_JOB_IDS],
    deletedJobIds: [],
    workerPosts: clone(seed.WORKER_POSTS)
  },
  ui: {}
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function notify() { listeners.forEach((fn) => fn()); }

export function getRole() { return state.role; }
export function setRole(role) { state.role = role; notify(); }

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

// ---- companies & workers (static directory) ----
export function getCompany(id) { return seed.COMPANIES[id]; }
export function allCompanies() { return Object.values(seed.COMPANIES); }
export function currentCompany() { return seed.COMPANIES[seed.CURRENT_COMPANY_ID]; }
export function currentCompanyId() { return seed.CURRENT_COMPANY_ID; }

export function getWorker(id) { return seed.WORKERS[id]; }
export function allWorkers() { return Object.values(seed.WORKERS); }
export function currentWorker() { return seed.WORKERS[seed.CURRENT_WORKER_ID]; }
export function currentWorkerId() { return seed.CURRENT_WORKER_ID; }

// ---- jobs ----
export function allJobs() { return Object.values(state.db.jobs); }
export function getJob(id) { return state.db.jobs[id]; }
export function activeJobs() { return allJobs().filter((j) => state.db.deletedJobIds.indexOf(j.id) < 0); }
export function isMine(job) { return job.companyId === seed.CURRENT_COMPANY_ID; }
export function successfulJobsForCompany(companyId) {
  return allJobs().filter((j) => j.companyId === companyId && j.closed && !j.semContratacao).length;
}

export function createJob(job) { state.db.jobs[job.id] = job; notify(); return job.id; }
export function deleteJobPost(jobId) { state.db.deletedJobIds.push(jobId); notify(); }
export function updateJob(jobId, patch) {
  const job = state.db.jobs[jobId];
  if (job) { Object.assign(job, patch); notify(); }
}

export function closeJob(jobId) {
  const job = getJob(jobId);
  if (!job) return;
  const hired = approvedCount(jobId) > 0;
  job.closed = true;
  if (!hired) job.semContratacao = true;
  applicationsForJob(jobId).forEach((a) => { if (a.status === 'enviada' || a.status === 'em_analise') a.status = 'nao_selecionado'; });
  notify();
}

// ---- applications ----
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

export function applyToJob(jobId, workerId) {
  if (!applicationFor(jobId, workerId)) {
    state.db.applications.push({ id: 'a' + Date.now(), jobId, workerId, status: 'enviada' });
  }
  notify();
}

export function cancelApplication(jobId, workerId) {
  const i = state.db.applications.findIndex((a) => a.jobId === jobId && a.workerId === workerId);
  if (i >= 0) { state.db.applications.splice(i, 1); notify(); }
}

export function decideApplication(jobId, workerId, decision) {
  const app = applicationFor(jobId, workerId);
  if (!app) return;
  app.status = decision === 'aprovado' ? 'pre_selecionado' : decision === 'recusado' ? 'nao_selecionado' : 'em_analise';
  const job = getJob(jobId);
  if (decision === 'aprovado' && job && approvedCount(jobId) >= (job.slots || 1)) {
    applicationsForJob(jobId).forEach((a) => {
      if (a.status === 'enviada' || a.status === 'em_analise') a.status = 'nao_selecionado';
    });
  }
  notify();
}

export function markConcluded(jobId, workerId) {
  const app = applicationFor(jobId, workerId);
  if (app && app.status === 'contratado') { app.status = 'concluida'; notify(); }
}
export function markReviewed(jobId, workerId) {
  const app = applicationFor(jobId, workerId);
  if (app) { app.status = 'avaliada'; notify(); }
}

// ---- saved jobs ----
export function isJobSaved(jobId) { return state.db.savedJobIds.indexOf(jobId) >= 0; }
export function toggleSavedJob(jobId) {
  const i = state.db.savedJobIds.indexOf(jobId);
  if (i >= 0) state.db.savedJobIds.splice(i, 1); else state.db.savedJobIds.push(jobId);
  notify();
}
export function savedJobs() { return state.db.savedJobIds.map((id) => getJob(id)).filter(Boolean); }

// ---- worker portfolio posts (photo/video, Instagram-style, no likes/comments) ----
export function postsForWorker(workerId) {
  return state.db.workerPosts.filter((p) => p.workerId === workerId).sort((a, b) => (a.date < b.date ? 1 : -1));
}
export function addWorkerPost(workerId, { mediaUrl, mediaType, caption }) {
  state.db.workerPosts.unshift({ id: 'wp' + Date.now(), workerId, mediaUrl, mediaType, caption, date: new Date().toISOString().slice(0, 10) });
  notify();
}
export function deleteWorkerPost(postId) {
  const i = state.db.workerPosts.findIndex((p) => p.id === postId);
  if (i >= 0) { state.db.workerPosts.splice(i, 1); notify(); }
}
