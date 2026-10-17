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
  /** Version of the terms of use and privacy policy accepted at sign-up, and when (B11). */
  termsVersion: string;
  termsAcceptedAt: string;
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
  /** L07: accepted the current version of the terms and the privacy policy (services/legal.ts). */
  termsCurrent: boolean;
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

/** Which side a review is about (who wrote it is the other side). */
export type ReviewDirection = 'para_construtora' | 'para_trabalhador';

/** One side's review of the other after a concluded diária (B03/B04). */
export interface Review {
  id: string;
  /** The candidacy it reviews (`null` on reviews imported from before the app tracked them). */
  applicationId: string | null;
  direction: ReviewDirection;
  /** Who wrote it, as shown ("Construtora Meridiano", "Jorge M. · pedreiro"). */
  authorLabel: string;
  /** 1 to 5. */
  value: number;
  /** Ready-made points ("Pagou no dia", "Chegou no horário"…). */
  tags: string[];
  /** Up to 300 characters; may be empty. */
  comment: string;
  /** ISO timestamp. */
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  tipoObra?: string;
  location: string;
  /** Contact number. Private like the worker's: only contacts.getContact() hands it out (B01). */
  whatsapp: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  verifiedSince?: string;
  /** F15: who talks to the candidates ("Fale com Ana"). */
  contactName?: string;
  /** Y24: where the company's check stands (absent on old demo data: read from `verified`). */
  verification?: CompanyVerification;
  /** When it was verified (ISO). */
  verifiedAt?: string;
  sinceLabel?: string;
  respondTime?: string;
  paidCount?: number;
  /** Logo and cover picture, in the app's Storage (Z12); absent = none chosen. */
  logoUrl?: string | null;
  coverUrl?: string | null;
  reviews: Review[];
}

export interface Worker {
  id: string;
  name: string;
  initials: string;
  /** Main trade (catalog id); '' until the profile is completed. */
  oficioId: string;
  /**
   * Contact number. Private: screens never read it from here; it is handed out only by
   * contacts.getContact() to the company that picked or hired the worker (B01).
   */
  whatsapp: string;
  /** Municipality the worker is based in ("São Paulo, SP"), from the city picker. */
  city: string;
  /** Neighbourhood, when known ("Tatuapé"). */
  neighborhood: string | null;
  /** Where distances to jobs are measured from (the neighbourhood, or the city centre). */
  lat: number;
  lon: number;
  rating: number;
  /** How many reviews `rating` averages. */
  reviewCount: number;
  jobsDone: number;
  novo?: boolean;
  verified: boolean;
  specialties: string[];
  /** Old hand-written facts: no longer shown (F10 builds them from the fields below). */
  facts: string[];
  /** F07: where the identity check stands (the "Verificado" badge means "verificado"). */
  identity?: IdentityStatus;
  /** F07: why it was refused (only the worker's own). */
  identityReason?: string;
  /** F10: the professional profile. */
  availability?: WorkerAvailability;
  yearsExperience?: number;
  /** The diária the worker asks for (R$). */
  desiredPay?: number;
  /** How far the worker goes (km). */
  travelKm?: number;
  bio?: string;
  /** Profile photo and cover picture, in the app's Storage (Z12); absent = none chosen. */
  photoUrl?: string | null;
  coverUrl?: string | null;
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
  /**
   * `false`: only the area is known — street, number, complement and CEP are empty and the point is the
   * neighbourhood's, rounded (real mode, for anyone but the company and the picked/hired worker; Z06).
   */
  exact?: boolean;
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
  /** Marked urgent by the company when publishing (free). */
  urgent?: boolean;
  /** Paid boost: at the top of the mural until then (ISO); `null`/absent = not boosted (B08). */
  boostEndsAt?: string | null;
  photos?: string[];
  /** Headcount; defaults to 1. */
  slots?: number;
  closed?: boolean;
  semContratacao?: boolean;
  description: string;
  requirements: string[];
  /** L18: how the diária is paid (absent on jobs from before: "combined directly"). */
  payment?: WagePayment;
  /** Only with `payment: 'outro'`: how, in the company's words. */
  paymentNote?: string;
  /** When it was published (ISO); a job with the date to be arranged expires 30 days later (Y04). */
  createdAt?: string;
  /** L10: the random code of the public link (/v/<slug>); the id (BC-n) is sequential, so it isn't used there. */
  publicSlug?: string;
}

/**
 * Where a worker's candidacy on a job stands. Only the status machine in services/applications.ts
 * changes it (see docs/CONTRATO-BACKEND.md for the table of transitions and who may run each one).
 * A candidacy the worker withdraws while pending is deleted, so it has no status of its own.
 */
export type ApplicationStatus =
  | 'enviada'
  | 'em_analise'
  | 'pre_selecionado'
  | 'contratado'
  | 'concluida'
  | 'nao_selecionado'
  | 'desistiu'
  | 'cancelado_pela_construtora'
  | 'nao_compareceu'
  /** Picked, but the job's time ran out without the hire being confirmed (Y04). */
  | 'expirada'
  /** R03: picked or hired, cancelled by the system because the team suspended one of the two accounts. */
  | 'cancelado_pela_equipe';

/** Who made a change: the worker, the company, or the system (automatic rules). */
export type Actor = 'trabalhador' | 'construtora' | 'sistema';

/** One step in a candidacy's history. */
export interface ApplicationEvent {
  status: ApplicationStatus;
  /** ISO timestamp. */
  at: string;
  by: Actor;
  /** Why (desistência, cancelamento, recusa automática…), when there is a reason. */
  reason: string | null;
}

export interface Application {
  id: string;
  jobId: string;
  workerId: string;
  status: ApplicationStatus;
  /** ISO timestamps. */
  createdAt: string;
  statusChangedAt: string;
  /** Oldest first; the last one is the current status. */
  events: ApplicationEvent[];
  /** Turned down automatically because the last slot was filled (undone if that approval is undone). */
  autoRejected: boolean;
  /** Each side reviews the other once the diária is concluded. */
  workerReviewed: boolean;
  companyReviewed: boolean;
  /** F12: when the hired worker confirmed they'll go (reset when the job's dates change). */
  presenceConfirmedAt?: string | null;
}

export interface WorkerPost {
  id: string;
  workerId: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  caption: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
}

/** F06: groups of notices, and the account's choices. */
export type NotificationGroup = 'candidaturas' | 'lembretes' | 'bicos_novos' | 'conta';
export interface NotificationPrefs {
  /** Muted in the bell (only "bicos_novos" can be). */
  muted: NotificationGroup[];
  /** Sent by push (X03). */
  push: NotificationGroup[];
}

/** F04: what can be reported, and why. */
export type ReportTarget = 'vaga' | 'perfil' | 'avaliacao' | 'post';
export type ReportReason = 'golpe' | 'ofensa' | 'falso' | 'perigoso' | 'spam' | 'outro';

/** F13: a company invited a worker to an open job. */
export interface JobInvite {
  jobId: string;
  workerId: string;
  companyId: string;
  status: 'pendente' | 'aceito' | 'recusado';
  createdAt: string;
}

/** F07 */
export type IdentityStatus = 'nao_enviado' | 'em_analise' | 'verificado' | 'recusado';

/** F10: the days a worker takes jobs. */
export type WorkerAvailability = 'semana' | 'fimdesemana' | 'qualquer';

/** L18: how the company pays the diária. */
export type WagePayment = 'pix_dia' | 'pix_fim' | 'dinheiro' | 'outro';

/** The Bicos team's check of a company (Y24). Every company starts "pendente". */
export type CompanyVerification = 'pendente' | 'verificada' | 'reprovada';

/** What a notification is about; the screen picks its icon and colour from it. */
export type NotificationKind =
  | 'novos_candidatos'
  | 'candidatura_em_analise'
  | 'pre_selecionado'
  | 'nao_selecionado'
  | 'contratado'
  | 'desistencia'
  | 'contratacao_cancelada'
  | 'nao_compareceu'
  | 'avaliar_diaria'
  | 'avaliar_trabalhador'
  | 'vaga_editada'
  | 'impulsionamento'
  | 'bico_urgente'
  | 'bico_fechado'
  | 'verificacao'
  | 'bico_novo'
  | 'confirmar_presenca'
  | 'convite';

/** A notice for one worker or one company (exactly one of `workerId`/`companyId` is set). */
export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  text: string;
  workerId: string | null;
  companyId: string | null;
  /** The screen it opens ("/selecionado/BC-4821"); `null` opens the list. */
  target: string | null;
  /** ISO timestamps. */
  createdAt: string;
  readAt: string | null;
}

export type BoostPlanId = '24h' | '3d' | 'whats';

/** A way to put a job at the top of the mural ("Impulsionar vaga"). */
export interface BoostPlan {
  id: BoostPlanId;
  label: string;
  desc: string;
  /** As shown ("R$ 12"). */
  price: string;
  priceCents: number;
  /** How long the job stays at the top. */
  hours: number;
}

export type PaymentMethod = 'pix' | 'cartao';
/**
 * aguardando → confirmado (paid: the job is boosted) · recusado (card declined) · expirado (PIX not paid
 * in time) · cancelado (a new PIX code replaced it) · reembolso_pendente (paid, but the job could no
 * longer be boosted: the money goes back).
 */
export type PaymentStatus = 'aguardando' | 'confirmado' | 'recusado' | 'expirado' | 'cancelado' | 'reembolso_pendente';

/** One payment for a boost. Only a confirmed one puts the job at the top (B08). */
export interface BoostPayment {
  id: string;
  jobId: string;
  companyId: string;
  plan: BoostPlanId;
  method: PaymentMethod;
  amountCents: number;
  status: PaymentStatus;
  /** PIX "copia e cola" (fictitious in the demo). */
  pixCode: string | null;
  /** The PIX QR code as a PNG in base64, from the payment provider (real mode only). */
  pixQrBase64?: string | null;
  /** Last 4 digits of the card used. */
  cardLast4: string | null;
  /** ISO timestamps. */
  createdAt: string;
  /** A PIX code is valid until then. */
  expiresAt: string | null;
  confirmedAt: string | null;
  /** When the boost bought by this payment ends. */
  boostEndsAt: string | null;
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
  notifications: AppNotification[];
  boostPayments: BoostPayment[];
  /**
   * With the real backend, a worker can't read other people's candidacies: how many candidates each
   * job has comes from here instead (services/selectors.ts uses it for jobs that aren't the session's).
   */
  jobStats?: Record<string, JobStats>;
  /** F06: what each account muted in the bell and wants by push (per worker/company id). */
  notificationPrefs?: Record<string, NotificationPrefs>;
  /** F04: the accounts the session blocked (hidden from the mural and the search). */
  blockedIds?: string[];
  /** F13: invitations from companies to workers (each side loads its own). */
  invites?: JobInvite[];
  /** F10: no-shows and give-ups per worker (the companies see them). */
  workerTrack?: Record<string, { faltas: number; desistencias: number }>;
  /** Y28: "Avisar quando aparecer bico novo", per worker (the real backend loads only the session's). */
  jobAlerts?: Record<string, JobAlert>;
  /** X03: the session's unread notices as the server counts them (more than the 100 loaded). */
  unreadTotal?: number;
}

/** A worker's alert for new jobs (Y28): a city — or a radius around a point — and an optional trade. */
export interface JobAlert {
  workerId: string;
  /** "Name, UF". */
  city: string;
  lat: number;
  lon: number;
  /** null = the whole city. */
  radiusKm: number | null;
  oficioId: string | null;
}

/** A job's candidates, counted (who they are stays private). */
export interface JobStats {
  /** Picked or hired (holding a slot). */
  holding: number;
  /** Waiting for the company's decision. */
  pending: number;
  total: number;
}
