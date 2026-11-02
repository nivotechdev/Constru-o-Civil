-- AUD-002 — o endereço exato de casa/apartamento/condomínio (e de vaga sem tipo) só sai para a empresa dona e para
-- quem foi aprovado; o de comércio, prédio e "outro" continua visível a quem tem conta, com limite de consultas.
-- Nenhuma conta lê rua, número, CEP, complemento nem o ponto exato direto da tabela.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-0000000002c1', 'recrutador', 'Empresa Endereco', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-0000000002a1', 'trabalhador', 'Wanda Curiosa');
select pg_temp.new_user('96000000-0000-0000-0000-0000000002a2', 'trabalhador', 'Pedro Aprovado');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('casa', pg_temp.new_job('96000000-0000-0000-0000-0000000002c1', 2));
insert into t_ids values ('semtipo', pg_temp.new_job('96000000-0000-0000-0000-0000000002c1', 2));
insert into t_ids values ('loja', pg_temp.new_job('96000000-0000-0000-0000-0000000002c1', 2));
update public.jobs set place_type = 'casa', street = 'Rua da Casa' where id = (select v from t_ids where k = 'casa');
update public.jobs set place_type = null, street = 'Rua Sem Tipo' where id = (select v from t_ids where k = 'semtipo');
update public.jobs set place_type = 'comercio', street = 'Avenida da Loja' where id = (select v from t_ids where k = 'loja');
insert into public.applications (job_id, worker_id, status)
values ((select v from t_ids where k = 'casa'), '96000000-0000-0000-0000-0000000002a2', 'pre_selecionado');
insert into public.app_config (key, value) values ('address_lookups_per_hour', '3')
  on conflict (key) do update set value = excluded.value;

-- Ninguém lê as colunas do endereço direto da tabela.
select pg_temp.login('96000000-0000-0000-0000-0000000002a1');
select pg_temp.fails($$select street from public.jobs$$, '42501');
select pg_temp.fails($$select lat, lon from public.jobs$$, '42501');
select pg_temp.fails($$select cep, number, complement from public.jobs$$, '42501');
-- O que continua: bairro, cidade e o ponto aproximado.
select pg_temp.ok((select count(*) = 3 from public.jobs where area_lat is not null and neighborhood is not null),
                  'bairro e ponto aproximado seguem legíveis');

-- O mural: rua e ponto exato só no comércio; a casa e a vaga sem tipo vão sem endereço.
select pg_temp.ok((select j->>'street' = 'Avenida da Loja' and j->>'lat' is not null
                     from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57) j where j->>'id' = (select v from t_ids where k = 'loja')),
                  'mural: comércio com endereço');
select pg_temp.ok((select j->>'street' is null and j->>'lat' is null and j->>'cep' is null and j->>'number' is null
                     from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57) j where j->>'id' = (select v from t_ids where k = 'casa')),
                  'mural: casa sem endereço');
select pg_temp.ok((select j->>'street' is null and j->>'lat' is null
                     from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57) j where j->>'id' = (select v from t_ids where k = 'semtipo')),
                  'mural: vaga sem tipo, sem endereço');

-- get_job_addresses: o comércio sim, a casa e a vaga sem tipo não.
select pg_temp.ok((select array_agg(job_id order by job_id) = array[(select v from t_ids where k = 'loja')]
                     from public.get_job_addresses(array[(select v from t_ids where k = 'casa'),
                          (select v from t_ids where k = 'semtipo'), (select v from t_ids where k = 'loja')])),
                  'conta de fora recebe só o endereço do comércio');
-- Limite por hora (aqui 3 consultas): a 4ª não devolve mais nada de comércio.
select count(*) from public.get_job_addresses(array[(select v from t_ids where k = 'loja')]);
select count(*) from public.get_job_addresses(array[(select v from t_ids where k = 'loja')]);
select pg_temp.ok((select count(*) = 0 from public.get_job_addresses(array[(select v from t_ids where k = 'loja')])),
                  'passou do limite por hora: sem endereço');
select pg_temp.logout();

-- A empresa dona vê o dela, sempre.
select pg_temp.login('96000000-0000-0000-0000-0000000002c1');
select pg_temp.ok((select count(*) = 3 from public.get_job_addresses(array[(select v from t_ids where k = 'casa'),
                     (select v from t_ids where k = 'semtipo'), (select v from t_ids where k = 'loja')])),
                  'a dona recebe os três');
select pg_temp.logout();

-- Quem foi aprovado na casa recebe o endereço dela (e não o da vaga sem tipo).
select pg_temp.login('96000000-0000-0000-0000-0000000002a2');
select pg_temp.ok((select array_agg(street) = array['Rua da Casa'] from public.get_job_addresses(array[(select v from t_ids where k = 'casa'),
                     (select v from t_ids where k = 'semtipo')])),
                  'o aprovado recebe o endereço da casa');
select pg_temp.ok((select j->>'street' = 'Rua da Casa' from public.feed_jobs('São Paulo', 'SP', -23.54, -46.57) j
                    where j->>'id' = (select v from t_ids where k = 'casa')), 'e o mural também mostra a casa para ele');
select pg_temp.logout();
rollback;
