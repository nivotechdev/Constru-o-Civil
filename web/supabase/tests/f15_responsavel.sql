-- F15 — nome do responsável vem do cadastro e a construtora edita.
begin;
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('79000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'obra-ana@bicos.test', now(), '{"role": "recrutador", "nome": "Obra da Ana", "documento": "11222333000181",
        "whatsapp": "11988887777", "maior_de_idade": true, "responsavel": " Ana Souza "}', now(), now());
select pg_temp.ok((select contact_name = 'Ana Souza' from public.companies where id = '79000000-0000-0000-0000-0000000000c1'),
  'responsável do cadastro');
update public.accounts set profile_completed_at = now() where id = '79000000-0000-0000-0000-0000000000c1';
select pg_temp.login('79000000-0000-0000-0000-0000000000c1');
update public.companies set contact_name = 'Bruno' where id = '79000000-0000-0000-0000-0000000000c1';
select pg_temp.fails($$update public.companies set contact_name = 'B' where id = '79000000-0000-0000-0000-0000000000c1'$$, '23514');
select pg_temp.logout();
select pg_temp.ok((select contact_name = 'Bruno' from public.companies where id = '79000000-0000-0000-0000-0000000000c1'), 'editado');
rollback;
