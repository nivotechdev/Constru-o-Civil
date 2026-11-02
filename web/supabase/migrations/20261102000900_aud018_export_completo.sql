-- AUD-018: "Exportar meus dados" não trazia tudo o que a Bicos guarda sobre a pessoa, mas a tela e a Política dizem que
-- traz. Entram: preferências (tema e avisos), alertas de vaga, convites, bloqueios (só o id bloqueado e a data),
-- denúncias que ela fez, as avaliações que ela escreveu, os aparelhos do aviso no celular (sem chave nem endereço do
-- navegador) e a participação em equipe de empresa. Denúncias contra a pessoa e dados de terceiros ficam de fora de
-- propósito. Idempotente.

-- export_my_data (de 20261021000600_u51_endereco.sql)
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_account public.accounts;
  v_key text;
  v_doc text;
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'nivotech_documento_key';
  if v_key is not null and v_account.document_cipher is not null then
    v_doc := extensions.pgp_sym_decrypt(v_account.document_cipher, v_key);
  end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'conta', jsonb_build_object(
      'email', v_account.email, 'lado', v_account.role, 'documento', v_doc, 'whatsapp', v_account.whatsapp,
      'email_confirmado_em', v_account.email_confirmed_at, 'perfil_completo_em', v_account.profile_completed_at,
      'termos_versao', v_account.terms_version, 'termos_aceitos_em', v_account.terms_accepted_at,
      'criada_em', v_account.created_at),
    'endereco', (select to_jsonb(a) - 'account_id' from public.addresses a where a.account_id = v_account.id),
    'perfil', coalesce(
      (select to_jsonb(w) from public.workers w where w.id = v_account.worker_id),
      (select to_jsonb(c) from public.companies c where c.id = v_account.company_id)),
    'vagas', coalesce((select jsonb_agg(to_jsonb(j)) from public.jobs j where j.company_id = v_account.company_id), '[]'),
    'candidaturas', coalesce((
      select jsonb_agg(to_jsonb(a) || jsonb_build_object('historico', (
        select jsonb_agg(to_jsonb(e) order by e.at) from public.application_events e where e.application_id = a.id)))
        from public.applications a
       where a.worker_id = v_account.worker_id
          or a.job_id in (select id from public.jobs where company_id = v_account.company_id)), '[]'),
    'avaliacoes_recebidas', coalesce((
      select jsonb_agg(to_jsonb(r)) from public.reviews r
       where r.worker_id = v_account.worker_id or r.company_id = v_account.company_id), '[]'),
    'vagas_salvas', coalesce((select jsonb_agg(to_jsonb(s)) from public.saved_jobs s where s.worker_id = v_account.worker_id), '[]'),
    'portfolio', coalesce((select jsonb_agg(to_jsonb(p)) from public.worker_posts p where p.worker_id = v_account.worker_id), '[]'),
    'notificacoes', coalesce((
      select jsonb_agg(to_jsonb(n)) from public.notifications n
       where n.worker_id = v_account.worker_id or n.company_id = v_account.company_id), '[]'),
    'pagamentos', coalesce((select jsonb_agg(to_jsonb(b) - 'pix_code') from public.boost_payments b where b.company_id = v_account.company_id), '[]'),
    'aceites', coalesce((
      select jsonb_agg(jsonb_build_object('documento', t.document, 'versao', t.version, 'aceito_em', t.accepted_at)
                       order by t.accepted_at)
        from public.terms_acceptances t where t.account_id = v_account.id), '[]'),
    -- AUD-018: o resto do que a Bicos guarda sobre a pessoa.
    'preferencias', jsonb_build_object(
      'tema', (select to_jsonb(p) - 'account_id' from public.account_prefs p where p.account_id = v_account.id),
      'avisos', (select to_jsonb(p) - 'account_id' from public.notification_prefs p where p.account_id = v_account.id)),
    'alertas_de_vaga', coalesce((select jsonb_agg(to_jsonb(a) - 'worker_id' order by a.created_at)
                                   from public.job_alerts a where a.worker_id = v_account.worker_id), '[]'),
    'convites', coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at) from public.job_invites i
                           where i.worker_id = v_account.worker_id or i.company_id = v_account.company_id), '[]'),
    -- De bloqueio só o id de quem foi bloqueado e a data (nada sobre a outra pessoa).
    'bloqueios', coalesce((select jsonb_agg(jsonb_build_object('bloqueado', b.blocked_id, 'em', b.created_at)
                                            order by b.created_at)
                             from public.blocks b where b.blocker_id = v_account.id), '[]'),
    -- Só as denúncias que ela fez; denúncias contra ela não entram (são da pessoa denunciada ver só o resultado).
    'denuncias_feitas', coalesce((select jsonb_agg(jsonb_build_object(
                                    'tipo', r.target_type, 'alvo', r.target_id, 'motivo', r.reason, 'detalhes', r.details,
                                    'situacao', r.status, 'feita_em', r.created_at) order by r.created_at)
                                    from public.reports r where r.reporter_id = v_account.id), '[]'),
    'avaliacoes_escritas', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at) from public.reviews r
       where r.application_id in (
         select a.id from public.applications a
          where (r.direction = 'para_construtora' and a.worker_id = v_account.worker_id)
             or (r.direction = 'para_trabalhador'
                 and a.job_id in (select id from public.jobs where company_id = v_account.company_id)))), '[]'),
    -- Do aviso no celular: o aparelho e as datas (a chave e o endereço do navegador não saem).
    'notificacoes_push', coalesce((select jsonb_agg(jsonb_build_object(
                                     'aparelho', s.user_agent, 'criado_em', s.created_at, 'usado_em', s.last_used_at)
                                     order by s.created_at)
                                     from public.push_subscriptions s where s.account_id = v_account.id), '[]'),
    'equipe_da_empresa', coalesce((select jsonb_agg(jsonb_build_object('papel', m.role, 'desde', m.created_at))
                                     from public.company_members m where m.user_id = v_account.id), '[]'),
    'verificacao_identidade', coalesce((
      select jsonb_agg(jsonb_build_object('enviada_em', s.created_at, 'consentimento_versao', s.consent_version,
                                          'consentimento_em', s.consent_at, 'decidida_em', s.decided_at)
                       order by s.created_at)
        from public.identity_submissions s where s.worker_id = v_account.worker_id), '[]')
  );
end;
$$;
