-- F12: confirmar presença. O contratado confirma que vai ("Confirmar que vou"); a construtora vê quem
-- confirmou. Na véspera, às 18h, quem ainda não confirmou recebe o lembrete. Mudar as datas da vaga zera as
-- confirmações. ("Não vou poder ir" continua sendo a desistência que já existe.)

alter type public.notification_kind add value if not exists 'confirmar_presenca';

alter table public.applications add column if not exists presence_confirmed_at timestamptz;

create or replace function public.confirm_presence(p_job_id text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_app public.applications;
  v_job public.jobs;
  v_worker text;
begin
  select * into v_app from public.applications
   where job_id = p_job_id and worker_id = public.my_worker_id() for update;
  if not found then
    raise exception using errcode = 'BC404', message = 'Essa candidatura não existe mais.';
  end if;
  if v_app.status <> 'contratado' then
    raise exception using errcode = 'BC409', message = 'Só quem está contratado confirma presença.';
  end if;
  select * into v_job from public.jobs where id = p_job_id;
  if public.job_last_day(v_job) < public.bicos_today() then
    raise exception using errcode = 'BC409', message = 'Esse bico já passou.';
  end if;
  if v_app.presence_confirmed_at is not null then return; end if;
  update public.applications set presence_confirmed_at = now() where id = v_app.id;
  select name into v_worker from public.workers where id = v_app.worker_id;
  perform public.notify(null, v_job.company_id, 'confirmar_presenca',
    coalesce(nullif(public.first_name(v_worker), ''), 'O trabalhador') || ' confirmou que vai',
    public.job_title(v_job) || case when v_job.start_date is not null
                                     then ' · ' || to_char(v_job.start_date, 'DD/MM') else '' end || '.',
    '/vaga-gerenciar/' || p_job_id);
end;
$$;

-- Véspera: avisa quem está contratado para amanhã e ainda não confirmou. Devolve quantos avisou.
create or replace function public.remind_presence()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_tomorrow date := public.bicos_today() + 1;
  r record;
  n integer := 0;
begin
  for r in
    select a.worker_id, j.id as job_id, public.job_title(j) as title, c.name as company
      from public.applications a
      join public.jobs j on j.id = a.job_id
      join public.companies c on c.id = j.company_id
     where a.status = 'contratado' and a.presence_confirmed_at is null
       and not j.closed and j.deleted_at is null
       and public.job_runs_on(j, v_tomorrow)
       and not exists (
         select 1 from public.notifications nn
          where nn.worker_id = a.worker_id and nn.kind = 'confirmar_presenca'
            and nn.target = '/selecionado/' || j.id and nn.created_at > now() - interval '20 hours')
  loop
    perform public.notify(r.worker_id, null, 'confirmar_presenca', 'Amanhã tem bico',
      r.title || ' com ' || r.company || '. Confirme que você vai.', '/selecionado/' || r.job_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Datas da vaga mudaram: as confirmações antigas não valem mais.
create or replace function public.reset_presence_on_new_dates()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.start_date is distinct from old.start_date or new.end_date is distinct from old.end_date
     or new.date_to_arrange is distinct from old.date_to_arrange or new.dias is distinct from old.dias then
    update public.applications set presence_confirmed_at = null
     where job_id = new.id and presence_confirmed_at is not null;
  end if;
  return null;
end;
$$;
drop trigger if exists jobs_reset_presence on public.jobs;
create trigger jobs_reset_presence after update of start_date, end_date, date_to_arrange, dias on public.jobs
  for each row execute function public.reset_presence_on_new_dates();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'bicos-lembrar-presenca';
    -- 21h UTC = 18h em Brasília.
    perform cron.schedule('bicos-lembrar-presenca', '0 21 * * *', 'select public.remind_presence()');
  end if;
end $$;

revoke all on function public.confirm_presence(text), public.remind_presence(), public.reset_presence_on_new_dates()
  from public, anon, authenticated;
grant execute on function public.confirm_presence(text) to authenticated;
