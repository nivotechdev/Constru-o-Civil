// U45: while something is loading the app takes no tap and the phone's back button waits; the sign-up's questions
// are each a step of the back button; and the app's back arrow and the phone's walk the same history.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('o carregando que trava a tela (U45)', () => {
  afterEach(() => vi.useRealTimers());

  it('locks until every lock ends; the card shows the newest message; a lock ends by itself', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const busy = await import('../services/busy');
    expect([busy.isBusy(), busy.getBusy()]).toEqual([false, null]);
    const google = busy.startBusy({ message: 'Esperando o Google…' }, { maxMs: 60_000 });
    const button = busy.startBusy(); // an invisible one, started after: the card keeps its message
    expect(busy.getBusy()?.message).toBe('Esperando o Google…');
    google.update({ message: 'Entrando na sua conta…' });
    expect(busy.getBusy()?.message).toBe('Entrando na sua conta…');
    google.end();
    google.end(); // twice is harmless
    expect([busy.isBusy(), busy.getBusy()]).toEqual([true, {}]);
    vi.advanceTimersByTime(30_000); // nothing loads forever
    expect([busy.isBusy(), busy.getBusy()]).toEqual([false, null]);
    button.end();
    expect(busy.isBusy()).toBe(false);
  });
});

/** A browser history good enough for the router: entries, back/forward and popstate (a moment later, as in a browser). */
function fakeBrowser(start: string) {
  const entries: { state: unknown; url: string }[] = [{ state: null, url: start }];
  let index = 0;
  const loc = { protocol: 'https:', origin: 'https://bicos.app', pathname: start, search: '', hash: '' };
  const listeners: Record<string, () => void> = {};
  const show = () => Object.assign(loc, { pathname: new URL(entries[index].url, loc.origin).pathname });
  const history = {
    get state() {
      return entries[index].state;
    },
    pushState(state: unknown, _: string, url?: string) {
      entries.splice(index + 1, entries.length, { state, url: url ?? entries[index].url });
      index++;
      show();
    },
    replaceState(state: unknown, _: string, url?: string) {
      entries[index] = { state, url: url ?? entries[index].url };
      show();
    },
    go(delta: number) {
      const next = index + delta;
      if (next < 0 || next >= entries.length) return;
      setTimeout(() => {
        index = next;
        show();
        listeners.popstate?.();
      });
    },
    back() {
      this.go(-1);
    }
  };
  vi.stubGlobal('window', { location: loc, addEventListener: (e: string, fn: () => void) => (listeners[e] = fn) });
  vi.stubGlobal('location', loc);
  vi.stubGlobal('history', history);
  return {
    /** The phone's back button. */
    back: () => history.go(-1),
    count: () => entries.length,
    settle: () => new Promise((done) => setTimeout(done, 5))
  };
}

describe('voltar no celular e no app andam juntos (U45)', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it("the app's back arrow is the browser's back, and the phone's back button keeps the way back right", async () => {
    const browser = fakeBrowser('/mural');
    const router = await import('../services/router');
    router.startRouter();
    router.navigate('/vaga/BC-1');
    router.navigate('/construtora/obra');
    router.goBack('/mural'); // the arrow: the browser's own back (no extra entry left behind)
    await browser.settle();
    expect(router.currentPath()).toBe('/vaga/BC-1');
    expect(browser.count()).toBe(3);
    router.navigate('/construtora/obra');
    browser.back(); // the phone's button
    await browser.settle();
    expect(router.currentPath()).toBe('/vaga/BC-1');
    router.goBack('/mural'); // before U45 this stayed on the job (the app didn't know the phone went back)
    await browser.settle();
    expect(router.currentPath()).toBe('/mural');
  });

  it('a screen with steps holds one extra entry: the back button lands on the screen and goes back one step', async () => {
    const browser = fakeBrowser('/escolha-perfil');
    const router = await import('../services/router');
    router.startRouter();
    router.navigate('/cadastro/trabalhador');
    const seen: [string, boolean][] = [];
    router.subscribe(() => seen.push([router.currentPath(), router.isInnerEntry()]));
    router.holdBack(); // step 2
    router.holdBack(); // step 3: still one extra entry, not one per step
    expect([browser.count(), router.isInnerEntry()]).toEqual([3, true]);
    browser.back();
    await browser.settle();
    expect(seen).toEqual([['/cadastro/trabalhador', false]]); // the screen goes back one step
    router.holdBack(); // and puts the extra entry back
    router.releaseBack(); // back at the first step: gone, the back button leaves the screen again
    await browser.settle();
    expect([router.currentPath(), router.isInnerEntry()]).toEqual(['/cadastro/trabalhador', false]);
    browser.back();
    await browser.settle();
    expect(router.currentPath()).toBe('/escolha-perfil');
  });

  it('while something is loading the back button waits; the app itself can still go back', async () => {
    const browser = fakeBrowser('/login');
    const router = await import('../services/router');
    const busy = await import('../services/busy');
    router.startRouter();
    router.navigate('/escolha-perfil');
    router.navigate('/cadastro/trabalhador');
    const lock = busy.startBusy({ message: 'Entrando na sua conta…' });
    browser.back();
    await browser.settle();
    expect(router.currentPath()).toBe('/cadastro/trabalhador');
    expect(router.getLocation().path).toBe('/cadastro/trabalhador');
    router.goBack('/login');
    await browser.settle();
    expect(router.currentPath()).toBe('/escolha-perfil');
    lock.end();
    browser.back();
    await browser.settle();
    expect(router.currentPath()).toBe('/login');
  });
});
