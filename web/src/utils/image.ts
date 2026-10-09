// Pictures picked on the phone, made light before they are sent (X09/Z12): at most 1600 px on the long
// side, WebP (or JPEG where WebP can't be written), ~0.82 quality — a 6 MB camera photo becomes ~250 KB.
// HEIC (iPhone) is converted first, with a library downloaded only when such a photo shows up.
// Browser-only (canvas); the demo and the tests never call it.

export const MAX_SIDE = 1600;
const QUALITY = 0.82;

export function isHeic(file: Blob & { name?: string }): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name ?? '');
}

/** The size to draw a w×h picture at, keeping the proportion, within `max` on the long side. */
export function fitWithin(w: number, h: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(blob);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/** A lighter copy of a picture, ready to upload. GIFs and anything that fails to decode go as they are. */
export async function compressImage(input: Blob & { name?: string }): Promise<Blob> {
  let blob: Blob = input;
  if (isHeic(input)) {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({ blob: input, toType: 'image/jpeg', quality: QUALITY });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }
  if (!blob.type.startsWith('image/') || blob.type === 'image/gif') return blob;
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(blob);
  } catch {
    return blob;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return blob;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const out = (await canvasBlob(canvas, 'image/webp')) ?? (await canvasBlob(canvas, 'image/jpeg'));
  // Some browsers silently write PNG when they can't do WebP: fall back to JPEG then.
  if (out && out.type === 'image/webp') return out.size < blob.size ? out : blob;
  const jpeg = await canvasBlob(canvas, 'image/jpeg');
  return jpeg && jpeg.size < blob.size ? jpeg : blob;
}
