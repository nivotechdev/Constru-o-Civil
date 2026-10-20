import { describe, expect, it, vi } from 'vitest';
import { compileRoute, matchRoute } from '../services/router';
import { isChunkError } from '../components/ErrorBoundary';
import { screen } from '../routes';

describe('route matching', () => {
  const routes = [
    compileRoute('/perfil', 'perfil'),
    compileRoute('/perfil/editar', 'editar'),
    compileRoute('/trabalhador/:id', 'trabalhador'),
    compileRoute('/trabalhador/:id/:jobId', 'candidato'),
    compileRoute('/avaliacoes/:type/:id', 'avaliacoes')
  ];

  it('matches anchored patterns and decodes params', () => {
    expect(matchRoute(routes, '/perfil')?.route.value).toBe('perfil');
    expect(matchRoute(routes, '/perfil/editar')?.route.value).toBe('editar');
    expect(matchRoute(routes, '/trabalhador/edson')?.params).toEqual({ id: 'edson' });
    expect(matchRoute(routes, '/trabalhador/edson/BC-4821')?.params).toEqual({ id: 'edson', jobId: 'BC-4821' });
    expect(matchRoute(routes, '/avaliacoes/construtora/vila%20formosa')?.params).toEqual({
      type: 'construtora',
      id: 'vila formosa'
    });
    expect(matchRoute(routes, '/perfil/')).toBeNull();
    expect(matchRoute(routes, '/nada')).toBeNull();
  });
});

describe('Z10: no white screen', () => {
  it('a malformed % in a link does not crash the router', () => {
    const routes = [compileRoute('/vaga/:id', 'vaga')];
    expect(matchRoute(routes, '/vaga/50%')?.params).toEqual({ id: '50%' });
    expect(matchRoute(routes, '/vaga/%E0%A4%A')?.params).toEqual({ id: '%E0%A4%A' });
  });

  it('a screen whose download failed is downloaded again on the next try', async () => {
    let calls = 0;
    const s = screen(async () => {
      calls++;
      if (calls === 1) throw new TypeError('Failed to fetch dynamically imported module: /assets/Feed-abc.js');
      return { default: () => null };
    });
    await expect(s.preload()).rejects.toThrow(/dynamically imported/);
    expect(s.isLoaded()).toBe(false);
    await expect(s.preload()).resolves.toHaveProperty('default');
    expect(calls).toBe(2);
    expect(s.isLoaded()).toBe(true);
  });

  it('tells a stale chunk (new version deployed) from other errors', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: x.js'))).toBe(true);
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});

describe('X17: real URLs', () => {
  it('paths over HTTP, hash when opened from disk', async () => {
    const { routeUrl, usesPaths } = await import('../services/router');
    expect(usesPaths({ protocol: 'https:' })).toBe(true);
    expect(usesPaths({ protocol: 'file:' })).toBe(false);
    expect(routeUrl('/v/BC-1', { origin: 'https://bicos.app', pathname: '/mural', protocol: 'https:' })).toBe(
      'https://bicos.app/v/BC-1'
    );
    expect(routeUrl('/v/BC-1', { origin: 'null', pathname: '/x/index.html', protocol: 'file:' })).toBe(
      'null/x/index.html#/v/BC-1'
    );
  });

  it('navigates with the History API; an old #/ link is rewritten as a path', async () => {
    vi.resetModules();
    const loc = { protocol: 'https:', origin: 'https://bicos.app', pathname: '/', search: '', hash: '#/vaga/BC-7' };
    const set = (_: unknown, __: string, url: string) => {
      const u = new URL(url, 'https://bicos.app');
      Object.assign(loc, { pathname: u.pathname, hash: u.hash });
    };
    const listeners: Record<string, () => void> = {};
    vi.stubGlobal('window', { location: loc, addEventListener: (e: string, fn: () => void) => (listeners[e] = fn) });
    vi.stubGlobal('location', loc);
    vi.stubGlobal('history', { pushState: set, replaceState: set });
    const router = await import('../services/router');
    expect(router.currentPath()).toBe('/vaga/BC-7');
    router.startRouter();
    expect(loc).toMatchObject({ pathname: '/vaga/BC-7', hash: '' });
    expect(Object.keys(listeners)).toEqual(['popstate']);
    router.navigate('/mural');
    expect(loc.pathname).toBe('/mural');
    expect(router.getLocation().path).toBe('/mural');
    router.goBack();
    expect(router.currentPath()).toBe('/vaga/BC-7');
    vi.unstubAllGlobals();
  });
});

describe('U17: the copy page of the code e-mails', () => {
  it('is open to anyone (the link of the e-mail works logged in or not)', async () => {
    const { ROUTES } = await import('../routes');
    expect(matchRoute(ROUTES, '/copiar-codigo')?.route.value.access).toBe('public');
  });
});
