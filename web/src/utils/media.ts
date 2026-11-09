// F16: what the portfolio accepts — a photo of up to 10 MB (compressed before sending) or a video of up to
// 60 seconds and 50 MB (the Storage bucket refuses more).
import { FEATURES } from '../services/features';

export const MAX_PHOTO_MB = 10;
export const MAX_VIDEO_MB = 50;
export const MAX_VIDEO_SECONDS = 60;
export const MAX_CAPTION = 280;

/** How long a video file is, in seconds (`null` when the browser can't tell). */
function videoSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      const done = (v: number | null) => {
        URL.revokeObjectURL(url);
        resolve(v);
      };
      video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
      video.onerror = () => done(null);
      video.src = url;
    } catch {
      resolve(null);
    }
  });
}

/** The problem with a picked file, or `null` when it can be posted. */
export async function portfolioFileProblem(
  file: Pick<File, 'type' | 'size'> & Partial<File>,
  videoAllowed: boolean = FEATURES.video
): Promise<string | null> {
  const mb = file.size / (1024 * 1024);
  if (file.type.startsWith('video/')) {
    // AUD-008: a video carries the phone's location in its metadata and goes to a public bucket; photos are cleaned
    // before sending, videos are not. Videos stay off in real mode until they are cleaned on the server.
    if (!videoAllowed) return 'Por enquanto só dá para enviar foto. Escolha uma foto.';
    if (mb > MAX_VIDEO_MB) return `Vídeo de até ${MAX_VIDEO_MB} MB. Escolha um mais curto.`;
    const seconds = typeof document !== 'undefined' ? await videoSeconds(file as File) : null;
    if (seconds !== null && seconds > MAX_VIDEO_SECONDS + 0.5)
      return `Vídeo de até ${MAX_VIDEO_SECONDS} segundos. Corte o vídeo e tente de novo.`;
    return null;
  }
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name ?? ''))
    return 'Escolha uma foto ou um vídeo.';
  if (mb > MAX_PHOTO_MB) return `Foto de até ${MAX_PHOTO_MB} MB.`;
  return null;
}

/**
 * AUD-086: which of the picked files go into a job's photos. Only photos (the same size limit as the portfolio),
 * and no more than `max` in all. `problem` says what was left out, in the person's words.
 */
export function pickJobPhotos<T extends Pick<File, 'type' | 'size'> & Partial<File>>(
  files: T[],
  current: number,
  max: number
): { accepted: T[]; problem: string | null } {
  const isPhoto = (f: T) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name ?? '');
  const photos = files.filter(isPhoto);
  const sized = photos.filter((f) => f.size / (1024 * 1024) <= MAX_PHOTO_MB);
  const accepted = sized.slice(0, Math.max(max - current, 0));
  let problem: string | null = null;
  if (photos.length < files.length) problem = 'Só dá para enviar foto. Os outros arquivos ficaram de fora.';
  else if (sized.length < photos.length) problem = `Foto de até ${MAX_PHOTO_MB} MB. As maiores ficaram de fora.`;
  else if (sized.length > accepted.length) problem = `Só cabem ${max} fotos.`;
  return { accepted, problem };
}
