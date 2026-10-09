// Photos and videos picked on the device reach the services as local `blob:` URLs (services/media.ts).
// With the real backend they are uploaded to Supabase Storage here, into the account's own folder
// (the buckets' policies only accept `<user id>/...`), and the public URL is what gets saved.
// Pictures are made lighter first (utils/image.ts: ≤ 1600 px, WebP/JPEG, HEIC converted) and the
// upload reports its progress, so a slow connection shows how far it got (X09/Z12).
import { serviceError } from '../errors';
import { supabaseConfig } from '../supabase';
import { currentUserId, db } from './client';

export type Bucket = 'vagas' | 'portfolio' | 'avatars';

/** 0 → 1, as the file goes up. */
export type Progress = (fraction: number) => void;

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm'
};

/** After compression a picture is a few hundred kB; these are the hard limits (F16). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** A local file picked on the device (not uploaded yet). */
export const isLocalMedia = (url: string | null | undefined): url is string => Boolean(url?.startsWith('blob:'));

/** The Storage path of one of our public URLs (`<user id>/<file>`), or `null` for anything else. */
export function storagePath(url: string | null | undefined, bucket: Bucket): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url ? url.indexOf(marker) : -1;
  return url && i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null;
}

/** Sends the file with XMLHttpRequest, which (unlike fetch) reports upload progress. */
async function uploadWithProgress(bucket: Bucket, path: string, blob: Blob, onProgress: Progress): Promise<void> {
  const config = supabaseConfig();
  const client = await db();
  const token = (await client.auth.getSession()).data.session?.access_token;
  if (!config || !token) throw serviceError('nao_autorizado', 'Entre na sua conta de novo para continuar.');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${config.url}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', config.anonKey);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(serviceError('falha_demo', 'Não deu para enviar a foto agora. Tente de novo.'));
    xhr.onerror = () => reject(serviceError('offline'));
    xhr.send(blob);
  });
  onProgress(1);
}

/**
 * Uploads a local file and returns its public URL; an URL already on the server is returned as is.
 * Pictures are compressed first.
 */
export async function uploadMedia(url: string, bucket: Bucket, onProgress?: Progress): Promise<string> {
  if (!isLocalMedia(url)) return url;
  let blob: Blob;
  try {
    blob = await (await fetch(url)).blob();
  } catch {
    throw serviceError('nao_encontrado', 'Não achamos a foto escolhida. Escolha de novo.');
  }
  const isVideo = blob.type.startsWith('video/');
  if (!isVideo) {
    try {
      const { compressImage } = await import('../../utils/image');
      blob = await compressImage(blob);
    } catch {
      throw serviceError('validacao', 'Não conseguimos abrir essa foto. Tente outra (JPG ou PNG).');
    }
  }
  if (blob.size > (isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES))
    throw serviceError('validacao', isVideo ? 'Esse vídeo é grande demais (até 50 MB).' : 'Essa foto é grande demais.');
  const userId = await currentUserId();
  const ext = EXTENSIONS[blob.type] ?? 'jpg';
  const path = `${userId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const client = await db();
  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    await uploadWithProgress(bucket, path, blob, onProgress);
  } else {
    const { error } = await client.storage
      .from(bucket)
      .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false, cacheControl: '31536000' });
    if (error) {
      if (/network|fetch/i.test(error.message)) throw serviceError('offline');
      throw serviceError('falha_demo', 'Não deu para enviar a foto agora. Tente de novo.');
    }
  }
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Uploads every local file of a list (keeps the order); progress is the average of the files. */
export function uploadAll(urls: string[], bucket: Bucket, onProgress?: Progress): Promise<string[]> {
  const parts = urls.map(() => 0);
  return Promise.all(
    urls.map((u, i) =>
      uploadMedia(
        u,
        bucket,
        onProgress &&
          ((f) => {
            parts[i] = f;
            onProgress(parts.reduce((a, b) => a + b, 0) / parts.length);
          })
      )
    )
  );
}

/** Removes files that are no longer used (a replaced photo, a deleted post). Never fails the action. */
export async function removeMedia(urls: (string | null | undefined)[], bucket: Bucket): Promise<void> {
  const paths = urls.map((u) => storagePath(u, bucket)).filter((p): p is string => Boolean(p));
  if (!paths.length) return;
  const client = await db();
  await client.storage
    .from(bucket)
    .remove(paths)
    .then(undefined, () => undefined);
}
