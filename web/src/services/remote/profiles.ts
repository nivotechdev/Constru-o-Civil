// The logged-in account editing its own profile and portfolio, with the real backend. RLS only lets
// each account update its own row, and only the columns the app edits (the rest — rating, counts,
// verification — is the server's).
import type { CompanyProfilePatch, WorkerProfilePatch } from '../profiles';
import type { WorkerPost } from '../../types/models';
import type { TableUpdate } from '../../types/supabase';
import { serviceError } from '../errors';
import * as store from '../store';
import { db, request } from './client';
import { apply, COMPANY_COLUMNS, putCompanies, putPosts, putWorkers, WORKER_COLUMNS } from './merge';
import { uploadMedia } from './storage';

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
  if (patch.oficioId !== undefined) update.oficio_id = patch.oficioId;
  if (patch.specialties !== undefined) update.specialties = patch.specialties;
  if (patch.city !== undefined && patch.city !== worker?.city) {
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
  if (patch.tipoObra !== undefined) update.tipo_obra = patch.tipoObra || null;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.whatsapp !== undefined) update.whatsapp = patch.whatsapp.replace(/\D/g, '');
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
  // The number is private: the account row (readable by its owner) carries it, kept in sync by a trigger.
  if (typeof update.whatsapp === 'string') store.updateAccount(s.accountId, { whatsapp: update.whatsapp });
  apply(putCompanies([row], undefined, s.accountId));
}

async function reloadPosts(workerId: string): Promise<void> {
  const client = await db();
  const rows = await request(() =>
    client.from('worker_posts').select('*').eq('worker_id', workerId).order('created_at', { ascending: false })
  );
  apply(putPosts(workerId, rows));
}

export async function addPortfolioPost(post: Pick<WorkerPost, 'mediaUrl' | 'mediaType' | 'caption'>): Promise<void> {
  const s = session();
  if (!s.workerId) throw serviceError('nao_autorizado', 'Só a conta de trabalhador tem portfólio.');
  const mediaUrl = post.mediaUrl ? await uploadMedia(post.mediaUrl, 'portfolio') : null;
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

/** The Storage path of a public URL of the bucket, to remove the file with the post. */
function storagePath(url: string | null, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url ? url.indexOf(marker) : -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

export async function deletePortfolioPost(postId: string): Promise<void> {
  const s = session();
  const post = store.getDb().workerPosts.find((p) => p.id === postId);
  if (!post) throw serviceError('nao_encontrado', 'Esse post não existe mais.');
  if (post.workerId !== s.workerId) throw serviceError('nao_autorizado', 'Esse post não é seu.');
  const client = await db();
  await request(() => client.from('worker_posts').delete().eq('id', postId));
  store.deleteWorkerPost(postId);
  const path = storagePath(post.mediaUrl, 'portfolio');
  if (path)
    void client.storage
      .from('portfolio')
      .remove([path])
      .then(undefined, () => undefined);
}
