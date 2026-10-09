import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/errors';

export interface Action<A extends unknown[]> {
  /** Runs the action unless it is already running (no double submit). Never rejects. */
  run: (...args: A) => Promise<boolean>;
  loading: boolean;
  /** The last failure's message, until the next run or `reset`. */
  error: string | null;
  reset: () => void;
}

/**
 * A button's service call: tracks loading and error and ignores presses while it runs. `onSuccess`
 * receives what the service resolved with. What the person typed is never touched here, so a failure
 * keeps the form as it was.
 */
export function useAction<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  onSuccess?: (result: R) => void
): Action<A> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  // The latest callbacks, so `run` stays the same function across renders.
  const latest = useRef({ fn, onSuccess });
  useLayoutEffect(() => {
    latest.current = { fn, onSuccess };
  });

  const run = useCallback(async (...args: A) => {
    if (busy.current) return false;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await latest.current.fn(...args);
      busy.current = false;
      setLoading(false);
      latest.current.onSuccess?.(result);
      return true;
    } catch (e) {
      busy.current = false;
      setLoading(false);
      setError(errorMessage(e));
      return false;
    }
  }, []);
  const reset = useCallback(() => setError(null), []);
  return { run, loading, error, reset };
}
