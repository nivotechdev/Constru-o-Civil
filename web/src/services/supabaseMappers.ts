// Table row (and RPC result) <-> domain model conversion, against the REAL deployed schema
// (../../../supabase/migrations/). This is a straight TypeScript port of the same translation the
// vanilla front already validated end-to-end (app/js/store.js — see git history at 63346d0 for the
// exact reference), adapted to this app's Company/Worker/Job/Application/Review/WorkerPost shapes.
//
// Two shortcuts carried over on purpose from that reference, because both are already proven in
// production use, not oversights:
//   - A company/worker we only know about through a denormalized name (a job's `autor_nome`, an
//     application's `nome_candidato`) gets a minimal placeholder record instead of a real fetch —
//     the full profile loads lazily (`perfil_publico`) only once something actually needs it.
//   - A review's `author` and `company` fields are both set to the same name; screens only ever read
//     the one that matches the profile they're showing, so telling the two apart here would be work
//     with no observable effect.
import { formatJobDate } from '../utils/format';
import type { Application, ApplicationStatus, Company, Job, Review, Worker, WorkerPost } from '../types/models';
import type { RpcReturns, TableInsert, TableRow } from '../types/supabase';

export function initials(nome: string | null | undefined): string {
  const partes = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return '?';
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
}

// ---- jobs ----

export function mapVagaRow(row: TableRow<'vagas'>): Job {
  const photos = row.fotos && row.fotos.length ? row.fotos : row.foto_url ? [row.foto_url] : undefined;
  return {
    id: row.id,
    companyId: row.autor_id,
    role: row.titulo,
    pay: row.valor == null ? null : Number(row.valor),
    location: row.cidade,
    city: row.cidade,
    address: row.endereco || '',
    distance: '0 km', // no real geolocation search yet (`vagas.localizacao` stays unused for now)
    date: formatJobDate(row.data_servico),
    hours: row.horario,
    duration: row.duracao || '',
    dias: row.dias,
    urgent: row.urgente,
    boosted: row.impulsionada,
    photos,
    slots: row.slots || 1,
    closed: row.status !== 'aberta',
    semContratacao: row.sem_contratacao,
    description: row.descricao || '',
    requirements: row.requisitos || []
  };
}

/** What `createJob`'s real branch sends to `vagas.insert(...)`. */
export function jobToVagaInsert(job: Job, autorNome: string | null): TableInsert<'vagas'> {
  return {
    autor_id: job.companyId,
    autor_nome: autorNome,
    titulo: job.role,
    valor: job.pay,
    cidade: job.city || job.location,
    endereco: job.address || null,
    // `data_servico` is required by the real schema; the publish form always collects a date today
    // (see plan: "a combinar" dates are deferred), so this is never actually null in practice.
    data_servico: job.date as string,
    horario: job.hours,
    duracao: job.duration || null,
    dias: job.dias || null,
    slots: job.slots || 1,
    requisitos: job.requirements,
    descricao: job.description || null,
    foto_url: job.photos?.[0] || null,
    fotos: job.photos && job.photos.length ? job.photos : null,
    urgente: Boolean(job.urgent)
  };
}

// ---- companies & workers ----

/** A company/worker we only know about by name so far (a job's author, an application's candidate). */
export function placeholderCompany(id: string, name: string, location = ''): Company {
  return { id, name, location, whatsapp: '', rating: 0, reviewCount: 0, verified: false, reviews: [] };
}
export function placeholderWorker(id: string, name: string): Worker {
  return {
    id,
    name,
    initials: initials(name),
    role: '',
    region: '',
    distance: '',
    rating: 0,
    jobsDone: 0,
    verified: false,
    specialties: [],
    facts: [],
    reviews: []
  };
}

/** The signed-in user's own full `profiles` row, when `tipo = 'construtora'`. */
export function companyFromOwnProfile(row: TableRow<'profiles'>, cnpj: string | null): Company {
  return {
    id: row.id,
    name: row.nome,
    cnpj: cnpj || undefined,
    tipoObra: row.tipo_obra || undefined,
    location: row.regiao_atuacao || '',
    whatsapp: row.whatsapp || '',
    rating: 0,
    reviewCount: 0,
    verified: false,
    reviews: []
  };
}
/** The signed-in user's own full `profiles` row, when `tipo = 'pedreiro'`. */
export function workerFromOwnProfile(row: TableRow<'profiles'>): Worker {
  return {
    id: row.id,
    name: row.nome,
    initials: initials(row.nome),
    role: row.cargo || '',
    region: row.regiao || '',
    distance: '',
    rating: 0,
    jobsDone: 0,
    verified: false,
    specialties: row.especialidades || [],
    facts: [],
    reviews: []
  };
}

type PerfilPublicoRow = RpcReturns<'perfil_publico'>[number];

/** Someone else's profile, fetched through `perfil_publico` (never exposes `whatsapp`). */
export function companyFromPerfilPublico(row: PerfilPublicoRow): Company {
  return {
    id: row.id,
    name: row.nome,
    cnpj: row.documento || undefined,
    tipoObra: row.tipo_obra || undefined,
    location: row.regiao_atuacao || '',
    whatsapp: '',
    rating: 0,
    reviewCount: 0,
    verified: false,
    reviews: []
  };
}
export function workerFromPerfilPublico(row: PerfilPublicoRow): Worker {
  return {
    id: row.id,
    name: row.nome,
    initials: initials(row.nome),
    role: row.cargo || '',
    region: row.regiao || '',
    distance: '',
    rating: 0,
    jobsDone: 0,
    verified: false,
    specialties: row.especialidades || [],
    facts: [],
    reviews: []
  };
}

// ---- applications ----

export function mapCandidaturaRow(row: TableRow<'candidaturas'>): Application {
  return { id: row.id, jobId: row.vaga_id, workerId: row.candidato_id, status: row.status as ApplicationStatus };
}

// ---- reviews ----

/** An `avaliacoes` row joined with the reviewer's name (`avaliador:avaliador_id(nome)`). */
export interface AvaliacaoRowWithAvaliador {
  nota: number;
  comentario: string | null;
  criado_em: string;
  avaliador: { nome: string } | null;
}

export interface ReviewSummary {
  reviews: Review[];
  rating: number;
  reviewCount: number;
  jobsDone: number;
}

export function reviewSummaryFromRows(rows: AvaliacaoRowWithAvaliador[]): ReviewSummary {
  const reviews: Review[] = rows.map((r) => ({
    author: r.avaliador?.nome || 'Bicos',
    company: r.avaliador?.nome || 'Bicos',
    value: r.nota,
    text: r.comentario || '',
    date: r.criado_em.slice(0, 10)
  }));
  const media = reviews.length ? reviews.reduce((s, r) => s + r.value, 0) / reviews.length : 0;
  return { reviews, rating: Math.round(media * 10) / 10, reviewCount: reviews.length, jobsDone: reviews.length };
}

// ---- worker portfolio posts ----

export function mapPublicacaoRow(row: TableRow<'publicacoes_trabalhador'>): WorkerPost {
  return {
    id: row.id,
    workerId: row.trabalhador_id,
    mediaUrl: row.midia_url,
    mediaType: row.midia_tipo === 'video' ? 'video' : 'image',
    caption: row.legenda || '',
    date: row.criado_em.slice(0, 10)
  };
}
