-- L07 (lançamento) — aceites com versão e data; novo aceite; consentimento da verificação de identidade.
begin;
select pg_temp.new_user('87000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Aceita Termos');
select pg_temp.ok((select count(*) from public.terms_acceptances where account_id = '87000000-0000-0000-0000-0000000000a1') = 2,
                  'cadastro registra o aceite dos termos e da política');
do $$ begin
  -- (a tabela do app antigo sai de vez com supabase/pendentes/…_lanc07_apagar_app_antigo.sql)
  if to_regclass('public.consentimentos') is not null then
    perform pg_temp.ok(not exists (select 1 from public.consentimentos
                                    where usuario_id = '87000000-0000-0000-0000-0000000000a1'),
                       'cadastro novo não grava mais na tabela do app antigo');
  end if;
end $$;

select pg_temp.login('87000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select * from public.terms_acceptances$$, '42501');
select pg_temp.fails($$select public.accept_terms('  ')$$, 'BC422');
select public.accept_terms('2.0');
select pg_temp.ok((select terms_version = '2.0' from public.accounts where id = '87000000-0000-0000-0000-0000000000a1'), 'nova versão aceita');
select public.accept_terms('2.0');  -- de novo: nada duplica

-- Sem o consentimento específico, a verificação não sai.
select pg_temp.fails($$select public.submit_identity('87000000-0000-0000-0000-0000000000a1/s.jpg', '87000000-0000-0000-0000-0000000000a1/d.jpg', null)$$, 'BC422');
select pg_temp.fails($$select public.submit_identity('87000000-0000-0000-0000-0000000000a1/s.jpg', '87000000-0000-0000-0000-0000000000a1/d.jpg', '')$$, 'BC422');
select public.submit_identity('87000000-0000-0000-0000-0000000000a1/s.jpg', '87000000-0000-0000-0000-0000000000a1/d.jpg', '1.0');
select pg_temp.ok((select (public.export_my_data() -> 'aceites') @> '[{"documento": "uso_de_imagem_identidade", "versao": "1.0"}]'::jsonb),
                  'exportar dados mostra o consentimento da imagem');
select pg_temp.ok((select jsonb_array_length(public.export_my_data() -> 'verificacao_identidade')) = 1, 'e a verificação enviada');
select pg_temp.logout();

select pg_temp.ok((select consent_version = '1.0' and consent_at is not null from public.identity_submissions
                    where worker_id = '87000000-0000-0000-0000-0000000000a1'), 'consentimento gravado com versão e data');
select pg_temp.ok((select count(*) from public.terms_acceptances where account_id = '87000000-0000-0000-0000-0000000000a1') = 5,
                  'aceites: 1.0 (2), 2.0 (2) e uso de imagem (1)');

set local role anon;
select pg_temp.fails($$select public.accept_terms('2.0')$$, '42501');
reset role;
rollback;
