// The captcha (Cloudflare Turnstile) on sign-up and sign-in, in real mode once it is configured
// (VITE_TURNSTILE_SITE_KEY; services/features.ts). Most people never see a challenge: the widget checks
// the browser in the background and only asks for a tap when in doubt. Each submit gets a fresh token
// (a token works once), so a screen that sends two requests (document login: our check, then the Auth)
// just asks twice.
import { useCallback, useEffect, useRef } from 'react';
import { FEATURES, TURNSTILE_SITE_KEY } from '../services/features';
import type { CaptchaSource } from '../services/auth';

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
  execute: (id: string) => void;
}

let api: Promise<TurnstileApi> | null = null;

function loadApi(): Promise<TurnstileApi> {
  const ready = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
  if (ready) return Promise.resolve(ready);
  if (!api) {
    api = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => {
        const t = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
        if (t) resolve(t);
        else reject(new Error('captcha'));
      };
      script.onerror = () => {
        api = null;
        reject(new Error('captcha'));
      };
      document.head.appendChild(script);
    });
  }
  return api;
}

/**
 * The widget (render it once in the form) and the source of tokens. Off → renders nothing and every
 * token is `undefined`, which the services and the server accept.
 */
export function useCaptcha(): { widget: React.ReactNode; getToken: CaptchaSource } {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const waiting = useRef<((token: string | undefined) => void)[]>([]);

  useEffect(() => {
    if (!FEATURES.captcha) return;
    let cancelled = false;
    loadApi()
      .then((t) => {
        if (cancelled || !box.current) return;
        widgetId.current = t.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: 'pt-br',
          appearance: 'interaction-only',
          execution: 'execute',
          callback: (token: string) => waiting.current.splice(0).forEach((done) => done(token)),
          'error-callback': () => waiting.current.splice(0).forEach((done) => done(undefined)),
          'expired-callback': () => undefined
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (widgetId.current)
        loadApi().then(
          (t) => t.remove(widgetId.current as string),
          () => undefined
        );
    };
  }, []);

  const getToken = useCallback<CaptchaSource>(async () => {
    if (!FEATURES.captcha) return undefined;
    const t = await loadApi().catch(() => null);
    if (!t || !widgetId.current) return undefined;
    return new Promise<string | undefined>((resolve) => {
      waiting.current.push(resolve);
      t.reset(widgetId.current as string);
      t.execute(widgetId.current as string);
    });
  }, []);

  return { widget: FEATURES.captcha ? <div ref={box} className="flex justify-center" /> : null, getToken };
}
