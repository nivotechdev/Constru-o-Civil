-- Z08 — O app antigo (pasta app/) é desligado; as funções e tabelas dele, abertas a visitantes no mesmo
-- banco, são fechadas. Os dados continuam lá (o app novo lê o que precisa por funções do próprio banco:
-- contas antigas, documento cifrado, consentimentos).
--
-- Antes: reiniciar_cadastro_pendente_email/_documento aceitavam visitante (apagavam o cadastro pendente
-- de outra pessoa e revelavam CPFs com cadastro); excluir_minha_conta apagava a conta sem anonimizar nem
-- cancelar bicos; limpar_cadastros_nao_confirmados podia ser chamada por qualquer um; a política
-- "Editar o próprio perfil" deixava gravar documento_hash/documento_cifrado/tipo.
-- Idempotente.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'reiniciar_cadastro_pendente_email', 'reiniciar_cadastro_pendente_documento', 'excluir_minha_conta',
         'limpar_cadastros_nao_confirmados', 'salvar_documento', 'meu_documento', 'meu_tipo', 'perfil_publico',
         'email_verificado', 'exportar_meus_dados', 'buscar_construtoras', 'decidir_candidatura',
         'concluir_candidatura', 'contato_whatsapp', 'fechar_vaga', 'postar_avaliacao',
         'criar_perfil_ao_cadastrar', 'impedir_troca_de_tipo', 'travar_autor_da_vaga', 'expirar_vagas_vencidas',
         'rls_auto_enable')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- As tabelas do app antigo: ninguém lê nem grava direto (perfis com e-mail e documento cifrado inclusive).
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'vagas', 'candidaturas', 'avaliacoes', 'vagas_salvas',
                           'publicacoes_trabalhador', 'consentimentos']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- Cadastro nunca confirmado: o app antigo apagava depois de 2 horas (o e-mail de confirmação pode chegar
-- depois disso). Agora: 7 dias.
create or replace function public.purge_unconfirmed_signups()
returns integer language sql security definer set search_path = public as $$
  with x as (
    delete from auth.users
     where email_confirmed_at is null and created_at < now() - interval '7 days'
    returning 1
  ) select count(*)::int from x
$$;
revoke all on function public.purge_unconfirmed_signups() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
     where jobname in ('limpar-cadastros-nao-confirmados', 'expirar-vagas-diario', 'bicos-limpar-cadastros');
    perform cron.schedule('bicos-limpar-cadastros', '23 3 * * *', 'select public.purge_unconfirmed_signups()');
  end if;
end $$;
