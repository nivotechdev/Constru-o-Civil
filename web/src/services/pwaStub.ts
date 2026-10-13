// The standalone preview (file://) has no service worker: `virtual:pwa-register` resolves here.
export function registerSW(): (reload?: boolean) => Promise<void> {
  return () => Promise.resolve();
}
