-- Bicos v2 — tabelas do front-end novo (web/), no mesmo projeto Supabase do app antigo.
--
-- As tabelas seguem src/types/supabase.ts e docs/CONTRATO-BACKEND.md. Elas ficam ao lado das tabelas
-- do app antigo (profiles, vagas, candidaturas, avaliacoes, vagas_salvas, consentimentos,
-- publicacoes_trabalhador), que continuam como estão: esta migration só acrescenta. As duas versões
-- dividem o mesmo Auth (auth.users), o mesmo segredo do CPF/CNPJ no Vault e os buckets do Storage.
--
-- Regras de acesso:
--   * nenhuma tabela é aberta para `anon`, exceto o catálogo de ofícios;
--   * o WhatsApp de trabalhador e construtora não é legível por select (privilégio por coluna) — só
--     sai pela RPC get_contact, e só para quem está no bico (docs/CONTRATO-BACKEND.md › contacts.ts);
--   * status de candidatura, vagas, avaliações e pagamentos só mudam por RPC (security definer), que
--     aplica as mesmas regras do front (services/applicationMachine.ts) numa transação só.

-- ---------------------------------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------------------------------

create type public.app_role as enum ('trabalhador', 'recrutador');
create type public.dias_semana as enum ('semana', 'fimdesemana', 'qualquer');
create type public.application_status as enum (
  'enviada', 'em_analise', 'pre_selecionado', 'contratado', 'concluida',
  'nao_selecionado', 'desistiu', 'cancelado_pela_construtora', 'nao_compareceu'
);
create type public.application_actor as enum ('trabalhador', 'construtora', 'sistema');
create type public.media_type as enum ('image', 'video');
create type public.review_direction as enum ('para_construtora', 'para_trabalhador');
create type public.notification_kind as enum (
  'novos_candidatos', 'candidatura_em_analise', 'pre_selecionado', 'nao_selecionado', 'contratado',
  'desistencia', 'contratacao_cancelada', 'nao_compareceu', 'avaliar_diaria', 'avaliar_trabalhador',
  'vaga_editada', 'impulsionamento', 'bico_urgente', 'bico_fechado'
);
create type public.boost_plan as enum ('24h', '3d', 'whats');
create type public.payment_method as enum ('pix', 'cartao');
create type public.payment_status as enum ('aguardando', 'confirmado', 'recusado', 'expirado');

-- ---------------------------------------------------------------------------------------------------
-- Catálogo de ofícios (o mesmo de src/data/oficios.ts)
-- ---------------------------------------------------------------------------------------------------

create table public.oficios (
  id text primary key,
  nome text not null,
  sinonimos text[] not null default '{}'
);
comment on table public.oficios is 'Catálogo único de ofícios (vaga e perfil do trabalhador). Espelha src/data/oficios.ts.';

-- ---------------------------------------------------------------------------------------------------
-- Perfis: trabalhador e construtora. O id é o da conta (auth.users.id) — uma conta é de um lado só.
-- Não há chave estrangeira para auth.users de propósito: ao excluir a conta, o perfil fica anonimizado
-- para o histórico do outro lado (candidaturas, avaliações) continuar íntegro.
-- ---------------------------------------------------------------------------------------------------

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 150),
  initials text not null default '?',
  oficio_id text references public.oficios (id),
  whatsapp text not null default '',
  city text not null,
  neighborhood text,
  lat double precision not null,
  lon double precision not null,
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  jobs_done integer not null default 0 check (jobs_done >= 0),
  novo boolean not null default true,
  verified boolean not null default false,
  specialties text[] not null default '{}',
  facts text[] not null default '{}',
  photo_url text,
  cover_url text,
  created_at timestamptz not null default now()
);
comment on column public.workers.whatsapp is 'Privado: não é legível por select; só sai pela RPC get_contact.';

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 150),
  cnpj text,
  tipo_obra text,
  location text not null,
  whatsapp text not null default '',
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  review_count integer not null default 0 check (review_count >= 0),
  verified boolean not null default false,
  verified_since text,
  since_label text,
  respond_time text,
  paid_count integer,
  logo_url text,
  cover_url text,
  created_at timestamptz not null default now()
);
comment on column public.companies.whatsapp is 'Privado: não é legível por select; só sai pela RPC get_contact.';

-- ---------------------------------------------------------------------------------------------------
-- Contas (1:1 com auth.users). O CPF/CNPJ fica cifrado com a mesma chave do app antigo (Vault
-- `nivotech_documento_key`); `document` guarda só a versão mascarada, para exibir.
-- ---------------------------------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role public.app_role not null,
  document text not null default '',
  document_hash text unique,
  document_cipher bytea,
  whatsapp text not null default '',
  whatsapp_verified_at timestamptz,
  email_confirmed_at timestamptz,
  profile_completed_at timestamptz,
  terms_version text not null default '1.0',
  terms_accepted_at timestamptz not null default now(),
  worker_id uuid unique references public.workers (id),
  company_id uuid references public.companies (id),
  created_at timestamptz not null default now(),
  check ((role = 'trabalhador' and worker_id is not null and company_id is null)
      or (role = 'recrutador' and company_id is not null and worker_id is null))
);
comment on column public.accounts.document is 'CPF/CNPJ mascarado (exibição). O número fica só em document_cipher.';

-- ---------------------------------------------------------------------------------------------------
-- Vagas. O id é curto e legível ("BC-5001"): aparece no link e na mensagem pronta do WhatsApp.
-- ---------------------------------------------------------------------------------------------------

create sequence public.jobs_code_seq start 5001;

create table public.jobs (
  id text primary key default ('BC-' || nextval('public.jobs_code_seq')),
  company_id uuid not null references public.companies (id),
  oficio_id text not null references public.oficios (id),
  title text check (title is null or char_length(title) <= 120),
  pay numeric(10, 2) check (pay is null or (pay >= 80 and pay <= 100000)),
  cep text not null check (cep ~ '^\d{5}-\d{3}$'),
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  lat double precision not null,
  lon double precision not null,
  date_to_arrange boolean not null default false,
  start_date date,
  end_date date,
  start_time text check (start_time is null or start_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  end_time text check (end_time is null or end_time ~ '^([01]\d|2[0-3]):[0-5]\d$'),
  diarias integer not null default 1 check (diarias between 1 and 60),
  dias public.dias_semana,
  urgent boolean not null default false,
  boost_ends_at timestamptz,
  photos text[],
  slots integer not null default 1 check (slots between 1 and 50),
  closed boolean not null default false,
  sem_contratacao boolean not null default false,
  description text not null default '',
  requirements text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (date_to_arrange or (start_date is not null and end_date is not null and end_date >= start_date)),
  check ((start_time is null) = (end_time is null))
);
create index jobs_company_idx on public.jobs (company_id);
create index jobs_open_idx on public.jobs (closed, deleted_at);

-- ---------------------------------------------------------------------------------------------------
-- Candidaturas e o histórico de cada uma
-- ---------------------------------------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.jobs (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  status public.application_status not null default 'enviada',
  created_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  auto_rejected boolean not null default false,
  worker_reviewed boolean not null default false,
  company_reviewed boolean not null default false,
  unique (job_id, worker_id)
);
create index applications_worker_idx on public.applications (worker_id);

create table public.application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  status public.application_status not null,
  at timestamptz not null default now(),
  "by" public.application_actor not null,
  reason text
);
create index application_events_app_idx on public.application_events (application_id);

-- ---------------------------------------------------------------------------------------------------
-- Vagas salvas, avaliações, portfólio, notificações, pagamentos de impulsionamento
-- ---------------------------------------------------------------------------------------------------

create table public.saved_jobs (
  worker_id uuid not null references public.workers (id) on delete cascade,
  job_id text not null references public.jobs (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (worker_id, job_id)
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications (id) on delete set null,
  direction public.review_direction not null,
  company_id uuid references public.companies (id) on delete cascade,
  worker_id uuid references public.workers (id) on delete cascade,
  author_label text not null,
  value integer not null check (value between 1 and 5),
  tags text[] not null default '{}',
  comment text not null default '' check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  unique (application_id, direction),
  check ((direction = 'para_construtora' and company_id is not null)
      or (direction = 'para_trabalhador' and worker_id is not null))
);
create index reviews_company_idx on public.reviews (company_id);
create index reviews_worker_idx on public.reviews (worker_id);

create table public.worker_posts (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers (id) on delete cascade,
  media_url text,
  media_type public.media_type not null default 'image',
  caption text not null default '' check (char_length(caption) <= 500),
  posted_on date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  created_at timestamptz not null default now()
);
create index worker_posts_worker_idx on public.worker_posts (worker_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.workers (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text not null,
  target text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (num_nonnulls(worker_id, company_id) = 1)
);
create index notifications_worker_idx on public.notifications (worker_id, created_at desc);
create index notifications_company_idx on public.notifications (company_id, created_at desc);

create table public.boost_payments (
  id uuid primary key default gen_random_uuid(),
  job_id text not null references public.jobs (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  plan public.boost_plan not null,
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  status public.payment_status not null default 'aguardando',
  pix_code text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^\d{4}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  confirmed_at timestamptz,
  boost_ends_at timestamptz
);
create index boost_payments_company_idx on public.boost_payments (company_id);

-- ---------------------------------------------------------------------------------------------------
-- Privilégios. O Supabase dá tudo a anon/authenticated por padrão; aqui cada tabela recebe só o que
-- o app usa diretamente. O resto passa pelas RPCs (migration seguinte).
-- ---------------------------------------------------------------------------------------------------

revoke all on table
  public.oficios, public.workers, public.companies, public.accounts, public.jobs, public.applications,
  public.application_events, public.saved_jobs, public.reviews, public.worker_posts,
  public.notifications, public.boost_payments
from anon, authenticated;
revoke all on sequence public.jobs_code_seq from anon, authenticated;

grant select on public.oficios to anon, authenticated;

grant select (
  id, name, initials, oficio_id, city, neighborhood, lat, lon, rating, review_count, jobs_done, novo,
  verified, specialties, facts, photo_url, cover_url, created_at
) on public.workers to authenticated;
grant update (name, oficio_id, city, neighborhood, lat, lon, specialties, photo_url, cover_url)
  on public.workers to authenticated;

grant select (
  id, name, cnpj, tipo_obra, location, rating, review_count, verified, verified_since, since_label,
  respond_time, paid_count, logo_url, cover_url, created_at
) on public.companies to authenticated;
grant update (name, tipo_obra, location, whatsapp, logo_url, cover_url) on public.companies to authenticated;

grant select (
  id, email, role, document, whatsapp, whatsapp_verified_at, email_confirmed_at, profile_completed_at,
  terms_version, terms_accepted_at, worker_id, company_id, created_at
) on public.accounts to authenticated;

grant select on public.jobs, public.applications, public.application_events, public.reviews,
  public.boost_payments to authenticated;
grant select, insert, delete on public.saved_jobs to authenticated;
grant select, delete on public.worker_posts to authenticated;
grant insert (worker_id, media_url, media_type, caption) on public.worker_posts to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------------

alter table public.oficios enable row level security;
alter table public.workers enable row level security;
alter table public.companies enable row level security;
alter table public.accounts enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.reviews enable row level security;
alter table public.worker_posts enable row level security;
alter table public.notifications enable row level security;
alter table public.boost_payments enable row level security;
