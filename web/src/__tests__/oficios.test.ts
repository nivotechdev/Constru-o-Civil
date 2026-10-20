// B07 — one catalog of trades: jobs, the mural's filter, worker profiles and the search all use its ids.
import { describe, expect, it } from 'vitest';
import * as seed from '../data/seed';
import { getOficio, jobTitle, OFICIOS, oficioNome, searchOficios } from '../services/catalog';
import { passesFilters, searchMatches } from '../pages/worker/feed/feedUI';
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

  it('finds jobs by a synonym of their trade, and workers by name (U12: workers have no trade)', () => {
    const d = db();
    const open = Object.values(d.jobs).filter((j) => !j.closed);
    const r = searchMatches(d, open, 'Hidráulica', 'recrutador', from);
    expect(r.jobs.length).toBeGreaterThan(0);
    expect(r.jobs.every((j) => j.oficioId === 'encanador')).toBe(true);
    expect(searchMatches(d, open, 'porcelanato', 'recrutador', from).workers).toEqual([]);
    expect(searchMatches(d, open, 'Nelson', 'recrutador', from).workers.map((w) => w.id)).toContain('nelson');
  });
});
