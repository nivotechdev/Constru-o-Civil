-- L12 (lançamento): as rotinas do pg_cron (concluir diárias, vencer PIX, lembretes, limpezas) falhavam em
-- silêncio — o erro só ficava em cron.job_run_details, que ninguém olha. Agora:
--   * cron_health(): o estado de cada rotina (última execução, resultado, falhas seguidas), para o SQL Editor;
--   * check_cron_failures(), de hora em hora (`bicos-vigiar-cron`): rotina com 2 falhas seguidas vira um alerta
--     em `cron_alerts` e um evento no Sentry (DSN no Vault: `bicos_sentry_dsn`; o Sentry manda o e-mail pela
--     regra de alerta do projeto). No máximo um alerta por rotina a cada 24 h enquanto ela continuar falhando;
--   * a mensagem de erro vai sem dado pessoal (e-mails e sequências longas de dígitos — CPF, CNPJ, telefone —
--     trocados por marcadores) e cortada em 300 caracteres;
--   * o histórico do pg_cron (cron.job_run_details) passa a guardar só 14 dias.
--   * sinal de vida: a cada execução o vigia chama a URL do Vault `bicos_heartbeat_url` (um monitor de fora, como
--     o healthchecks.io), que manda e-mail quando o sinal para — cobre o pg_cron parado e o projeto pausado
--     (plano Free), que o próprio banco não consegue avisar.
-- Idempotente.

create table if not exists public.cron_alerts (
  id bigint generated always as identity primary key,
  jobname text not null,
  runid bigint not null,
  message text not null,
  sent boolean not null default false,
  alerted_at timestamptz not null default now()
);
create index if not exists cron_alerts_job_at_idx on public.cron_alerts (jobname, alerted_at desc);
alter table public.cron_alerts enable row level security;
revoke all on table public.cron_alerts from anon, authenticated;

-- Tira dado pessoal de um texto de erro antes de ele sair do banco.
create or replace function public.scrub_error_text(p_text text)
returns text language sql immutable set search_path = public as $$
  select left(
    regexp_replace(
      regexp_replace(coalesce(p_text, ''), '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '[email]', 'g'),
      '\d[\d .()/-]{6,}\d', '[número]', 'g'),
    300)
$$;
revoke all on function public.scrub_error_text(text) from public, anon, authenticated;

-- O estado de cada rotina (só a equipe, pelo SQL Editor): select * from public.cron_health();
create or replace function public.cron_health()
returns table (jobname text, schedule text, active boolean, last_run timestamptz, last_status text,
               failures_in_a_row integer, last_error text)
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('cron.job_run_details') is null then
    return;
  end if;
  return query execute $q$
    select j.jobname::text, j.schedule::text, j.active, last.end_time, last.status::text,
           coalesce((select count(*)::int
                       from cron.job_run_details f
                      where f.jobid = j.jobid and f.status = 'failed'
                        and f.runid > coalesce((select max(s.runid) from cron.job_run_details s
                                                 where s.jobid = j.jobid and s.status = 'succeeded'), 0)), 0),
           public.scrub_error_text(case when last.status = 'failed' then last.return_message end)
      from cron.job j
      left join lateral (select d.end_time, d.status, d.return_message
                           from cron.job_run_details d
                          where d.jobid = j.jobid and d.status in ('succeeded', 'failed')
                          order by d.runid desc limit 1) last on true
     where j.jobname like 'bicos-%'
     order by j.jobname
  $q$;
end;
$$;
revoke all on function public.cron_health() from public, anon, authenticated;
grant execute on function public.cron_health() to service_role;

-- Um evento no Sentry pela API "store" (a mesma do app, sem SDK). Sem DSN no Vault ou sem pg_net: false.
create or replace function public.send_sentry_event(p_message text, p_tags jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_dsn text;
  v_parts text[];
begin
  if to_regnamespace('net') is null or to_regnamespace('vault') is null then
    return false;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_dsn using 'bicos_sentry_dsn';
  -- https://<chave>@<host>/<caminho/><projeto>
  v_parts := regexp_match(coalesce(v_dsn, ''), '^(https://)([^@/]+)@([^/]+)/(.*/)?([0-9]+)$');
  if v_parts is null then
    return false;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using v_parts[1] || v_parts[3] || '/' || coalesce(v_parts[4], '') || 'api/' || v_parts[5] || '/store/',
          jsonb_build_object(
            'event_id', replace(gen_random_uuid()::text, '-', ''),
            'timestamp', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'level', 'error', 'platform', 'other', 'logger', 'pg_cron', 'server_name', 'supabase-db',
            'message', public.scrub_error_text(p_message), 'tags', p_tags),
          jsonb_build_object('Content-Type', 'application/json',
            'X-Sentry-Auth', 'Sentry sentry_version=7, sentry_client=bicos-db/1.0, sentry_key=' || v_parts[2]);
  return true;
exception when others then
  return false;
end;
$$;
revoke all on function public.send_sentry_event(text, jsonb) from public, anon, authenticated;

-- De hora em hora: rotina com as 2 últimas execuções falhadas vira alerta (no máximo 1 a cada 24 h por rotina).
create or replace function public.check_cron_failures()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_message text;
begin
  if to_regclass('cron.job_run_details') is null then
    return 0;
  end if;
  for r in execute $q$
    select j.jobname::text as jobname, last2.runids[1] as runid, last2.messages[1] as message
      from cron.job j
      cross join lateral (
        select array_agg(d.runid order by d.runid desc) as runids,
               array_agg(d.status::text order by d.runid desc) as statuses,
               array_agg(d.return_message order by d.runid desc) as messages
          from (select runid, status, return_message from cron.job_run_details
                 where jobid = j.jobid and status in ('succeeded', 'failed')
                 order by runid desc limit 2) d
      ) last2
     where j.jobname like 'bicos-%' and last2.statuses = array['failed', 'failed']
  $q$ loop
    if exists (select 1 from public.cron_alerts a
                where a.jobname = r.jobname and a.alerted_at > now() - interval '24 hours') then
      continue;
    end if;
    v_message := 'Rotina ' || r.jobname || ' falhou 2 vezes seguidas: ' || public.scrub_error_text(r.message);
    insert into public.cron_alerts (jobname, runid, message, sent)
    values (r.jobname, r.runid, v_message,
            public.send_sentry_event(v_message, jsonb_build_object('job', r.jobname, 'origem', 'pg_cron')));
    n := n + 1;
  end loop;
  -- Sinal de vida para o monitor de fora (sem URL no Vault, nada).
  if to_regnamespace('net') is not null then
    begin
      execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_message using 'bicos_heartbeat_url';
      if v_message like 'https://%' then
        execute 'select net.http_get(url := $1)' using v_message;
      end if;
    exception when others then
      null;
    end;
  end if;
  -- Guarda 90 dias de alertas e 14 de histórico do pg_cron (que cresce sem parar: a cada 10 min só o PIX).
  delete from public.cron_alerts where alerted_at < now() - interval '90 days';
  begin
    execute $d$delete from cron.job_run_details where end_time < now() - interval '14 days'$d$;
  exception when others then
    null;
  end;
  return n;
end;
$$;
revoke all on function public.check_cron_failures() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-vigiar-cron';
    perform cron.schedule('bicos-vigiar-cron', '12 * * * *', 'select public.check_cron_failures()');
  end if;
end $$;
