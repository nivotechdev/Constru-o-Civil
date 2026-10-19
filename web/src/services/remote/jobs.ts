// Jobs with the real backend: publishing, editing and closing go through RPCs that apply the same rules
// as the demo (and notify the candidates in the same transaction); then the job is read again.
import type { Job } from '../../types/models';
import type { Json } from '../../types/supabase';
import type { JobDraft } from '../jobs';
import { serviceError } from '../errors';
import { jobToRow } from '../supabaseMappers';
import * as store from '../store';
import { isJobSaved } from '../selectors';
import { db, request, toServiceError } from './client';
import { loadJob } from './data';
import { uploadAll } from './storage';

/** What the RPCs publish_job/update_job read: the job's row without the server-owned columns. */
export function draftRow(draft: JobDraft): Json {
  const row: Record<string, unknown> = { ...jobToRow({ ...draft, id: '', companyId: '' } as Job) };
  for (const key of ['id', 'company_id', 'deleted_at', 'boost_ends_at', 'closed', 'sem_contratacao']) delete row[key];
  return row as Json;
}

async function withUploadedPhotos(draft: JobDraft): Promise<JobDraft> {
  return draft.photos?.length ? { ...draft, photos: await uploadAll(draft.photos, 'vagas') } : draft;
}

export async function publishJob(draft: JobDraft): Promise<string> {
  const client = await db();
  const ready = await withUploadedPhotos(draft);
  const id = await request(() => client.rpc('publish_job', { p: draftRow(ready) }));
  await loadJob(id);
  return id;
}

export async function updateJob(jobId: string, draft: JobDraft): Promise<void> {
  const client = await db();
  const ready = await withUploadedPhotos(draft);
  await request(() => client.rpc('update_job', { p_job_id: jobId, p: draftRow(ready) }));
  await loadJob(jobId);
}

export async function updateJobPhotos(jobId: string, photos: string[]): Promise<void> {
  const client = await db();
  const uploaded = await uploadAll(photos, 'vagas');
  await request(() => client.rpc('set_job_photos', { p_job_id: jobId, p_photos: uploaded }));
  store.updateJob(jobId, { photos: uploaded });
}

export async function deleteJob(jobId: string): Promise<void> {
  const client = await db();
  await request(() => client.rpc('delete_job', { p_job_id: jobId }));
  if (!store.getDb().deletedJobIds.includes(jobId)) store.deleteJobPost(jobId);
  await loadJob(jobId).catch(() => undefined);
}

/** Optimistic, like the demo: the flag flips at once and goes back if the request fails. */
export async function toggleSavedJob(jobId: string): Promise<boolean> {
  const workerId = store.getSession()?.workerId;
  if (!workerId) throw serviceError('nao_autorizado', 'Só a conta de trabalhador salva vagas.');
  const wasSaved = isJobSaved(store.getDb(), jobId);
  store.toggleSavedJob(jobId);
  try {
    const client = await db();
    if (wasSaved) await request(() => client.from('saved_jobs').delete().eq('worker_id', workerId).eq('job_id', jobId));
    else {
      // Plain insert: the table has no UPDATE privilege, so an upsert is refused. Already saved (saved
      // on another device, or a double tap) is what the person asked for: not an error.
      const { error } = await client.from('saved_jobs').insert({ worker_id: workerId, job_id: jobId });
      if (error && (error as { code?: string }).code !== '23505') throw error;
    }
  } catch (e) {
    if (isJobSaved(store.getDb(), jobId) !== wasSaved) store.toggleSavedJob(jobId);
    throw toServiceError(e);
  }
  return !wasSaved;
}
