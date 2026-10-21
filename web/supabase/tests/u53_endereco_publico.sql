-- U53 — qualquer conta logada vê o endereço completo da vaga (rua, número, CEP e ponto); sem login, não.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-0000000007c1', 'recrutador', 'Empresa Aberta', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-0000000007a1', 'trabalhador', 'Olha Antes');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('96000000-0000-0000-0000-0000000007c1'));

select pg_temp.login('96000000-0000-0000-0000-0000000007a1');
select pg_temp.ok((select street = 'Rua Teste' and number = '10' and cep = '03307-000' and lat = -23.54
                     from public.jobs where id = (select v from t_ids)), 'o trabalhador vê o endereço completo sem se candidatar');
select pg_temp.ok(exists (select 1 from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57) f
                           where f->>'id' = (select v from t_ids) and f->>'street' = 'Rua Teste'
                             and (f->>'lat')::double precision = -23.54), 'o mural manda o endereço e o ponto exato');
select pg_temp.fails($$select hidden_reason from public.jobs$$, '42501');
select pg_temp.logout();

set local role anon;
select pg_temp.fails($$select street from public.jobs$$, '42501');
reset role;
rollback;
