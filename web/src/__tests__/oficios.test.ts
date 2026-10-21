// B07 — one catalog of trades: jobs, the mural's filter, worker profiles and the search all use its ids.
import { describe, expect, it } from 'vitest';
import * as seed from '../data/seed';
import { getOficio, jobTitle, OFICIOS, oficioNome, searchOficios } from '../services/catalog';
import { matchesSearch, passesFilters, searchMatches, searchWords } from '../pages/worker/feed/feedUI';
import type { Job } from '../types/models';
import { seedDatabase } from './helpers';

const db = seedDatabase;

describe('ofícios catalog', () => {
  it('has unique ids and every seed job points into it', () => {
    expect(new Set(OFICIOS.map((o) => o.id)).size).toBe(OFICIOS.length);
    for (const job of Object.values(seed.JOBS)) expect(getOficio(job.oficioId), job.id).toBeDefined();
  });

  it('names a job by its title, or by its trade', () => {
    expect(jobTitle({ oficioId: 'pintor', title: null })).toBe('Pintor');
    expect(jobTitle({ oficioId: 'pintor', title: '  Pintor de fachada ' })).toBe('Pintor de fachada');
    expect(oficioNome('nao-existe')).toBe('');
  });

  it('finds trades by name or synonym, ignoring accents and case', () => {
    expect(searchOficios('hidraulica').map((o) => o.id)).toEqual(['encanador']);
    expect(searchOficios('DRYWALL').map((o) => o.id)).toEqual(['gesseiro']);
    expect(searchOficios('pedreiro').map((o) => o.id)).toEqual(['pedreiro', 'pedreiro-acabamento', 'servente']);
  });
});

describe('mural filter and search by trade', () => {
  const from = { lat: -23.55, lon: -46.63 };
  const filters = { location: 'São Paulo, SP', oficio: 'eletricista', dist: 'Toda a cidade', quando: null, from };

  it('filters by the trade id, not by the text shown', () => {
    const jobs = Object.values(db().jobs);
    const found = jobs.filter((j) => passesFilters(j, filters)).map((j) => j.id);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((id) => db().jobs[id].oficioId === 'eletricista')).toBe(true);
  });

  it('finds jobs by a synonym of their trade (U49: never companies or people)', () => {
    const d = db();
    const open = Object.values(d.jobs).filter((j) => !j.closed);
    const r = searchMatches(open, 'Hidráulica', 'recrutador', from);
    expect(r.jobs.length).toBeGreaterThan(0);
    expect(r.jobs.every((j) => j.oficioId === 'encanador')).toBe(true);
    expect(Object.keys(r)).toEqual(['jobs']);
  });
});

describe('U49: a busca do mural é só de vagas — serviço, bairro ou cidade', () => {
  const from = { lat: -23.55, lon: -46.63 };
  const base = Object.values(db().jobs).find((j) => !j.closed)!;
  const job = (id: string, title: string, neighborhood: string, city: string, uf: string): Job => ({
    ...base,
    id,
    title,
    oficioId: null,
    companyId: base.companyId,
    address: { ...base.address, neighborhood, city, uf }
  });
  const jobs = [
    job('garcom', 'Garçom para evento', 'Centro', 'São Paulo', 'SP'),
    job('faxina', 'Faxina de apartamento', 'Tatuapé', 'São Paulo', 'SP'),
    job('caxias', 'Ajudante de cozinha', 'Centro', 'Caxias do Sul', 'RS')
  ];
  const where = { location: 'São Paulo, SP', allCities: false };
  const ids = (q: string, w = where) =>
    searchMatches(jobs, q, 'trabalhador', from, w)
      .jobs.map((j) => j.id)
      .sort();

  it('every word must be in the service, the neighborhood or the city — accents, case and linking words aside', () => {
    expect(ids('garcom')).toEqual(['garcom']);
    expect(ids('GARÇOM no centro')).toEqual(['garcom']);
    expect(ids('tatuape')).toEqual(['faxina']);
    expect(ids('garçom faxina')).toEqual([]);
    expect(searchWords('garçom em Caxias do Sul')).toEqual(['garcom', 'caxias', 'sul']);
    expect(searchWords('de')).toEqual(['de']);
  });

  it("stays in the mural's city, unless the search names another city (from 4 letters) or asks for all", () => {
    expect(ids('centro')).toEqual(['garcom']);
    expect(ids('Caxias do Sul')).toEqual(['caxias']);
    expect(ids('cozinha em caxias do sul, rs')).toEqual(['caxias']);
    expect(ids('caxi')).toEqual(['caxias']);
    expect(ids('cax')).toEqual([]);
    expect(ids('centro', { ...where, allCities: true })).toEqual(['caxias', 'garcom']);
  });

  it("the company's name is not a search", () => {
    const company = db().companies[base.companyId].name;
    expect(ids(company)).toEqual([]);
    expect(matchesSearch(jobs[0], 'xyz123')).toBe(false);
  });
});
