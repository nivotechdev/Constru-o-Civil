// Domain types for the Bicos marketplace. They mirror, field by field, the records the legacy
// app kept in its in-memory mock database (app/js/data/seed.js + app/js/store.js).

/** Which side of the marketplace an account is on. One account = one side (see docs/DECISOES.md). */
export type Role = 'trabalhador' | 'recrutador';

/**
 * A login. The password is not here: it belongs to the auth provider (Supabase Auth), never to the
 * app's tables. Dates are ISO strings; `null` means "not yet".
 */
export interface Account {
  id: string;
  email: string;
  role: Role;
  /** CPF (worker) or CNPJ (company), masked. */
  document: string;
  whatsapp: string;
  whatsappVerifiedAt: string | null;
  emailConfirmedAt: string | null;
  /** When "Completar perfil" was finished. */
  profileCompletedAt: string | null;
  /** The worker profile this account owns (role trabalhador). */
  workerId: string | null;
  /** The company this account belongs to (role recrutador). */
  companyId: string | null;
  createdAt: string;
}

/** Who is logged in, as the screens and route guards need it. */
export interface Session {
  accountId: string;
  email: string;
  role: Role;
  workerId: string | null;
  companyId: string | null;
  emailConfirmed: boolean;
  profileComplete: boolean;
}

/** A trade from the one catalog (services/catalog.ts): what a job asks for and what a worker does. */
export interface Oficio {
  /** Stable id, stored on jobs and workers ("pedreiro-acabamento"). */
  id: string;
  nome: string;
  /** Other words for the trade; the search finds it by any of them. */
  sinonimos: string[];
}

/** Days of the week a job can happen on (see utils/jobInfo.ts). */
export type DiasKey = 'semana' | 'fimdesemana' | 'qualquer';

export interface Review {
  /** Set on reviews a company received (written by a worker). */
  author?: string;
  /** Set on reviews a worker received (written by a company). */
  company?: string;
  value: number;
  text: string;
  date: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  tipoObra?: string;
  location: string;
  whatsapp: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  verifiedSince?: string;
  sinceLabel?: string;
  respondTime?: string;
  paidCount?: number;
  reviews: Review[];
}

export interface Worker {
  id: string;
  name: string;
  initials: string;
  /** Main trade (catalog id); '' until the profile is completed. */
  oficioId: string;
  /** Municipality the worker is based in ("São Paulo, SP"), from the city picker. */
  city: string;
  /** Neighbourhood, when known ("Tatuapé"). */
  neighborhood: string | null;
  /** Where distances to jobs are measured from (the neighbourhood, or the city centre). */
  lat: number;
  lon: number;
  rating: number;
  jobsDone: number;
  novo?: boolean;
  verified: boolean;
  specialties: string[];
  facts: string[];
  reviews: Review[];
}

/** A point on the map (WGS84 degrees). */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Where the job is. Before approval the worker sees only the neighbourhood and city (L19). */
export interface JobAddress extends GeoPoint {
  /** "03307-000" */
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  /** "SP" */
  uf: string;
}

export interface Job {
  id: string;
  companyId: string;
  /** The trade the job asks for (catalog id). */
  oficioId: string;
  /** Optional heading ("Pedreiro para reboco de fachada"); without it the trade's name is shown. */
  title: string | null;
  /** Fixed R$ per diária; `null` means "A combinar". */
  pay: number | null;
  address: JobAddress;
  /** Days are to be arranged with the worker: no start/end date. */
  dateToArrange: boolean;
  /** First and last day, ISO "YYYY-MM-DD" (local); `null` when the date is to be arranged. */
  startDate: string | null;
  endDate: string | null;
  /** "07:00"–"17:00"; both `null` means "Horário a combinar". */
  startTime: string | null;
  endTime: string | null;
  /** How many diárias (work days) the job has. */
  diarias: number;
  dias?: DiasKey | null;
  urgent?: boolean;
  boosted?: boolean;
  photos?: string[];
  /** Headcount; defaults to 1. */
  slots?: number;
  closed?: boolean;
  semContratacao?: boolean;
  description: string;
  requirements: string[];
}

/**
 * One worker's candidacy on one job. Worker-facing funnel:
 * enviada -> em_analise -> pre_selecionado -> contratado -> concluida (needs review) | avaliada.
 * nao_selecionado is a terminal rejection at any point.
 */
export type ApplicationStatus =
  'enviada' | 'em_analise' | 'pre_selecionado' | 'contratado' | 'concluida' | 'avaliada' | 'nao_selecionado';

export interface Application {
  id: string;
  jobId: string;
  workerId: string;
  status: ApplicationStatus;
}

/** Recruiter's decision on a candidate; `null` puts the candidate back "em análise". */
export type Decision = 'aprovado' | 'recusado' | null;

export interface WorkerPost {
  id: string;
  workerId: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  caption: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
}

/** What a notification is about; the screen picks its icon and colour from it. */
export type NotificationKind =
  | 'pre_selecionado'
  | 'bico_urgente'
  | 'avaliar_diaria'
  | 'candidatura_em_analise'
  | 'novos_candidatos'
  | 'bico_fechado'
  | 'avaliar_trabalhador';

export interface AppNotification {
  kind: NotificationKind;
  title: string;
  text: string;
  /** Relative time as shown ("Há 12 min", "Ontem"). */
  time: string;
  read: boolean;
}

export type BoostPlanId = '24h' | '3d' | 'whats';

/** A way to put a job at the top of the mural ("Impulsionar vaga"). */
export interface BoostPlan {
  id: BoostPlanId;
  label: string;
  desc: string;
  /** As shown ("R$ 12"). */
  price: string;
}

/** A Brazilian municipality in the city picker. */
export interface City extends GeoPoint {
  name: string;
  uf: string;
  /** "Name, UF" */
  label: string;
  /** Accent/case-free search key. */
  key: string;
}

/** Everything the mock backend stores. */
export interface Database {
  accounts: Record<string, Account>;
  companies: Record<string, Company>;
  workers: Record<string, Worker>;
  jobs: Record<string, Job>;
  applications: Application[];
  savedJobIds: string[];
  deletedJobIds: string[];
  workerPosts: WorkerPost[];
}
