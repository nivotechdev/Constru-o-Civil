// Domain types for the Bicos marketplace. They mirror, field by field, the records the legacy
// app kept in its in-memory mock database (app/js/data/seed.js + app/js/store.js).

/** Which side of the marketplace is "logged in" (demo account switch). */
export type Role = 'trabalhador' | 'recrutador';

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
  role: string;
  region: string;
  distance: string;
  rating: number;
  jobsDone: number;
  novo?: boolean;
  verified: boolean;
  specialties: string[];
  facts: string[];
  reviews: Review[];
}

export interface Job {
  id: string;
  companyId: string;
  role: string;
  /** Fixed R$ per diária; `null` means "A combinar". */
  pay: number | null;
  location: string;
  address: string;
  distance: string;
  /** Free text ("Hoje", "Amanhã", "12 set"); `null` means "Data a combinar". */
  date: string | null;
  /** "7h–17h"; `null` means "Horário a combinar". */
  hours: string | null;
  duration: string;
  dias?: DiasKey | null;
  urgent?: boolean;
  boosted?: boolean;
  photos?: string[];
  /** Headcount; defaults to 1. */
  slots?: number;
  closed?: boolean;
  semContratacao?: boolean;
  /** City the job is in; defaults to "São Paulo, SP". */
  city?: string;
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
export interface City {
  name: string;
  uf: string;
  lat: number;
  lon: number;
  /** "Name, UF" */
  label: string;
  /** Accent/case-free search key. */
  key: string;
}

/** Everything the mock backend stores. */
export interface Database {
  companies: Record<string, Company>;
  workers: Record<string, Worker>;
  jobs: Record<string, Job>;
  applications: Application[];
  savedJobIds: string[];
  deletedJobIds: string[];
  workerPosts: WorkerPost[];
}
