// Reads with the real backend: each one fetches the slice a screen shows and merges it into the store
// (services/remote/merge.ts). The screens call them through the same functions as in demo mode
// (jobs.loadFeed, applications.loadMyApplications…), via the read cache in services/queries.ts.
import type { Application } from '../../types/models';
import type { TableRow } from '../../types/supabase';
import type { JobRowRead } from '../supabaseMappers';
import { getSession } from '../store';
import { todayISO } from '../../utils/dates';
import { db, request } from './client';
import {
  apply,
  COMPANY_COLUMNS,
  dropJob,
  putApplications,
  putCompanies,
  JOB_COLUMNS,
  putJobAddresses,
  putJobs,
  putNotifications,
  putPayments,
  putPosts,
  putSavedJobIds,
  putStats,
  putWorkers,
  WORKER_COLUMNS,
  type Recipe
} from './merge';

type JobRow = JobRowRead;
type AppRow = TableRow<'applications'>;
type EventRow = TableRow<'application_events'>;

const unique = <T>(items: T[]): T[] => [...new Set(items)];
const accountId = () => getSession()?.accountId ?? null;

/** The session's worker / company id, or a "sign in again" error. */
function me(): { workerId: string | null; companyId: string | null } {
  const s = getSession();
  return { workerId: s?.workerId ?? null, companyId: s?.companyId ?? null };
}

// ---- building blocks ----

async function companiesById(ids: string[]) {
  if (!ids.length) return [];
  const client = await db();
  return request(() => client.from('companies').select(COMPANY_COLUMNS).in('id', ids));
}

async function workersById(ids: string[]) {
  if (!ids.length) return [];
  const client = await db();
  return request(() => client.from('workers').select(WORKER_COLUMNS).in('id', ids));
}

async function jobsById(ids: string[]): Promise<JobRow[]> {
  if (!ids.length) return [];
  const client = await db();
  return request(() => client.from('jobs').select(JOB_COLUMNS).in('id', ids));
}

async function statsFor(jobIds: string[]) {
  if (!jobIds.length) return [];
  const client = await db();
  return (await request(() => client.rpc('job_stats', { p_job_ids: jobIds }))) ?? [];
}

async function eventsOf(apps: AppRow[]): Promise<EventRow[]> {
  if (!apps.length) return [];
  const client = await db();
  return request(() =>
    client
      .from('application_events')
      .select('*')
      .in(
        'application_id',
        apps.map((a) => a.id)
      )
      .order('at')
  );
}

/** The exact addresses of these jobs that the session may see (the server filters: Z06). */
async function addressesOf(jobIds: string[]) {
  if (!jobIds.length) return [];
  const client = await db();
  return (await request(() => client.rpc('get_job_addresses', { p_job_ids: jobIds }))) ?? [];
}

const HOLDS_SLOT = new Set(['pre_selecionado', 'contratado']);

/**
 * Jobs with what the screens read next to them: their companies, how many candidates each has, and the
 * exact address of the company's own jobs and of `exactFor` (the jobs the worker was picked or hired for).
 */
async function jobsWithContext(jobs: JobRow[], exactFor: string[] = []): Promise<Recipe[]> {
  const ids = jobs.map((j) => j.id);
  const companyId = me().companyId;
  const exact = unique([...jobs.filter((j) => j.company_id === companyId).map((j) => j.id), ...exactFor]);
  const [companies, stats, addresses] = await Promise.all([
    companiesById(unique(jobs.map((j) => j.company_id))),
    statsFor(ids),
    addressesOf(exact.filter((id) => ids.includes(id)))
  ]);
  return [
    putCompanies(companies, undefined, accountId()),
    putJobs(jobs),
    putJobAddresses(addresses),
    putStats(ids, stats)
  ];
}

/** Candidacies (+ history, + the workers, + the jobs) as recipes; `scope` as in putApplications. */
async function applicationsWithContext(apps: AppRow[], scope: (a: Application) => boolean): Promise<Recipe[]> {
  const [events, workers, jobs] = await Promise.all([
    eventsOf(apps),
    workersById(unique(apps.map((a) => a.worker_id))),
    jobsById(unique(apps.map((a) => a.job_id)))
  ]);
  const holding = apps.filter((a) => a.worker_id === me().workerId && HOLDS_SLOT.has(a.status)).map((a) => a.job_id);
  return [
    putWorkers(workers, undefined, accountId()),
    ...(await jobsWithContext(jobs, holding)),
    putApplications(apps, events, scope)
  ];
}

async function savedIds(): Promise<string[]> {
  const { workerId } = me();
  if (!workerId) return [];
  const client = await db();
  const rows = await request(() =>
    client.from('saved_jobs').select('job_id').eq('worker_id', workerId).order('saved_at')
  );
  return rows.map((r) => r.job_id);
}

/** Diárias whose last day has passed become "concluída" (the hourly routine also does it). */
async function concludeMine(): Promise<void> {
  const client = await db();
  await request(() => client.rpc('conclude_my_finished_jobs'));
}

// ---- jobs ----

/** The mural: open jobs (not closed, not deleted, not past), newest first. */
export async function loadFeed(): Promise<void> {
  const client = await db();
  const jobs = await request(() =>
    client
      .from('jobs')
      .select(JOB_COLUMNS)
      .is('deleted_at', null)
      .eq('closed', false)
      .or(`date_to_arrange.eq.true,end_date.gte.${todayISO()}`)
      .order('created_at', { ascending: false })
      .limit(300)
  );
  const [context, saved] = await Promise.all([jobsWithContext(jobs), savedIds()]);
  apply(...context, ...(me().workerId ? [putSavedJobIds(saved)] : []));
}

/** One job, its company, and the session's side of it (my candidacy, or the candidates if it's mine). */
export async function loadJob(jobId: string): Promise<void> {
  const client = await db();
  const job = await request(() => client.from('jobs').select(JOB_COLUMNS).eq('id', jobId).maybeSingle());
  if (!job) {
    apply(dropJob(jobId));
    return;
  }
  const { workerId, companyId } = me();
  if (workerId) {
    const [apps, saved] = await Promise.all([
      request(() => client.from('applications').select('*').eq('job_id', jobId).eq('worker_id', workerId)),
      savedIds()
    ]);
    const recipes = await jobsWithContext([job], apps.some((a) => HOLDS_SLOT.has(a.status)) ? [jobId] : []);
    recipes.push(
      putApplications(apps, await eventsOf(apps), (a) => a.jobId === jobId && a.workerId === workerId),
      putSavedJobIds(saved)
    );
    apply(...recipes);
    return;
  }
  const recipes = await jobsWithContext([job]);
  if (companyId && job.company_id === companyId) {
    const apps = await request(() => client.from('applications').select('*').eq('job_id', jobId));
    recipes.push(...(await applicationsWithContext(apps, (a) => a.jobId === jobId)));
    const payments = await request(() =>
      client.from('boost_payments').select('*').eq('job_id', jobId).order('created_at', { ascending: false })
    );
    recipes.push(putPayments(payments));
  }
  apply(...recipes);
}

/** The worker's saved jobs, in the order they were saved. */
export async function loadSavedJobs(): Promise<void> {
  const ids = await savedIds();
  const jobs = await jobsById(ids);
  apply(...(await jobsWithContext(jobs)), putSavedJobIds(ids.filter((id) => jobs.some((j) => j.id === id))));
}

// ---- candidacies ----

/** The worker's candidacies, with their jobs and companies. */
export async function loadMyApplications(): Promise<void> {
  const { workerId } = me();
  if (!workerId) return;
  await concludeMine();
  const client = await db();
  const apps = await request(() => client.from('applications').select('*').eq('worker_id', workerId));
  apply(...(await applicationsWithContext(apps, (a) => a.workerId === workerId)));
}

/** A job's candidates (+ their profiles), for its company. */
export async function loadJobCandidates(jobId: string): Promise<void> {
  await concludeMine();
  await loadJob(jobId);
}

/** All the company's jobs (open and closed) with their candidates: history, reviews, deletion impact. */
export async function loadHistory(): Promise<void> {
  const { companyId } = me();
  if (!companyId) return;
  await concludeMine();
  const client = await db();
  const jobs = await request(() =>
    client
      .from('jobs')
      .select(JOB_COLUMNS)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(300)
  );
  const ids = jobs.map((j) => j.id);
  const apps = ids.length ? await request(() => client.from('applications').select('*').in('job_id', ids)) : [];
  const idSet = new Set(ids);
  apply(...(await jobsWithContext(jobs)), ...(await applicationsWithContext(apps, (a) => idSet.has(a.jobId))));
}

// ---- profiles ----

/** A worker's profile with reviews and portfolio; for a company, also its candidacies on her jobs. */
export async function loadWorkerProfile(workerId: string): Promise<void> {
  const client = await db();
  const [workers, reviews, posts] = await Promise.all([
    workersById([workerId]),
    request(() =>
      client
        .from('reviews')
        .select('*')
        .eq('worker_id', workerId)
        .eq('direction', 'para_trabalhador')
        .order('created_at', { ascending: false })
    ),
    request(() =>
      client.from('worker_posts').select('*').eq('worker_id', workerId).order('created_at', { ascending: false })
    )
  ]);
  const recipes: Recipe[] = [putWorkers(workers, reviews, accountId()), putPosts(workerId, posts)];
  if (me().companyId) {
    // RLS only returns the candidacies on the company's own jobs.
    const apps = await request(() => client.from('applications').select('*').eq('worker_id', workerId));
    const jobIds = new Set(apps.map((a) => a.job_id));
    recipes.push(...(await applicationsWithContext(apps, (a) => a.workerId === workerId && jobIds.has(a.jobId))));
  }
  apply(...recipes);
}

/** A company's profile with reviews and open jobs; the session's own company also gets its history. */
export async function loadCompanyProfile(companyId: string): Promise<void> {
  if (me().companyId === companyId) await loadHistory();
  const client = await db();
  const [companies, reviews, jobs] = await Promise.all([
    companiesById([companyId]),
    request(() =>
      client
        .from('reviews')
        .select('*')
        .eq('company_id', companyId)
        .eq('direction', 'para_construtora')
        .order('created_at', { ascending: false })
    ),
    request(() =>
      client
        .from('jobs')
        .select(JOB_COLUMNS)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100)
    )
  ]);
  apply(...(await jobsWithContext(jobs)), putCompanies(companies, reviews, accountId()));
}

// ---- notifications ----

export async function loadNotifications(): Promise<void> {
  const client = await db();
  const rows = await request(() =>
    client.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)
  );
  apply(putNotifications(rows));
}

// ---- account ----

/** What the account has going on, before deleting it. */
export async function loadDeletionImpact(): Promise<void> {
  if (me().workerId) await loadMyApplications();
  else await loadHistory();
}
