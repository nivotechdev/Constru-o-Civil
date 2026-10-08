// Supabase preparation: the client stays off without the environment variables, and the mapper
// functions translate the REAL deployed schema (../../../supabase/migrations/) into the app's domain
// types correctly in both directions.
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { getSupabase, isSupabaseConfigured, supabaseConfig, type BicosSupabase } from '../services/supabase';
import {
  companyFromOwnProfile,
  companyFromPerfilPublico,
  jobToVagaInsert,
  mapCandidaturaRow,
  mapPublicacaoRow,
  mapVagaRow,
  placeholderCompany,
  placeholderWorker,
  reviewSummaryFromRows,
  workerFromOwnProfile,
  workerFromPerfilPublico
} from '../services/supabaseMappers';
import type { Job } from '../types/models';
import type { RpcReturns, TableRow } from '../types/supabase';

describe('Supabase client (not connected)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('stays off without the environment variables, so the app keeps its mock data', async () => {
    expect(supabaseConfig({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } as ImportMetaEnv)).toBeNull();
    expect(supabaseConfig({ VITE_SUPABASE_URL: 'https://x.supabase.co' } as ImportMetaEnv)).toBeNull();
    expect(isSupabaseConfigured()).toBe(false);
    expect(await getSupabase()).toBeNull();
  });

  it('reads the project URL and anon key when both are set', async () => {
    const env = { VITE_SUPABASE_URL: ' https://x.supabase.co ', VITE_SUPABASE_ANON_KEY: 'anon-key' } as ImportMetaEnv;
    expect(supabaseConfig(env)).toEqual({ url: 'https://x.supabase.co', anonKey: 'anon-key' });
  });

  it('creates the client lazily from the environment, without any request', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const mod = await import('../services/supabase');
    const client = await mod.getSupabase();
    expect(client).not.toBeNull();
    expect(typeof client?.from).toBe('function');
    expect(await mod.getSupabase()).toBe(client);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('types queries and RPC calls from the real table/function definitions', () => {
    // Type-level only (never called): checked by `npm run typecheck`.
    const typed = async (supabase: BicosSupabase) => {
      const vagas = await supabase.from('vagas').select('id, valor, dias').eq('autor_id', 'x');
      expectTypeOf(vagas.data).toEqualTypeOf<{ id: string; valor: number | null; dias: 'semana' | 'fimdesemana' | 'qualquer' | null }[] | null>();
      const whats = await supabase.rpc('contato_whatsapp', { p_candidatura_id: 'x' });
      expectTypeOf(whats.data).toEqualTypeOf<string | null>();
    };
    expect(typeof typed).toBe('function');
  });
});

describe('table row <-> domain mappers (real schema)', () => {
  // Deliberately "today" in LOCAL time (not UTC, and not a fixed date) — formatJobDate compares
  // against local calendar days, so building this from toISOString() would misfire near midnight UTC.
  const now = new Date();
  const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const vagaRow: TableRow<'vagas'> = {
    id: 'uuid-1',
    autor_id: 'uuid-empresa',
    autor_nome: 'Construtora Meridiano',
    titulo: 'Pedreiro de acabamento',
    valor: '180.00' as unknown as number, // numeric columns come back as strings from postgres/postgrest
    turno: 'Manhã',
    cidade: 'Tatuapé, SP',
    data_servico: TODAY,
    horario: '7h-17h',
    status: 'aberta',
    criado_em: '2026-09-20T12:00:00Z',
    slots: 2,
    endereco: 'Rua das Obras, 123',
    duracao: '1 diária',
    requisitos: ['Capacete', 'Botina'],
    foto_url: 'https://x.supabase.co/storage/v1/object/public/avatars/a/1.jpg',
    fotos: null,
    dias: 'semana',
    descricao: 'Acabamento fino em apartamento.',
    urgente: true,
    impulsionada: false,
    sem_contratacao: false
  };

  it('maps a vaga row into a Job, falling back to foto_url as the only photo', () => {
    const job = mapVagaRow(vagaRow);
    expect(job).toMatchObject({
      id: 'uuid-1',
      companyId: 'uuid-empresa',
      role: 'Pedreiro de acabamento',
      pay: 180,
      location: 'Tatuapé, SP',
      city: 'Tatuapé, SP',
      dias: 'semana',
      urgent: true,
      boosted: false,
      slots: 2,
      closed: false,
      requirements: ['Capacete', 'Botina']
    });
    expect(job.photos).toEqual([vagaRow.foto_url]);
    expect(job.date).toBe('Hoje'); // relies on the fixture's data_servico being frozen to "today" below
  });

  it('prefers the fotos[] carousel over foto_url when both are present', () => {
    const job = mapVagaRow({ ...vagaRow, fotos: ['a.jpg', 'b.jpg'] });
    expect(job.photos).toEqual(['a.jpg', 'b.jpg']);
  });

  it('marks a job closed for any non-"aberta" status', () => {
    expect(mapVagaRow({ ...vagaRow, status: 'preenchida' }).closed).toBe(true);
    expect(mapVagaRow({ ...vagaRow, status: 'expirada' }).closed).toBe(true);
  });

  it('round-trips a Job into a vagas insert payload', () => {
    const job: Job = mapVagaRow(vagaRow);
    const insert = jobToVagaInsert(job, 'Construtora Meridiano');
    expect(insert).toMatchObject({
      autor_id: 'uuid-empresa',
      autor_nome: 'Construtora Meridiano',
      titulo: 'Pedreiro de acabamento',
      valor: 180,
      cidade: 'Tatuapé, SP',
      dias: 'semana',
      urgente: true
    });
  });

  it('maps a candidatura row into an Application', () => {
    const row: TableRow<'candidaturas'> = {
      id: 'uuid-cand',
      vaga_id: 'uuid-1',
      candidato_id: 'uuid-trabalhador',
      nome_candidato: 'Jorge Alves',
      email_candidato: 'jorge@example.com',
      candidatado_em: '2026-09-21T09:00:00Z',
      status: 'pre_selecionado'
    };
    expect(mapCandidaturaRow(row)).toEqual({
      id: 'uuid-cand',
      jobId: 'uuid-1',
      workerId: 'uuid-trabalhador',
      status: 'pre_selecionado'
    });
  });

  it('maps a publicacoes_trabalhador row into a WorkerPost', () => {
    const row: TableRow<'publicacoes_trabalhador'> = {
      id: 'uuid-post',
      trabalhador_id: 'uuid-trabalhador',
      midia_url: 'https://x.supabase.co/storage/v1/object/public/portfolio/a/1.jpg',
      midia_tipo: 'imagem',
      legenda: 'Reforma concluída',
      criado_em: '2026-09-10T10:00:00Z'
    };
    expect(mapPublicacaoRow(row)).toEqual({
      id: 'uuid-post',
      workerId: 'uuid-trabalhador',
      mediaUrl: row.midia_url,
      mediaType: 'image',
      caption: 'Reforma concluída',
      date: '2026-09-10'
    });
  });

  it('summarizes avaliacoes rows into a rating and review list', () => {
    const summary = reviewSummaryFromRows([
      { nota: 5, comentario: 'Ótimo trabalho', criado_em: '2026-09-20T10:00:00Z', avaliador: { nome: 'Meridiano' } },
      { nota: 4, comentario: null, criado_em: '2026-09-10T10:00:00Z', avaliador: { nome: 'Meridiano' } }
    ]);
    expect(summary.reviewCount).toBe(2);
    expect(summary.jobsDone).toBe(2);
    expect(summary.rating).toBe(4.5);
    expect(summary.reviews[0]).toEqual({
      author: 'Meridiano',
      company: 'Meridiano',
      value: 5,
      text: 'Ótimo trabalho',
      date: '2026-09-20'
    });
  });

  it('gives an empty summary for a profile with no reviews yet', () => {
    expect(reviewSummaryFromRows([])).toEqual({ reviews: [], rating: 0, reviewCount: 0, jobsDone: 0 });
  });

  it('builds a minimal placeholder company/worker from a denormalized name', () => {
    expect(placeholderCompany('uuid-empresa', 'Construtora Meridiano', 'Tatuapé, SP')).toMatchObject({
      id: 'uuid-empresa',
      name: 'Construtora Meridiano',
      location: 'Tatuapé, SP',
      whatsapp: ''
    });
    expect(placeholderWorker('uuid-trabalhador', 'Jorge Alves')).toMatchObject({
      id: 'uuid-trabalhador',
      name: 'Jorge Alves',
      initials: 'JA'
    });
  });

  it("maps the signed-in user's own profile row into a Company/Worker with its real whatsapp", () => {
    const profileRow: TableRow<'profiles'> = {
      id: 'uuid-empresa',
      nome: 'Construtora Meridiano',
      email: 'contato@meridiano.example',
      tipo: 'construtora',
      ativo: true,
      criado_em: '2026-01-01T00:00:00Z',
      atualizado_em: '2026-01-01T00:00:00Z',
      foto_url: null,
      capa_url: null,
      biografia: null,
      cargo: null,
      regiao: null,
      especialidades: null,
      tipo_obra: 'Residencial',
      regiao_atuacao: 'Zona Leste, SP',
      whatsapp: '11988887777'
    };
    expect(companyFromOwnProfile(profileRow, '12.345.678/0001-99')).toMatchObject({
      id: 'uuid-empresa',
      name: 'Construtora Meridiano',
      cnpj: '12.345.678/0001-99',
      whatsapp: '11988887777'
    });
    const workerRow: TableRow<'profiles'> = { ...profileRow, tipo: 'pedreiro', cargo: 'Pedreiro', regiao: 'Zona Leste, SP' };
    expect(workerFromOwnProfile(workerRow)).toMatchObject({ id: 'uuid-empresa', name: 'Construtora Meridiano', role: 'Pedreiro' });
  });

  it("never carries a whatsapp number for someone else's profile (perfil_publico)", () => {
    const row: RpcReturns<'perfil_publico'>[number] = {
      id: 'uuid-empresa',
      nome: 'Construtora Meridiano',
      tipo: 'construtora',
      foto_url: null,
      capa_url: null,
      biografia: null,
      cargo: null,
      regiao: null,
      especialidades: null,
      tipo_obra: 'Residencial',
      regiao_atuacao: 'Zona Leste, SP',
      criado_em: '2026-01-01T00:00:00Z',
      documento: '12.345.678/0001-99'
    };
    const company = companyFromPerfilPublico(row);
    expect(company.whatsapp).toBe('');
    expect(company.cnpj).toBe('12.345.678/0001-99');
    const worker = workerFromPerfilPublico({ ...row, tipo: 'pedreiro', especialidades: ['Elétrica'] });
    expect(worker.specialties).toEqual(['Elétrica']);
  });
});
