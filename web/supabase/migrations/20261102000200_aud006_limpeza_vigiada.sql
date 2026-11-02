-- AUD-006: a limpeza diária do Storage (selfie/documento 30 dias depois da decisão, arquivos órfãos, sobras de
-- exclusão) rodava em silêncio: sem URL/segredo no Vault `call_storage_cleanup` voltava sem dizer nada, e o
-- pg_cron marcava "sucesso" mesmo quando a Edge Function respondia 401/500. Agora:
--   * sem a configuração, grava um alerta em `cron_alerts` (e manda ao Sentry, se houver DSN);
--   * cada chamada à função fica registrada em `cron_http_calls`; de hora em hora (`bicos-vigiar-chamadas`)
--     a resposta do pg_net é conferida: não-2xx ou sem resposta em 3 horas vira alerta;
--   * `storage_cleanup_overdue()` conta os arquivos de identidade que já deviam ter saído (atraso também alerta).
-- Idempotente.

create table if not exists public.cron_http_calls (
  id bigint generated always as identity primary key,
  jobname text not null,
  request_id bigint not null,
  called_at timestamptz not null default now(),
  checked boolean not null default false
);
create index if not exists cron_http_calls_open_idx on public.cron_http_calls (called_at) where not checked;
alter table public.cron_http_calls enable row level security;
revoke all on table public.cron_http_calls from anon, authenticated;

-- Alerta de rotina (cron_alerts + Sentry), no máximo um por rotina e mensagem a cada 24 h.
create or replace function public.raise_cron_alert(p_job text, p_message text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_message text := public.scrub_error_text(p_message);
begin
  if exists (select 1 from public.cron_alerts a
              where a.jobname = p_job and a.message = v_message and a.alerted_at > now() - interval '24 hours') then
    return false;
  end if;
  insert into public.cron_alerts (jobname, runid, message, sent)
  values (p_job, 0, v_message,
          public.send_sentry_event(v_message, jsonb_build_object('job', p_job, 'origem', 'pg_cron')));
  return true;
end;
$$;
revoke all on function public.raise_cron_alert(text, text) from public, anon, authenticated;

-- Arquivos de identidade que já deviam ter saído: sem envio há mais de 2 dias ou envio decidido há mais de 31.
create or replace function public.storage_cleanup_overdue()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int
    from storage.objects o
   where o.bucket_id = 'identidade'
     and (
       (o.created_at < now() - interval '2 days'
        and not exists (select 1 from public.identity_submissions s
                         where s.selfie_path = o.name or s.document_path = o.name))
       or exists (select 1 from public.identity_submissions s
                   where (s.selfie_path = o.name or s.document_path = o.name)
                     and s.decided_at < now() - interval '31 days')
     )
$$;
revoke all on function public.storage_cleanup_overdue() from public, anon, authenticated;
grant execute on function public.storage_cleanup_overdue() to service_role;

-- Chamada diária da Edge Function (sem esperar a resposta), agora registrada e vigiada.
create or replace function public.call_storage_cleanup()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  if to_regnamespace('net') is not null and to_regnamespace('vault') is not null then
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_url using 'bicos_cleanup_url';
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'bicos_cleanup_secret';
  end if;
  if v_url is null or v_secret is null then
    perform public.raise_cron_alert('bicos-limpar-arquivos',
      'A limpeza diária de arquivos não está configurada (faltam bicos_cleanup_url ou bicos_cleanup_secret no Vault): selfie e documento não saem do Storage.');
    return;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)' into v_request
    using v_url, '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret);
  insert into public.cron_http_calls (jobname, request_id) values ('bicos-limpar-arquivos', v_request);
end;
$$;
revoke all on function public.call_storage_cleanup() from public, anon, authenticated;

-- De hora em hora: a resposta de cada chamada e o atraso da limpeza. Devolve quantos alertas novos saíram.
create or replace function public.check_cron_http_calls()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_found boolean;
  v_code integer;
  v_late integer;
begin
  for r in
    select c.id, c.jobname, c.request_id, c.called_at from public.cron_http_calls c
     where not c.checked and c.called_at < now() - interval '5 minutes' order by c.id
  loop
    v_found := false;
    v_code := null;
    if to_regclass('net._http_response') is not null then
      execute 'select true, status_code from net._http_response where id = $1 limit 1' into v_found, v_code using r.request_id;
      v_found := coalesce(v_found, false);
    end if;
    if v_found then
      update public.cron_http_calls set checked = true where id = r.id;
      if v_code is null or v_code not between 200 and 299 then
        if public.raise_cron_alert(r.jobname, 'A chamada da rotina ' || r.jobname
             || ' à Edge Function respondeu HTTP ' || coalesce(v_code::text, 'sem código') || '.') then
          n := n + 1;
        end if;
      end if;
    elsif r.called_at < now() - interval '3 hours' then
      update public.cron_http_calls set checked = true where id = r.id;
      if public.raise_cron_alert(r.jobname, 'A chamada da rotina ' || r.jobname
           || ' à Edge Function ficou sem resposta por mais de 3 horas.') then
        n := n + 1;
      end if;
    end if;
  end loop;
  v_late := public.storage_cleanup_overdue();
  if v_late > 0 and public.raise_cron_alert('bicos-limpar-arquivos',
       'A limpeza de arquivos está atrasada: ' || v_late || ' arquivo(s) de identidade deviam ter saído do Storage.') then
    n := n + 1;
  end if;
  delete from public.cron_http_calls where called_at < now() - interval '30 days';
  return n;
end;
$$;
revoke all on function public.check_cron_http_calls() from public, anon, authenticated;
grant execute on function public.check_cron_http_calls() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-vigiar-chamadas';
    perform cron.schedule('bicos-vigiar-chamadas', '27 * * * *', 'select public.check_cron_http_calls()');
  end if;
end $$;
