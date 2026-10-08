// Worker and company profiles: reading them and the logged-in account editing its own. Each function
// says what the real backend does there (docs/CONTRATO-BACKEND.md).
import type { Company, Worker, WorkerPost } from '../types/models';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { currentCompanyId, currentWorkerId } from './selectors';
import * as store from './store';

/** A worker's public profile (+ reviews, posts). Backend: select the worker by id. */
export async function loadWorkerProfile(_workerId: string): Promise<void> {
  await mockLatency(350);
}

/** A company's public profile (+ reviews, open jobs). Backend: select the company by id. */
export async function loadCompanyProfile(_companyId: string): Promise<void> {
  await mockLatency(350);
}

export type WorkerProfilePatch = Partial<Pick<Worker, 'name' | 'role' | 'region' | 'specialties'>>;

/** Saves the logged-in worker's profile. Backend: update workers where id = my worker. */
export async function updateMyWorkerProfile(patch: WorkerProfilePatch): Promise<void> {
  await mockLatency(600);
  if (patch.name !== undefined && patch.name.trim().length < 3)
    throw serviceError('validacao', 'Informe seu nome completo.');
  store.updateWorker(currentWorkerId(), patch);
}

export type CompanyProfilePatch = Partial<Pick<Company, 'name' | 'tipoObra' | 'location' | 'whatsapp'>>;

/** Saves the logged-in company's profile. Backend: update companies where id = my company. */
export async function updateMyCompanyProfile(patch: CompanyProfilePatch): Promise<void> {
  await mockLatency(600);
  if (patch.name !== undefined && patch.name.trim().length < 3)
    throw serviceError('validacao', 'Informe o nome da empresa.');
  store.updateCompany(currentCompanyId(), patch);
}

/** Publishes a photo/video on the worker's portfolio. Backend: upload to Storage, insert worker_posts. */
export async function addPortfolioPost(post: Pick<WorkerPost, 'mediaUrl' | 'mediaType' | 'caption'>): Promise<void> {
  await mockLatency(800);
  store.addWorkerPost(currentWorkerId(), post);
}

/** Removes one of the worker's posts. Backend: delete from worker_posts (own posts only). */
export async function deletePortfolioPost(postId: string): Promise<void> {
  await mockLatency(400);
  const post = store.getDb().workerPosts.find((p) => p.id === postId);
  if (!post) throw serviceError('nao_encontrado', 'Esse post não existe mais.');
  if (post.workerId !== currentWorkerId()) throw serviceError('nao_autorizado', 'Esse post não é seu.');
  store.deleteWorkerPost(postId);
}
