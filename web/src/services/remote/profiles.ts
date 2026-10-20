// The logged-in account editing its own profile and portfolio, with the real backend. RLS only lets
// each account update its own row, and only the columns the app edits (the rest — rating, counts,
// verification — is the server's).
import type { CompanyProfilePatch, ProfileImages, WorkerProfilePatch } from '../profiles';
import type { WorkerPost } from '../../types/models';
import type { TableUpdate } from '../../types/supabase';
import { serviceError } from '../errors';
import * as store from '../store';
import { db, invokeFunction, request } from './client';
import { apply, COMPANY_COLUMNS, putCompanies, putPosts, putWorkers, WORKER_COLUMNS } from './merge';
import { removeMedia, uploadMedia, type Progress } from './storage';

function session() {
  const s = store.getSession();
  if (!s) throw serviceError('nao_autorizado', 'Entre na sua conta de novo para continuar.');
  return s;
}

export async function updateMyWorkerProfile(patch: WorkerProfilePatch): Promise<void> {
  const s = session();
  if (!s.workerId) throw serviceError('nao_autorizado', 'Essa conta não é de trabalhador.');
  const worker = store.getDb().workers[s.workerId];
  const update: TableUpdate<'workers'> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.availability !== undefined) update.availability = patch.availability;
  if (patch.yearsExperience !== undefined) update.years_experience = patch.yearsExperience;
  if (patch.desiredPay !== undefined) update.desired_pay = patch.desiredPay;
  if (patch.travelKm !== undefined) update.travel_km = patch.travelKm;
  if (patch.bio !== undefined) update.bio = patch.bio.trim() || null;
  if (patch.point && patch.city !== undefined) {
    // U13: the place from "Usar minha localização atual" (the point already rounded to ~1 km).
    Object.assign(update, { city: patch.city, neighborhood: null, lat: patch.point.lat, lon: patch.point.lon });
  } else if (patch.city !== undefined && patch.city !== worker?.city) {
    // A new city moves the worker's base to its centre (the neighbourhood is no longer known).
    const { cityByLabel } = await import('../cities');
    const center = cityByLabel(patch.city);
    if (!center) throw serviceError('validacao', 'Escolha a cidade na lista.');
    Object.assign(update, { city: patch.city, neighborhood: null, lat: center.lat, lon: center.lon });
  }
  if (!Object.keys(update).length) return;
  const client = await db();
  const row = await request(() =>
    client
      .from('workers')
      .update(update)
      .eq('id', s.workerId as string)
      .select(WORKER_COLUMNS)
      .single()
  );
  apply(putWorkers([row], undefined, s.accountId));
}

export async function updateMyCompanyProfile(patch: CompanyProfilePatch): Promise<void> {
  const s = session();
  if (!s.companyId) throw serviceError('nao_autorizado', 'Essa conta não é de construtora.');
  const update: TableUpdate<'companies'> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.contactName !== undefined) update.contact_name = patch.contactName.trim() || null;
  if (!Object.keys(update).length) return;
  const client = await db();
  const row = await request(() =>
    client
      .from('companies')
      .update(update)
      .eq('id', s.companyId as string)
      .select(COMPANY_COLUMNS)
      .single()
  );
  apply(putCompanies([row], undefined, s.accountId));
}

async function reloadPosts(workerId: string): Promise<void> {
  const client = await db();
  const rows = await request(() =>
    client.from('worker_posts').select('*').eq('worker_id', workerId).order('created_at', { ascending: false })
  );
  apply(putPosts(workerId, rows));
}

export async function addPortfolioPost(
  post: Pick<WorkerPost, 'mediaUrl' | 'mediaType' | 'caption'>,
  onProgress?: Progress
): Promise<void> {
  const s = session();
  if (!s.workerId) throw serviceError('nao_autorizado', 'Só a conta de trabalhador tem portfólio.');
  const mediaUrl = post.mediaUrl ? await uploadMedia(post.mediaUrl, 'portfolio', onProgress) : null;
  const client = await db();
  await request(() =>
    client.from('worker_posts').insert({
      worker_id: s.workerId as string,
      media_url: mediaUrl,
      media_type: post.mediaType,
      caption: post.caption.trim()
    })
  );
  await reloadPosts(s.workerId);
}

export async function deletePortfolioPost(postId: string): Promise<void> {
  const s = session();
  const post = store.getDb().workerPosts.find((p) => p.id === postId);
  if (!post) throw serviceError('nao_encontrado', 'Esse post não existe mais.');
  if (post.workerId !== s.workerId) throw serviceError('nao_autorizado', 'Esse post não é seu.');
  const client = await db();
  await request(() => client.from('worker_posts').delete().eq('id', postId));
  store.deleteWorkerPost(postId);
  void removeMedia([post.mediaUrl], 'portfolio');
}

/**
 * The account's profile pictures (Z12): each slot is a new local file (uploaded, compressed), `null`
 * (removed) or left out (unchanged). Saved on the profile row; the replaced files are deleted.
 */
export async function saveMyProfileImages(changes: ProfileImages, onProgress?: Progress): Promise<void> {
  const s = session();
  const isWorker = Boolean(s.workerId);
  const slots = Object.entries(changes).filter(([, v]) => v !== undefined) as [keyof ProfileImages, string | null][];
  if (!slots.length) return;
  const done: number[] = slots.map(() => 0);
  const report = (i: number) => (f: number) => {
    done[i] = f;
    onProgress?.(done.reduce((a, b) => a + b, 0) / done.length);
  };
  const uploaded = await Promise.all(
    slots.map(([, v], i) => (v ? uploadMedia(v, 'avatars', report(i)) : Promise.resolve(null)))
  );
  const update: { photo_url?: string | null; cover_url?: string | null; logo_url?: string | null } = {};
  slots.forEach(([slot], i) => {
    if (slot === 'foto') update.photo_url = uploaded[i];
    else if (slot === 'logo') update.logo_url = uploaded[i];
    else update.cover_url = uploaded[i];
  });
  const client = await db();
  const before = isWorker
    ? store.getDb().workers[s.workerId as string]
    : store.getDb().companies[s.companyId as string];
  const old: (string | null | undefined)[] = slots.map(([slot]) =>
    slot === 'foto'
      ? (before as { photoUrl?: string | null })?.photoUrl
      : slot === 'logo'
        ? (before as { logoUrl?: string | null })?.logoUrl
        : before?.coverUrl
  );
  if (isWorker) {
    const row = await request(() =>
      client
        .from('workers')
        .update({ photo_url: update.photo_url, cover_url: update.cover_url })
        .eq('id', s.workerId as string)
        .select(WORKER_COLUMNS)
        .single()
    );
    apply(putWorkers([row], undefined, s.accountId));
  } else {
    const row = await request(() =>
      client
        .from('companies')
        .update({ logo_url: update.logo_url, cover_url: update.cover_url })
        .eq('id', s.companyId as string)
        .select(COMPANY_COLUMNS)
        .single()
    );
    apply(putCompanies([row], undefined, s.accountId));
  }
  void removeMedia(old, 'avatars');
}

/** Y25: RPC change_whatsapp (validates, syncs the profile row and resets the confirmation). */
export async function changeWhatsApp(phone: string): Promise<void> {
  const s = session();
  const client = await db();
  const answer = (await request(() => client.rpc('change_whatsapp', { p_whatsapp: phone.replace(/\D/g, '') }))) as {
    whatsapp: string;
    verified_at: string | null;
  };
  store.updateAccount(s.accountId, { whatsapp: answer.whatsapp, whatsappVerifiedAt: answer.verified_at });
  if (s.workerId) store.updateWorker(s.workerId, { whatsapp: answer.whatsapp });
  if (s.companyId) store.updateCompany(s.companyId, { whatsapp: answer.whatsapp });
}

/** L10: Edge Function verificar-cnpj. */
export async function checkMyCompany(): Promise<'pendente' | 'verificada' | 'reprovada'> {
  const answer = await invokeFunction<{ status?: 'pendente' | 'verificada' | 'reprovada' }>('verificar-cnpj', {});
  return answer?.status ?? 'pendente';
}

/** F16: the post's caption (RLS: own posts). */
export async function updatePostCaption(postId: string, caption: string): Promise<void> {
  const client = await db();
  await request(() => client.from('worker_posts').update({ caption }).eq('id', postId));
}
