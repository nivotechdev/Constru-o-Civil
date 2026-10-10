-- X15: políticas RLS sem chamada de função por linha, índices das chaves estrangeiras e limite contra spam
-- de candidatar/retirar. Também zera os avisos de desempenho das tabelas do app antigo.
-- Idempotente.

-- 1. Candidaturas: a construtora vê as das próprias vagas por um conjunto calculado uma vez por consulta
--    (`job_id in (select my_job_ids())`), não mais `is_my_job(job_id)` linha a linha. A função é security
--    definer para não reaplicar a política de `jobs` (que olha `applications`: seria recursão).
create or replace function public.my_job_ids()
returns setof text language sql stable security definer set search_path = public as $$
  select id from public.jobs where company_id = public.my_company_id()
$$;
revoke all on function public.my_job_ids() from public, anon, authenticated;
grant execute on function public.my_job_ids() to authenticated;

drop policy if exists "Candidatura visível para o trabalhador e para a construtora da vaga" on public.applications;
create policy "Candidatura visível para o trabalhador e para a construtora da vaga" on public.applications
  for select to authenticated
  using (
    worker_id = (select public.my_worker_id())
    or job_id in (select public.my_job_ids())
  );

-- O histórico segue a candidatura pelo mesmo critério, sem reaplicar a política da candidatura por linha.
drop policy if exists "Histórico segue a candidatura" on public.application_events;
create policy "Histórico segue a candidatura" on public.application_events
  for select to authenticated
  using (
    application_id in (
      select a.id from public.applications a
       where a.worker_id = (select public.my_worker_id())
          or a.job_id in (select public.my_job_ids())
    )
  );

-- 2. Índices das chaves estrangeiras (avisos "unindexed_foreign_keys").
create index if not exists accounts_company_idx on public.accounts (company_id);
create index if not exists boost_payments_job_idx on public.boost_payments (job_id);
create index if not exists jobs_oficio_idx on public.jobs (oficio_id);
create index if not exists saved_jobs_job_idx on public.saved_jobs (job_id);
create index if not exists workers_oficio_idx on public.workers (oficio_id);
create index if not exists application_events_app_at_idx on public.application_events (application_id, at);

-- 3. App antigo (desligado no Z08; as tabelas já não têm grant para anon/authenticated, então as políticas
--    nunca rodavam): as políticas saem — sem política, a RLS recusa tudo, que é o que já valia. O app novo
--    lê o que precisa dessas tabelas por funções do próprio banco.
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles', 'vagas', 'candidaturas', 'avaliacoes', 'vagas_salvas',
                         'publicacoes_trabalhador', 'consentimentos')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
do $$
begin
  if to_regclass('public.avaliacoes') is not null then
    create index if not exists avaliacoes_avaliador_idx on public.avaliacoes (avaliador_id);
  end if;
  if to_regclass('public.consentimentos') is not null then
    create index if not exists consentimentos_usuario_idx on public.consentimentos (usuario_id);
  end if;
  if to_regclass('public.vagas_salvas') is not null then
    create index if not exists vagas_salvas_vaga_idx on public.vagas_salvas (vaga_id);
  end if;
end $$;

-- 4. Limite contra spam: cada candidatura enviada fica registrada (inclusive as retiradas depois). Até 30
--    por dia por trabalhador e até 3 vezes a mesma vaga por dia (candidatar → retirar → candidatar avisa a
--    construtora a cada vez).
create table if not exists public.application_attempts (
  worker_id uuid not null references public.workers (id) on delete cascade,
  job_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists application_attempts_worker_idx on public.application_attempts (worker_id, created_at);
alter table public.application_attempts enable row level security;
revoke all on public.application_attempts from anon, authenticated;

create or replace function public.limit_application_spam()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.application_attempts
       where worker_id = new.worker_id and created_at > now() - interval '1 day') >= 30 then
    raise exception using errcode = 'BC409',
      message = 'Você já se candidatou a muitas vagas hoje. Tente de novo amanhã.';
  end if;
  if (select count(*) from public.application_attempts
       where worker_id = new.worker_id and job_id = new.job_id and created_at > now() - interval '1 day') >= 3 then
    raise exception using errcode = 'BC409',
      message = 'Você já se candidatou e retirou essa vaga várias vezes hoje. Tente de novo amanhã.';
  end if;
  insert into public.application_attempts (worker_id, job_id) values (new.worker_id, new.job_id);
  return new;
end;
$$;
revoke all on function public.limit_application_spam() from public, anon, authenticated;

drop trigger if exists limit_application_spam on public.applications;
create trigger limit_application_spam before insert on public.applications
  for each row execute function public.limit_application_spam();

-- Registro com mais de 2 dias não serve para nada: limpeza diária.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-limpar-tentativas';
    perform cron.schedule('bicos-limpar-tentativas', '17 4 * * *',
      $c$delete from public.application_attempts where created_at < now() - interval '2 days'$c$);
  end if;
end $$;
