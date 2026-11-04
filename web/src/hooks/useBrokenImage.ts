// AUD-115: a picture that does not load falls back to what the screen shows without it (initials, the cover). The
// failure is remembered for that address only, so a new picture is tried.
import { useState } from 'react';

/** `[failed, onError]`: `failed` is true when this exact `src` did not load. */
export function useBrokenImage(src: string | null | undefined): [boolean, () => void] {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return [Boolean(src) && failedSrc === src, () => setFailedSrc(src ?? null)];
}
