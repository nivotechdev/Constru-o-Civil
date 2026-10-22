-- U63 — quem contrata tem um nome só: sem a coluna do responsável; o cadastro com o metadado antigo ainda funciona.
begin;
select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public'
                               and table_name = 'companies' and column_name = 'contact_name'),
  'companies.contact_name saiu');
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('79000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'ana@bicos.test', now(), '{"role": "recrutador", "nome": "Ana Souza", "documento": "11222333000181",
        "whatsapp": "11988887777", "maior_de_idade": true, "responsavel": "Outro Nome"}', now(), now());
select pg_temp.ok((select name = 'Ana Souza' from public.companies where id = '79000000-0000-0000-0000-0000000000c1'),
  'a conta nasce com o único nome (o "responsável" antigo é ignorado)');
rollback;
