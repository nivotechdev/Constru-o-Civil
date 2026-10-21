// U45: the phone's back button inside a screen with inner steps (the sign-up's questions, "Trocar e-mail"): it goes
// back one step instead of leaving the screen. See holdBack() in services/router.ts.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { currentPath, holdBack, isInnerEntry, releaseBack, subscribe } from '../services/router';

/**
 * While `canGoBack` (there is a step to go back to), the back button calls `onBack` and stays on the screen. `step`
 * is the current step: after each one the extra entry is put back in place.
 */
export function useInnerBack(canGoBack: boolean, onBack: () => void, step: unknown = null): void {
  const [path] = useState(currentPath);
  const latest = useRef({ canGoBack, onBack });
  useLayoutEffect(() => {
    latest.current = { canGoBack, onBack };
  });

  useEffect(() => {
    if (canGoBack) holdBack();
    else releaseBack();
  }, [canGoBack, step]);

  useEffect(
    () =>
      subscribe(() => {
        // The back button landed on this screen's own entry (the extra one is gone): one step back.
        if (currentPath() !== path || isInnerEntry() || !latest.current.canGoBack) return;
        latest.current.onBack();
      }),
    [path]
  );
}
