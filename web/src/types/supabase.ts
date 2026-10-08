// The Supabase (Postgres) schema the app will use, typed in the shape supabase-js expects
// (`createClient<SupabaseDatabase>()` types every query). Each table's row is declared once below; what
// an insert/update accepts is derived from it (columns with a default or that accept null are optional
// on insert). docs/CONTRATO-BACKEND.md describes the tables and the rules around them; the back end
// writes the migrations from it (the SQL in supabase/ is the earlier draft — see docs/DECISOES.md).
//
// Tables map to the domain records in models.ts (see services/supabaseMappers.ts):
//   accounts      – Account (id = auth.users.id; e-mail confirmation, onboarding, worker or company)
//   oficios       – Oficio: the one catalog of trades (jobs.oficio_id, workers.oficio_id)
//   companies     – Company (reviews live in `reviews`)
//   workers       – Worker (reviews live in `reviews`)
//   jobs          – Job; deleted_at replaces Database.deletedJobIds
//   applications  – Application (status changed only by the status machine)
//   application_events – Application.events (history of each candidacy)
//   saved_jobs    – Database.savedJobIds (per worker)
//   reviews       – Company.reviews and Worker.reviews
//   worker_posts  – WorkerPost
//   notifications – AppNotification (for one worker or one company)
//   boost_payments – BoostPayment (PIX/cartão); only a confirmed one sets jobs.boost_ends_at
// The enums reuse the domain types, so the schema and the app can't drift apart silently.
import type {
  Actor,
  ApplicationStatus,
  ReviewDirection,
  BoostPlanId,
  DiasKey,
  NotificationKind,
  PaymentMethod,
  PaymentStatus,
  Role,
  WorkerPost
} from './models';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---- rows ----
// (Type aliases, not interfaces: supabase-js checks rows against Record<string, unknown>.)

type AccountRow = {
  id: string;
  email: string;
  role: Role;
  document: string;
  whatsapp: string;
  whatsapp_verified_at: string | null;
  email_confirmed_at: string | null;
  profile_completed_at: string | null;
  terms_version: string;
  terms_accepted_at: string;
  worker_id: string | null;
  company_id: string | null;
  created_at: string;
};

type OficioRow = {
  id: string;
  nome: string;
  sinonimos: string[];
};

type CompanyRow = {
  id: string;
  name: string;
  cnpj: string | null;
  tipo_obra: string | null;
  location: string;
  /** Private: readable only through the get_contact RPC. */
  whatsapp: string;
  rating: number;
  review_count: number;
  verified: boolean;
  verified_since: string | null;
  since_label: string | null;
  respond_time: string | null;
  paid_count: number | null;
  logo_url: string | null;
  cover_url: string | null;
  created_at: string;
};

type WorkerRow = {
  id: string;
  name: string;
  initials: string;
  oficio_id: string | null;
  /** Private: readable only through the get_contact RPC. */
  whatsapp: string;
  city: string;
  neighborhood: string | null;
  lat: number;
  lon: number;
  rating: number;
  review_count: number;
  jobs_done: number;
  novo: boolean;
  verified: boolean;
  specialties: string[];
  facts: string[];
  photo_url: string | null;
  created_at: string;
};

type JobRow = {
  id: string;
  company_id: string;
  oficio_id: string;
  title: string | null;
  pay: number | null;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  uf: string;
  lat: number;
  lon: number;
  date_to_arrange: boolean;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  diarias: number;
  dias: DiasKey | null;
  urgent: boolean;
  boost_ends_at: string | null;
  photos: string[] | null;
  slots: number;
  closed: boolean;
  sem_contratacao: boolean;
  description: string;
  requirements: string[];
  created_at: string;
  deleted_at: string | null;
};

type ApplicationRow = {
  id: string;
  job_id: string;
  worker_id: string;
  status: ApplicationStatus;
  created_at: string;
  status_changed_at: string;
  auto_rejected: boolean;
  worker_reviewed: boolean;
  company_reviewed: boolean;
};

type ApplicationEventRow = {
  id: number;
  application_id: string;
  status: ApplicationStatus;
  at: string;
  by: Actor;
  reason: string | null;
};

type SavedJobRow = {
  worker_id: string;
  job_id: string;
  saved_at: string;
};

type ReviewRow = {
  id: string;
  application_id: string | null;
  direction: ReviewDirection;
  company_id: string | null;
  worker_id: string | null;
  author_label: string;
  value: number;
  tags: string[];
  comment: string;
  created_at: string;
};

type WorkerPostRow = {
  id: string;
  worker_id: string;
  media_url: string | null;
  media_type: WorkerPost['mediaType'];
  caption: string;
  posted_on: string;
  created_at: string;
};

type NotificationRow = {
  id: string;
  worker_id: string | null;
  company_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  target: string | null;
  created_at: string;
  read_at: string | null;
};

type BoostPaymentRow = {
  id: string;
  job_id: string;
  company_id: string;
  plan: BoostPlanId;
  method: PaymentMethod;
  amount_cents: number;
  status: PaymentStatus;
  pix_code: string | null;
  card_last4: string | null;
  created_at: string;
  expires_at: string | null;
  confirmed_at: string | null;
  boost_ends_at: string | null;
};

// ---- table shapes supabase-js expects ----

/** Columns that accept null (optional on insert). */
type NullableKeys<R> = { [K in keyof R]: null extends R[K] ? K : never }[keyof R];

interface Relationship {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}

/** A table: `Defaulted` are the columns the database fills in when an insert leaves them out. */
interface Table<R, Defaulted extends keyof R = never> {
  Row: R;
  Insert: Omit<R, Defaulted | NullableKeys<R>> & Partial<Pick<R, Defaulted | NullableKeys<R>>>;
  Update: Partial<R>;
  Relationships: Relationship[];
}

const fk = (table: string, column: string, to: string, isOneToOne = false): Relationship => ({
  foreignKeyName: `${table}_${column}_fkey`,
  columns: [column],
  isOneToOne,
  referencedRelation: to,
  referencedColumns: ['id']
});
/** The foreign keys, for documentation and for the tests (supabase-js only needs their type). */
export const RELATIONSHIPS = {
  accounts: [fk('accounts', 'worker_id', 'workers', true), fk('accounts', 'company_id', 'companies')],
  workers: [fk('workers', 'oficio_id', 'oficios')],
  jobs: [fk('jobs', 'company_id', 'companies'), fk('jobs', 'oficio_id', 'oficios')],
  applications: [fk('applications', 'job_id', 'jobs'), fk('applications', 'worker_id', 'workers')],
  saved_jobs: [fk('saved_jobs', 'worker_id', 'workers'), fk('saved_jobs', 'job_id', 'jobs')],
  reviews: [
    fk('reviews', 'company_id', 'companies'),
    fk('reviews', 'worker_id', 'workers'),
    fk('reviews', 'job_id', 'jobs')
  ],
  worker_posts: [fk('worker_posts', 'worker_id', 'workers')],
  application_events: [fk('application_events', 'application_id', 'applications')],
  notifications: [fk('notifications', 'worker_id', 'workers'), fk('notifications', 'company_id', 'companies')],
  boost_payments: [fk('boost_payments', 'job_id', 'jobs'), fk('boost_payments', 'company_id', 'companies')]
};

export interface SupabaseDatabase {
  public: {
    Tables: {
      accounts: Table<AccountRow, 'created_at'>;
      oficios: Table<OficioRow, 'sinonimos'>;
      companies: Table<CompanyRow, 'id' | 'rating' | 'review_count' | 'verified' | 'created_at'>;
      workers: Table<
        WorkerRow,
        'id' | 'rating' | 'review_count' | 'jobs_done' | 'novo' | 'verified' | 'specialties' | 'facts' | 'created_at'
      >;
      jobs: Table<
        JobRow,
        | 'id'
        | 'date_to_arrange'
        | 'diarias'
        | 'urgent'
        | 'slots'
        | 'closed'
        | 'sem_contratacao'
        | 'requirements'
        | 'created_at'
      >;
      applications: Table<
        ApplicationRow,
        'id' | 'status' | 'created_at' | 'status_changed_at' | 'auto_rejected' | 'worker_reviewed' | 'company_reviewed'
      >;
      application_events: Table<ApplicationEventRow, 'id'>;
      saved_jobs: Table<SavedJobRow, 'saved_at'>;
      reviews: Table<ReviewRow, 'id' | 'tags' | 'comment' | 'created_at'>;
      worker_posts: Table<WorkerPostRow, 'id' | 'media_type' | 'caption' | 'created_at'>;
      notifications: Table<NotificationRow, 'id' | 'created_at'>;
      boost_payments: Table<BoostPaymentRow, 'id' | 'status' | 'created_at'>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      app_role: Role;
      dias_semana: DiasKey;
      application_status: ApplicationStatus;
      application_actor: Actor;
      media_type: WorkerPost['mediaType'];
      review_direction: ReviewDirection;
      notification_kind: NotificationKind;
      boost_plan: BoostPlanId;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

type PublicSchema = SupabaseDatabase['public'];

/** A table's row as a query returns it. */
export type TableRow<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
/** What an insert accepts (defaults and nullable columns may be left out). */
export type TableInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
/** What an update accepts (any subset of columns). */
export type TableUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type DbEnum<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
