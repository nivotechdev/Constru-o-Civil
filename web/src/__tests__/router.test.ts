import { describe, expect, it } from 'vitest';
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
