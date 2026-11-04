// AUD-101: the "reenviar código" countdown, in one place. The three screens that had their own copy now share
// these two functions: the seconds left (never negative, whole seconds) and the mm:ss text ("1:00", "0:45").

/** Seconds left of a `total`-second wait that started at `from` (ms); 0 when there was no wait. */
export function secondsLeft(from: number, total: number, now: number): number {
  if (!from) return 0;
  return Math.max(0, total - Math.floor((now - from) / 1000));
}

/** 60 → "1:00", 45 → "0:45", 0 → "0:00"; never "0:60". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
