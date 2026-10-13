// F16: what the portfolio accepts — a photo of up to 10 MB (compressed before sending) or a video of up to
// 60 seconds and 50 MB (the Storage bucket refuses more).
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
export async function portfolioFileProblem(file: Pick<File, 'type' | 'size'> & Partial<File>): Promise<string | null> {
  const mb = file.size / (1024 * 1024);
  if (file.type.startsWith('video/')) {
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
