-- L10 (lançamento) — link público pelo slug aleatório; BC-n não abre sem login; limite por IP.
begin;
select pg_temp.new_user('8a000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Do Link', '11.222.333/0001-81');
select pg_temp.new_user('8a000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quem Compartilha');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to anon, authenticated;
insert into t_ids values ('j', pg_temp.new_job('8a000000-0000-0000-0000-0000000000c1'));
insert into t_ids values ('j2', pg_temp.new_job('8a000000-0000-0000-0000-0000000000c1'));
insert into t_ids select 's', public_slug from public.jobs where id = (select v from t_ids where k = 'j');

select pg_temp.ok((select v ~ '^[abcdefghjkmnpqrstuvwxyz23456789]{12}$' from t_ids where k = 's'), 'slug de 12 caracteres sem 0/o/1/l/i');
select pg_temp.ok((select count(distinct public_slug) from public.jobs where company_id = '8a000000-0000-0000-0000-0000000000c1') = 2,
                  'cada vaga tem o seu');
select pg_temp.fails($$update public.jobs set public_slug = 'BC-1' where id = (select v from t_ids where k = 'j')$$, '23514');
select pg_temp.fails($$update public.jobs set public_slug = (select public_slug from public.jobs where id = (select v from t_ids where k = 'j2'))
                        where id = (select v from t_ids where k = 'j')$$, '23505');

-- Quem está logado lê o slug para compartilhar.
select pg_temp.login('8a000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select public_slug from public.jobs where id = (select v from t_ids where k = 'j')) = (select v from t_ids where k = 's'),
                  'logado lê o slug');
select pg_temp.logout();

-- Visitante: pelo slug abre (com o BC-n para mostrar), pelo BC-n não.
set local role anon;
select set_config('request.headers', '{"x-forwarded-for": "203.0.113.7, 10.0.0.1"}', true);
select pg_temp.ok((select public.public_job_card(v) ->> 'id' from t_ids where k = 's') = (select v from t_ids where k = 'j'),
                  'abre pelo slug e mostra o BC-n');
select pg_temp.ok((select public.public_job_card(v) from t_ids where k = 'j') is null, 'BC-n não abre sem login');
select pg_temp.ok(public.public_job_card('naoexiste2345') is null, 'slug desconhecido não abre');
select pg_temp.fails($$select * from public.public_link_hits$$, '42501');
reset role;
select pg_temp.ok((select count(*) from public.public_link_hits) = 3, 'cada consulta conta');
select pg_temp.ok((select bool_and(ip_hash !~ '203') from public.public_link_hits), 'o IP não fica gravado');

-- 60 consultas em 10 minutos por IP; outro IP segue livre; o Cloudflare manda no IP.
insert into public.public_link_hits (ip_hash)
select encode(extensions.digest('203.0.113.7|' || current_date::text, 'sha256'), 'hex') from generate_series(1, 57);
set local role anon;
select pg_temp.fails($$select public.public_job_card('naoexiste2345')$$, 'BC409');
select set_config('request.headers', '{"x-forwarded-for": "198.51.100.9"}', true);
select pg_temp.ok((select public.public_job_card(v) is not null from t_ids where k = 's'), 'outro IP segue livre');
select set_config('request.headers', '{"cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.9"}', true);
select pg_temp.fails($$select public.public_job_card('naoexiste2345')$$, 'BC409');
reset role;

-- A limpeza diária apaga as consultas de ontem.
update public.public_link_hits set at = now() - interval '2 days';
select public.purge_auth_attempts();
select pg_temp.ok((select count(*) from public.public_link_hits) = 0, 'limpeza apaga as consultas antigas');
rollback;
