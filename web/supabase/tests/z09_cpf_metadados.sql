-- Z09 — o documento do cadastro é cifrado em accounts e não fica em auth.users.
begin;

select pg_temp.new_user('50000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Sem CPF no Auth', '529.982.247-25');
select pg_temp.ok(not ((select raw_user_meta_data from auth.users where id = '50000000-0000-0000-0000-0000000000a1') ? 'documento'),
  'metadados do Auth sem o documento');
select pg_temp.ok((select document_cipher is not null and document = '***.982.247-**' from public.accounts
                    where id = '50000000-0000-0000-0000-0000000000a1'), 'documento cifrado e mascarado em accounts');
select pg_temp.ok(coalesce(current_setting('bicos.cadastro_documento', true), '') = '', 'nada fica na sessão');
select pg_temp.ok(not exists (select 1 from auth.users where raw_user_meta_data ? 'documento'), 'nenhuma conta com documento nos metadados');

rollback;
