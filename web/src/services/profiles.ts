// Worker and company profiles: reading them and the logged-in account editing its own. Each function
// says what the real backend does there (docs/CONTRATO-BACKEND.md).
import type { Company, CompanyVerification, Worker, WorkerPost } from '../types/models';
import { homeFromResolved, type ResolvedAddress } from './address';
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
import { isValidCnpj } from '../utils/document';
import { MAX_CAPTION } from '../utils/media';
import {
  cleanExperiences,
  MAX_ABOUT,
  MAX_EXPERIENCE_LENGTH,
  MAX_EXPERIENCES,
  MIN_EXPERIENCE_LENGTH
} from '../utils/profileText';

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

export type WorkerProfilePatch = Partial<
  Pick<Worker, 'name' | 'city' | 'bio'> & {
    /** U13: a new place from "Usar minha localização atual" (city and point together). */
    point: { lat: number; lon: number };
    /** U34: the whole list (an empty one clears it). */
    experiences: string[];
  }
>;

type ProfileField = 'name' | 'city' | 'location' | 'bio' | 'about' | 'experiences';

/** L11: the problems of a profile edit, per field (the same in both modes; the database checks too). */
export function profileErrors(
  patch: {
    name?: string;
    oficioId?: string;
    city?: string;
    location?: string;
    bio?: string;
    about?: string;
    experiences?: string[];
  },
  role: 'trabalhador' | 'recrutador'
): Partial<Record<ProfileField, string>> {
  const e: Partial<Record<ProfileField, string>> = {};
  if (patch.bio !== undefined && patch.bio.trim().length > MAX_ABOUT) e.bio = `Use até ${MAX_ABOUT} caracteres.`;
  if (patch.about !== undefined && patch.about.trim().length > MAX_ABOUT) e.about = `Use até ${MAX_ABOUT} caracteres.`;
  if (patch.experiences !== undefined) {
    const list = cleanExperiences(patch.experiences);
    if (list.length > MAX_EXPERIENCES) e.experiences = `Coloque até ${MAX_EXPERIENCES} experiências.`;
    else if (list.some((x) => x.length < MIN_EXPERIENCE_LENGTH))
      e.experiences = 'Escreva um pouco mais em cada experiência.';
    else if (list.some((x) => x.length > MAX_EXPERIENCE_LENGTH))
      e.experiences = `Use até ${MAX_EXPERIENCE_LENGTH} caracteres em cada experiência.`;
  }
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (name.length < 3) e.name = role === 'trabalhador' ? 'Informe seu nome completo.' : 'Informe o nome da empresa.';
    else if (name.length > 80) e.name = 'Use até 80 caracteres.';
    else if (role === 'trabalhador' && name.split(/\s+/).length < 2) e.name = 'Informe nome e sobrenome.';
  }
  if (patch.city !== undefined && !cityByLabel(patch.city)) e.city = 'Escolha a cidade na lista.';
  if (patch.location !== undefined && !cityByLabel(patch.location)) e.location = 'Escolha a cidade na lista.';
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
  const { experiences, bio, point, ...rest } = patch;
  const text: Partial<Worker> = {
    ...(experiences !== undefined ? { experiences: cleanExperiences(experiences) } : {}),
    ...(bio !== undefined ? { bio: bio.trim() || undefined } : {})
  };
  // U13: the place from the location button (city and its point); the neighbourhood is no longer known.
  if (point && worker) {
    store.updateWorker(worker.id, { ...rest, ...text, neighborhood: null, lat: point.lat, lon: point.lon });
    return;
  }
  // A new city alone moves the worker's base to its centre.
  if (patch.city !== undefined && worker && patch.city !== worker.city) {
    const center = cityByLabel(patch.city);
    if (!center) throw serviceError('validacao', 'Escolha a cidade na lista.');
    store.updateWorker(worker.id, { ...rest, ...text, neighborhood: null, lat: center.lat, lon: center.lon });
    return;
  }
  store.updateWorker(currentWorkerId(), { ...rest, ...text });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * U51: the session's address in the demo store — the address itself (only the account reads it) and what others see:
 * the city, and for a worker the point rounded to ~1 km (as the server does in save_address).
 */
export function keepAddressInDemo(a: ResolvedAddress): void {
  const session = store.getSession();
  if (!session) throw serviceError('nao_autorizado');
  store.setAddress(session.accountId, homeFromResolved(a));
  if (session.workerId)
    store.updateWorker(session.workerId, {
      city: a.cityLabel,
      neighborhood: null,
      lat: round2(a.lat),
      lon: round2(a.lon)
    });
  else if (session.companyId) store.updateCompany(session.companyId, { location: a.cityLabel });
}

/**
 * U51: changes the account's address ("Editar perfil"; sign-up saves the first one with finishSignUp). The address
 * stays the account's own; the profile shows only the city. Backend: RPC set_my_address.
 */
export async function saveMyAddress(address: ResolvedAddress): Promise<void> {
  if (!IS_DEMO) return remote.saveMyAddress(address);
  await mockLatency(500);
  keepAddressInDemo(address);
}

export type CompanyProfilePatch = Partial<Pick<Company, 'name' | 'location' | 'about'>>;

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
  const { about, ...rest } = patch;
  store.updateCompany(currentCompanyId(), {
    ...rest,
    ...(about !== undefined ? { about: about.trim() || undefined } : {})
  });
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
export async function addPortfolioPost(
  post: Pick<WorkerPost, 'mediaUrl' | 'mediaType' | 'caption'>,
  onProgress?: (fraction: number) => void
): Promise<void> {
  if (post.caption.length > MAX_CAPTION) throw serviceError('validacao', `Use até ${MAX_CAPTION} caracteres.`);
  if (!IS_DEMO) return remote.addPortfolioPost(post, onProgress);
  await mockLatency(800);
  onProgress?.(1);
  store.addWorkerPost(currentWorkerId(), post);
}

/** F16: changes a post's caption (own posts only). Backend: update worker_posts.caption. */
export async function updatePostCaption(postId: string, caption: string): Promise<void> {
  const text = caption.trim();
  if (text.length > MAX_CAPTION) throw serviceError('validacao', `Use até ${MAX_CAPTION} caracteres.`);
  const post = store.getDb().workerPosts.find((p) => p.id === postId);
  if (!post) throw serviceError('nao_encontrado', 'Esse post não existe mais.');
  if (post.workerId !== currentWorkerId()) throw serviceError('nao_autorizado', 'Esse post não é seu.');
  if (!IS_DEMO) await remote.updatePostCaption(postId, text);
  else await mockLatency(300);
  store.transact((d) => ({
    ...d,
    workerPosts: d.workerPosts.map((p) => (p.id === postId ? { ...p, caption: text } : p))
  }));
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

/**
 * L10: asks for the automatic check of the company (CNPJ "ativa" at the Receita, via BrasilAPI). Answers
 * where the check stands. A CPF, an unknown CNPJ or the service being down leave it "pendente" for the
 * team. Backend: Edge Function verificar-cnpj. Demo: a valid CNPJ is verified at once.
 */
export async function checkMyCompany(): Promise<CompanyVerification> {
  const id = currentCompanyId();
  if (!IS_DEMO) {
    const answer = await remote.checkMyCompany();
    store.updateCompany(id, {
      verification: answer,
      verified: answer === 'verificada',
      ...(answer === 'verificada' ? { verifiedAt: new Date().toISOString() } : {})
    });
    return answer;
  }
  await mockLatency(800);
  const company = store.getDb().companies[id];
  if (!company || (company.verification ?? 'pendente') !== 'pendente') return company?.verification ?? 'pendente';
  if (!isValidCnpj(company.cnpj ?? '')) return 'pendente';
  store.updateCompany(id, { verification: 'verificada', verified: true, verifiedAt: new Date().toISOString() });
  return 'verificada';
}
