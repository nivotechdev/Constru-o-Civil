-- X23: índices das chaves estrangeiras que as tabelas novas (F04, F07, F13, F18, Y28) trouxeram depois da
-- X15 (aviso "unindexed_foreign_keys" do Supabase). O dos convites também serve para o limite de 20 por dia
-- por construtora (invite_worker). Idempotente.

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);
create index if not exists company_members_user_idx on public.company_members (user_id);
create index if not exists identity_submissions_worker_idx on public.identity_submissions (worker_id);
create index if not exists job_alerts_oficio_idx on public.job_alerts (oficio_id);
create index if not exists job_invites_company_idx on public.job_invites (company_id, created_at);
