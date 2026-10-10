-- F04 — denunciar e bloquear.
begin;
select pg_temp.new_user('80100000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Bloqueia', '11.222.333/0001-81');
select pg_temp.new_user('80100000-0000-0000-0000-0000000000a1', 'trabalhador', 'Vai Ser Bloqueado');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('80100000-0000-0000-0000-0000000000c1'));

select pg_temp.login('80100000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids));
select public.report_content('vaga', (select v from t_ids), 'golpe', 'Pediu dinheiro adiantado');
select public.report_content('vaga', (select v from t_ids), 'falso', null);  -- de novo: atualiza
select pg_temp.fails($$select public.report_content('vaga', 'x', 'qualquer', null)$$, 'BC422');
select pg_temp.ok((select count(*) = 1 and min(reason) = 'falso' from public.reports), 'uma denúncia, atualizada');
select pg_temp.logout();

select pg_temp.login('80100000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select count(*) from public.reports) = 0, 'a construtora não vê a denúncia');
select public.block_account('80100000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.invite_worker((select v from t_ids), '80100000-0000-0000-0000-0000000000a1')$$, 'BC409');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids), '80100000-0000-0000-0000-0000000000a1') is null, 'candidatura pendente saiu');

select pg_temp.login('80100000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.submit_application((select v from t_ids))$$, 'BC409');
select pg_temp.ok((select count(*) from public.blocks) = 0, 'quem foi bloqueado não vê o bloqueio');
select pg_temp.logout();

select pg_temp.login('80100000-0000-0000-0000-0000000000c1');
select public.unblock_account('80100000-0000-0000-0000-0000000000a1');
select pg_temp.logout();
select pg_temp.login('80100000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids));
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids), '80100000-0000-0000-0000-0000000000a1') = 'enviada', 'desbloqueado: candidata de novo');
rollback;
