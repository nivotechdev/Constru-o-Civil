// U21: the light/dark theme — kept on this device, put on <html data-theme>, and the phone bar follows it.
import { afterEach, describe, expect, it, vi } from 'vitest';

function fakePage(saved: string | null) {
  const box = new Map<string, string>(saved ? [['bicos-tema', saved]] : []);
  const meta = { content: '#1D4BED', setAttribute: (_: string, v: string) => void (meta.content = v) };
  const root = { dataset: {} as Record<string, string>, ownerDocument: { querySelector: () => meta } };
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => box.get(k) ?? null,
    setItem: (k: string, v: string) => void box.set(k, v)
  });
  vi.stubGlobal('document', { documentElement: root });
  return { box, meta, root };
}

describe('tema (U21)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('starts light, switches to dark and back, and remembers it', async () => {
    const page = fakePage(null);
    const theme = await import('../services/theme');
    theme.applySavedTheme();
    expect(theme.getTheme()).toBe('claro');
    expect(page.root.dataset.theme).toBeUndefined();

    const seen: string[] = [];
    const stop = theme.subscribeTheme(() => seen.push(theme.getTheme()));
    theme.setTheme('escuro');
    expect(page.root.dataset.theme).toBe('dark');
    expect(page.box.get('bicos-tema')).toBe('escuro');
    expect(page.meta.content).toBe('#0D121B');
    theme.setTheme('claro');
    expect(page.root.dataset.theme).toBeUndefined();
    expect(page.meta.content).toBe('#1D4BED');
    stop();
    expect(seen).toEqual(['escuro', 'claro']);
  });

  it('opens in the theme saved on the device', async () => {
    const page = fakePage('escuro');
    const theme = await import('../services/theme');
    theme.applySavedTheme();
    expect(theme.getTheme()).toBe('escuro');
    expect(page.root.dataset.theme).toBe('dark');
  });
});
