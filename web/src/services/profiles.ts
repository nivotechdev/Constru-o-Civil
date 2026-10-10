// Worker and company profiles: reading them and the logged-in account editing its own. Each function
// says what the real backend does there (docs/CONTRATO-BACKEND.md).
import type { Company, Worker, WorkerPost } from '../types/models';
import { getOficio } from './catalog';
import { cityByLabel } from './cities';
import { serviceError } from './errors';
import { mockLatency } from './mockLatency';
import { currentCompanyId, currentWorkerId } from './selectors';
import * as store from './store';
import { IS_DEMO } from './mode';
import * as remote from './remote/profiles';
import * as remoteData from './remote/data';
import { isValidMobile, maskPhone } from '../utils/format';
import { demoVerifiedPhones } from './auth';

/** A worker's public profile (+ reviews, posts). Backend: select the worker by id. */
export async function loadWorkerProfile(_workerId: string): Promise<void> {
  if (!IS_DEMO) return remoteData.loadWorkerProfile(_workerId);
  await mockLatency(350);
}

/** A company's public profile (+ reviews, open jobs). Backend: select the company by id. */
export async function loadCompanyProfile(_companyId: string): Promise<void> {
  if (!IS_DEMO) return remoteData.loadCompanyProfile(_companyId);
  await mockLatency(350);
}

export type WorkerProfilePatch = Partial<Pick<Worker, 'name' | 'oficioId' | 'city' | 'specialties'>>;

/** L11: the problems of a profile edit, per field (the same in both modes; the database checks too). */
export function profileErrors(
  patch: { name?: string; oficioId?: string; city?: string; location?: string; contactName?: string },
  role: 'trabalhador' | 'recrutador'
): Partial<Record<'name' | 'oficioId' | 'city' | 'location' | 'contactName', string>> {
  const e: Partial<Record<'name' | 'oficioId' | 'city' | 'location' | 'contactName', string>> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 3) e.name = role === 'trabalhador' ? 'Informe seu nome completo.' : 'Informe o nome da empresa.';
    else if (name.length > 80) e.name = 'Use até 80 caracteres.';
    else if (role === 'trabalhador' && name.split(/\s+/).length < 2) e.name = 'Informe nome e sobrenome.';
  }
  if (patch.oficioId !== undefined && !getOficio(patch.oficioId)) e.oficioId = 'Escolha seu ofício na lista.';
  if (patch.city !== undefined && !cityByLabel(patch.city)) e.city = 'Escolha a cidade na lista.';
  if (patch.location !== undefined && !cityByLabel(patch.location)) e.location = 'Escolha a cidade na lista.';
  if (patch.contactName !== undefined) {
    const n = patch.contactName.trim().length;
    if (n > 0 && n < 2) e.contactName = 'Escreva o nome de quem fala com os candidatos.';
    else if (n > 60) e.contactName = 'Use até 60 caracteres.';
  }
  return e;
}

function checkProfile(patch: Parameters<typeof profileErrors>[0], role: 'trabalhador' | 'recrutador'): void {
  const first = Object.values(profileErrors(patch, role))[0];
  if (first) throw serviceError('validacao', first);
}

/** Saves the logged-in worker's profile. Backend: update workers where id = my worker. */
export async function updateMyWorkerProfile(patch: WorkerProfilePatch): Promise<void> {
  checkProfile(patch, 'trabalhador');
  if (!IS_DEMO) return remote.updateMyWorkerProfile(patch);
  await mockLatency(600);
  const worker = store.getDb().workers[currentWorkerId()];
  // A new city moves the worker's base to its centre (the neighbourhood is no longer known).
  if (patch.city !== undefined && worker && patch.city !== worker.city) {
    const center = cityByLabel(patch.city);
    if (!center) throw serviceError('validacao', 'Escolha a cidade na lista.');
    store.updateWorker(worker.id, { ...patch, neighborhood: null, lat: center.lat, lon: center.lon });
    return;
  }
  store.updateWorker(currentWorkerId(), patch);
}

export type CompanyProfilePatch = Partial<Pick<Company, 'name' | 'tipoObra' | 'location' | 'contactName'>>;

/**
 * Y25: changes the account's WhatsApp (worker or company). A mobile with DDD (11 digits). The number
 * stays confirmed only if it was just confirmed by code (verifyWhatsAppCode); otherwise
 * `whatsappVerifiedAt` goes back to empty. Backend: RPC change_whatsapp.
 */
export async function changeWhatsApp(phone: string): Promise<void> {
  if (!IS_DEMO) return remote.changeWhatsApp(phone);
  await mockLatency(500);
  const digits = phone.replace(/\D/g, '');
  if (!isValidMobile(digits)) throw serviceError('validacao', 'Confira o número: celular com DDD, 11 números.');
  const session = store.getSession();
  if (!session) throw serviceError('nao_autorizado');
  const masked = maskPhone(digits);
  const verifiedAt = demoVerifiedPhones.has(digits) ? new Date().toISOString() : null;
  demoVerifiedPhones.delete(digits);
  store.updateAccount(session.accountId, { whatsapp: masked, whatsappVerifiedAt: verifiedAt });
  if (session.workerId) store.updateWorker(session.workerId, { whatsapp: masked });
  if (session.companyId) store.updateCompany(session.companyId, { whatsapp: masked });
}

/** Saves the logged-in company's profile. Backend: update companies where id = my company. */
export async function updateMyCompanyProfile(patch: CompanyProfilePatch): Promise<void> {
  checkProfile(patch, 'recrutador');
  if (!IS_DEMO) return remote.updateMyCompanyProfile(patch);
  await mockLatency(600);
  store.updateCompany(currentCompanyId(), patch);
}

/**
 * The account's pictures: worker → `foto` (profile photo) and `capa` (cover); company → `logo` and `capa`.
 * Each is a new picture picked on the device (a local URL), `null` to remove it, or left out (unchanged).
 */
export interface ProfileImages {
  foto?: string | null;
  capa?: string | null;
  logo?: string | null;
}

/**
 * Saves the account's pictures (Z12) so everyone sees them (profiles, candidate lists, the mural…).
 * `onProgress` goes from 0 to 1 while they upload. Backend: compress, upload to Storage (avatars,
 * the account's folder), update photo_url/cover_url (worker) or logo_url/cover_url (company), and
 * delete the files they replace.
 */
export async function saveMyProfileImages(
  changes: ProfileImages,
  onProgress?: (fraction: number) => void
): Promise<void> {
  if (!IS_DEMO) return remote.saveMyProfileImages(changes, onProgress);
  await mockLatency(500);
  onProgress?.(1);
  const session = store.getSession();
  if (session?.workerId) {
    const patch: Partial<Worker> = {};
    if (changes.foto !== undefined) patch.photoUrl = changes.foto;
    if (changes.capa !== undefined) patch.coverUrl = changes.capa;
    store.updateWorker(session.workerId, patch);
  } else if (session?.companyId) {
    const patch: Partial<Company> = {};
    if (changes.logo !== undefined) patch.logoUrl = changes.logo;
    if (changes.capa !== undefined) patch.coverUrl = changes.capa;
    store.updateCompany(session.companyId, patch);
  }
}

/** Publishes a photo/video on the worker's portfolio. Backend: upload to Storage, insert worker_posts. */
export async function addPortfolioPost(post: Pick<WorkerPost, 'mediaUrl' | 'mediaType' | 'caption'>): Promise<void> {
  if (!IS_DEMO) return remote.addPortfolioPost(post);
  await mockLatency(800);
  store.addWorkerPost(currentWorkerId(), post);
}

/** Removes one of the worker's posts. Backend: delete from worker_posts (own posts only). */
export async function deletePortfolioPost(postId: string): Promise<void> {
  if (!IS_DEMO) return remote.deletePortfolioPost(postId);
  await mockLatency(400);
  const post = store.getDb().workerPosts.find((p) => p.id === postId);
  if (!post) throw serviceError('nao_encontrado', 'Esse post não existe mais.');
  if (post.workerId !== currentWorkerId()) throw serviceError('nao_autorizado', 'Esse post não é seu.');
  store.deleteWorkerPost(postId);
}
