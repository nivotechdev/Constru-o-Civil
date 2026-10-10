-- L10: verificação automática do CNPJ (situação "ativa" na Receita, pela BrasilAPI) e vaga recusada para
-- construtora reprovada.
--
-- - company_cnpj_for_check: o CNPJ completo da construtora (decifrado de accounts.document_cipher), só para a
--   Edge Function verificar-cnpj (service_role). CPF não volta (fica para conferência manual).
-- - publish_job: construtora "reprovada" não publica. "Pendente" publica normalmente (decisão em DECISOES.md).

create or replace function public.company_cnpj_for_check(p_company uuid)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_key text;
  v_doc text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  if v_key is null then return null; end if;
  select extensions.pgp_sym_decrypt(a.document_cipher, v_key) into v_doc
    from public.accounts a where a.company_id = p_company and a.document_cipher is not null;
  return case when length(v_doc) = 14 then v_doc end;
end;
$$;

create or replace function public.publish_job(p jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_company uuid := public.my_company_id();
  j public.jobs;
  x record;
  v_id text;
begin
  if v_company is null then
    raise exception using errcode = 'BC401', message = 'Só a conta de construtora pode publicar vagas.';
  end if;
  if not exists (select 1 from public.accounts where id = auth.uid() and profile_completed_at is not null) then
    raise exception using errcode = 'BC409', message = 'Complete o perfil da empresa antes de publicar.';
  end if;
  if exists (select 1 from public.companies where id = v_company and verification_status = 'reprovada') then
    raise exception using errcode = 'BC409',
      message = 'Não conseguimos verificar sua empresa. Fale com a gente pela Ajuda para voltar a publicar.';
  end if;
  j := public.job_from_draft(p);
  x := public.job_extras_from_draft(p);
  insert into public.jobs (
    company_id, oficio_id, title, pay, cep, street, number, complement, neighborhood, city, uf, lat, lon,
    date_to_arrange, start_date, end_date, start_time, end_time, diarias, dias, urgent, photos, slots,
    description, requirements, payment_method, payment_note
  ) values (
    v_company, j.oficio_id, j.title, j.pay, j.cep, j.street, j.number, j.complement, j.neighborhood, j.city,
    j.uf, j.lat, j.lon, j.date_to_arrange, j.start_date, j.end_date, j.start_time, j.end_time, j.diarias,
    j.dias, j.urgent, j.photos, j.slots, j.description, j.requirements, x.method, x.note
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.company_cnpj_for_check(uuid) from public, anon, authenticated;
grant execute on function public.company_cnpj_for_check(uuid) to service_role;
revoke all on function public.publish_job(jsonb) from public, anon;
grant execute on function public.publish_job(jsonb) to authenticated;
