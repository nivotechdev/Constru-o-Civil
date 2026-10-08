import { describe, expect, it } from 'vitest';
import { compileRoute, matchRoute } from '../services/router';

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
