// Photos and videos picked on the device reach the services as local `blob:` URLs (services/media.ts).
// With the real backend they are uploaded to Supabase Storage here, into the account's own folder
// (the buckets' policies only accept `<user id>/...`), and the public URL is what gets saved.
import { serviceError } from '../errors';
import { currentUserId, db } from './client';

export type Bucket = 'vagas' | 'portfolio' | 'avatars';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm'
};

const MAX_BYTES = 50 * 1024 * 1024;

/** A local file picked on the device (not uploaded yet). */
export const isLocalMedia = (url: string | null | undefined): url is string => Boolean(url?.startsWith('blob:'));

/** Uploads a local file and returns its public URL; an URL already on the server is returned as is. */
export async function uploadMedia(url: string, bucket: Bucket): Promise<string> {
  if (!isLocalMedia(url)) return url;
  let blob: Blob;
  try {
    blob = await (await fetch(url)).blob();
  } catch {
    throw serviceError('nao_encontrado', 'Não achamos a foto escolhida. Escolha de novo.');
  }
  if (blob.size > MAX_BYTES) throw serviceError('validacao', 'Esse arquivo é grande demais (até 50 MB).');
  const userId = await currentUserId();
  const ext = EXTENSIONS[blob.type] ?? 'jpg';
  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const client = await db();
  const { error } = await client.storage
    .from(bucket)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (error) {
    if (/network|fetch/i.test(error.message)) throw serviceError('offline');
    throw serviceError('falha_demo', 'Não deu para enviar a foto agora. Tente de novo.');
  }
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Uploads every local file of a list (keeps the order). */
export function uploadAll(urls: string[], bucket: Bucket): Promise<string[]> {
  return Promise.all(urls.map((u) => uploadMedia(u, bucket)));
}
