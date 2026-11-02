-- AUD-021: qualquer conta logada (inclusive uma "empresa" criada na hora) lia nome, bairro, foto, bio e experiências de
-- TODOS os trabalhadores com uma consulta só. Decisão 19 dos sócios (opção B): o perfil do trabalhador é lido por ele
-- mesmo e pela empresa que tem vínculo com ele — candidatura numa vaga dela ou convite dela. As telas só chegam ao
-- perfil por essas listas (candidatos da vaga), então nada some para quem usa o app.
-- Idempotente.

create or replace function public.can_view_worker(p_worker uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_worker = public.my_worker_id()
      or exists (
        select 1 from public.applications a join public.jobs j on j.id = a.job_id
         where a.worker_id = p_worker and j.company_id = public.my_company_id()
      )
      or exists (
        select 1 from public.job_invites i
         where i.worker_id = p_worker and i.company_id = public.my_company_id()
      )
$$;
revoke all on function public.can_view_worker(uuid) from public, anon;
grant execute on function public.can_view_worker(uuid) to authenticated;

drop policy if exists "Perfis de trabalhador visíveis para quem está logado" on public.workers;
drop policy if exists "Perfil do trabalhador: o próprio e quem tem vínculo" on public.workers;
create policy "Perfil do trabalhador: o próprio e quem tem vínculo" on public.workers
  for select to authenticated using ((select public.can_view_worker(id)));

-- Os índices que a consulta usa.
create index if not exists applications_worker_idx on public.applications (worker_id);
create index if not exists job_invites_worker_idx on public.job_invites (worker_id);
