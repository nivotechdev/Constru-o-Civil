// X02: the service worker that keeps the app on the phone (opens without signal, installable). A new
// published version waits for the person: a toast offers "Atualizar" — nothing is swapped under an open
// screen. The standalone preview (file://) has no service worker (vite.config.ts points this import at
// a stub there).
import { registerSW } from 'virtual:pwa-register';
import { showToast } from './toast';

const HOUR = 60 * 60 * 1000;

export function startServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  const update = registerSW({
    onNeedRefresh() {
      showToast('Tem uma versão nova da Bicos.', {
        action: { label: 'Atualizar', onClick: () => void update(true) },
        duration: 24 * HOUR
      });
    },
    // An app left open for days still hears about new versions.
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update().catch(() => undefined), HOUR);
    }
  });
}
