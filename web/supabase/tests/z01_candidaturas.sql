-- Z01 (+ Y02, Y03, Y05, Y06, Y08, Y15) — cada ação de candidatura, vaga e conta pelas RPCs, como o app
-- chama, numa transação desfeita no fim. Rodar com supabase/tests/_helpers.sql antes.
begin;

select pg_temp.new_user('10000000-0000-0000-0000-0000000000c1', 'recrutador', 'Construtora Teste');
select pg_temp.new_user('10000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Ana Teste');
select pg_temp.new_user('10000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Bruno Teste');
select pg_temp.new_user('10000000-0000-0000-0000-0000000000a3', 'trabalhador', 'Carla Teste');

create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated, anon;
insert into t_ids values
  ('futura', pg_temp.new_job('10000000-0000-0000-0000-0000000000c1', 1, 2)),
  ('hoje', pg_temp.new_job('10000000-0000-0000-0000-0000000000c1', 1, 0)),
  ('falta', pg_temp.new_job('10000000-0000-0000-0000-0000000000c1', 1, 0)),
  ('remover', pg_temp.new_job('10000000-0000-0000-0000-0000000000c1', 2, 2));

-- Candidaturas: Ana e Bruno na vaga futura (1 posição).
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids where k = 'futura'));
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids where k = 'futura'));

-- Retirar candidatura (withdraw_application): Bruno sai e entra de novo.
select public.withdraw_application((select v from t_ids where k = 'futura'));
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a2') is null,
  'withdraw_application apaga a candidatura pendente');
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids where k = 'futura'));

-- Só a construtora decide.
select pg_temp.fails(format('select public.transition_application(%L, %L, ''aprovar'')',
  (select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1'), 'BC401');

-- Aprovar a última posição recusa os pendentes automaticamente.
select pg_temp.login('10000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1', 'aprovar');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1') = 'pre_selecionado',
  'aprovar → pré-selecionado');
select pg_temp.ok((select auto_rejected from public.applications
                    where job_id = (select v from t_ids where k = 'futura')
                      and worker_id = '10000000-0000-0000-0000-0000000000a2'), 'lotou: Bruno recusado automaticamente');

-- Contratar; concluir e marcar falta antes do dia são recusados (Y02).
select pg_temp.login('10000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1', 'contratar');
select pg_temp.fails(format('select public.transition_application(%L, %L, ''concluir'')',
  (select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1'), 'BC409');
select pg_temp.fails(format('select public.transition_application(%L, %L, ''marcar_falta'')',
  (select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1'), 'BC409');

-- Excluir vaga com contratado é recusado (Y08).
select pg_temp.fails(format('select public.delete_job(%L)', (select v from t_ids where k = 'futura')), 'BC409');

-- Ninguém desiste no lugar de outro.
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select pg_temp.fails(format('select public.transition_application(%L, %L, ''desistir'', ''x'')',
  (select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1'), 'BC401');

-- Ana desiste: a posição libera e Bruno volta para análise, com aviso (Y03); o aviso à construtora
-- diz que a vaga voltou ao mural (Y06).
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select public.transition_application((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a1', 'desistir', 'Fiquei doente');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a2') = 'em_analise',
  'desistência devolve o recusado automático para análise');
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '10000000-0000-0000-0000-0000000000a2'
                           and title = 'A vaga reabriu'), 'Bruno recebe "A vaga reabriu"');
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '10000000-0000-0000-0000-0000000000c1'
                           and kind = 'desistencia' and body like '%voltou a ficar aberta no mural%'),
  'construtora avisada de que a vaga voltou ao mural');

-- Aprovar Bruno, a vaga fechar e tentar desfazer a aprovação (Y05). U06: ninguém fecha a vaga à mão; ela
-- fecha sozinha (equipe concluída, prazo, conta excluída) — aqui, direto na tabela.
select pg_temp.login('10000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a2', 'aprovar');
select pg_temp.logout();
update public.jobs set closed = true where id = (select v from t_ids where k = 'futura');
select pg_temp.login('10000000-0000-0000-0000-0000000000c1');
select pg_temp.fails(format('select public.transition_application(%L, %L, ''desfazer_aprovacao'')',
  (select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a2'), 'BC409');
-- Cancelar numa vaga encerrada funciona, mas ninguém volta (a vaga não está aberta).
select public.transition_application((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a2', 'cancelar_contratacao', 'Obra adiada');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'futura'), '10000000-0000-0000-0000-0000000000a2') = 'cancelado_pela_construtora',
  'cancelar contratação');

-- Vaga que começa hoje: contratar, concluir (conta como posição ocupada) e jobs_done.
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select public.submit_application((select v from t_ids where k = 'hoje'));
select pg_temp.login('10000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'hoje'), '10000000-0000-0000-0000-0000000000a3', 'analisar');
select public.transition_application((select v from t_ids where k = 'hoje'), '10000000-0000-0000-0000-0000000000a3', 'aprovar');
select public.transition_application((select v from t_ids where k = 'hoje'), '10000000-0000-0000-0000-0000000000a3', 'contratar');
select public.transition_application((select v from t_ids where k = 'hoje'), '10000000-0000-0000-0000-0000000000a3', 'concluir');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'hoje'), '10000000-0000-0000-0000-0000000000a3') = 'concluida',
  'concluir no dia do bico');
select pg_temp.ok(public.job_holding((select v from t_ids where k = 'hoje')) = 1, 'concluída ocupa a posição (Y02)');
select pg_temp.ok((select jobs_done from public.workers where id = '10000000-0000-0000-0000-0000000000a3') = 1,
  'jobs_done soma 1');
select pg_temp.ok((select closed from public.jobs where id = (select v from t_ids where k = 'hoje')),
  'a equipe toda concluiu: a vaga encerra sozinha (Y01)');
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select pg_temp.fails(format('select public.submit_application(%L)', (select v from t_ids where k = 'hoje')), 'BC409');

-- Marcar falta no dia.
select public.submit_application((select v from t_ids where k = 'falta'));
select pg_temp.login('10000000-0000-0000-0000-0000000000c1');
select public.transition_application((select v from t_ids where k = 'falta'), '10000000-0000-0000-0000-0000000000a1', 'aprovar');
select public.transition_application((select v from t_ids where k = 'falta'), '10000000-0000-0000-0000-0000000000a1', 'contratar');
select public.transition_application((select v from t_ids where k = 'falta'), '10000000-0000-0000-0000-0000000000a1', 'marcar_falta');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'falta'), '10000000-0000-0000-0000-0000000000a1') = 'nao_compareceu',
  'marcar falta no dia do bico');

-- Avaliações para conferir a anonimização na exclusão de conta.
select pg_temp.login('10000000-0000-0000-0000-0000000000a3');
select public.submit_review((select id from public.applications where job_id = (select v from t_ids where k = 'hoje')
                              and worker_id = '10000000-0000-0000-0000-0000000000a3'),
                            'para_construtora', 5, '{}', 'Tudo certo');

-- Excluir vaga sem equipe: quem esperava vira "não selecionado" e é avisado (Y08).
select pg_temp.login('10000000-0000-0000-0000-0000000000a1');
select public.submit_application((select v from t_ids where k = 'remover'));
select pg_temp.login('10000000-0000-0000-0000-0000000000c1');
select public.delete_job((select v from t_ids where k = 'remover'));
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'remover'), '10000000-0000-0000-0000-0000000000a1') = 'nao_selecionado',
  'excluir vaga recusa quem esperava');
select pg_temp.ok((select deleted_at is not null and closed from public.jobs where id = (select v from t_ids where k = 'remover')),
  'vaga excluída e encerrada');
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '10000000-0000-0000-0000-0000000000a1'
                           and title = 'Vaga removida'), 'aviso "Vaga removida"');
select pg_temp.login('10000000-0000-0000-0000-0000000000a2');
select pg_temp.fails(format('select public.submit_application(%L)', (select v from t_ids where k = 'remover')), 'BC409');

-- Excluir conta: sem login recente é recusado; com login recente apaga e anonimiza (Y15).
select pg_temp.login('10000000-0000-0000-0000-0000000000a3', 3600);
select pg_temp.fails('select public.delete_my_account(true)', 'BC401');
select pg_temp.login('10000000-0000-0000-0000-0000000000a3', 10);
select public.delete_my_account(true);
select pg_temp.logout();
select pg_temp.ok(not exists (select 1 from auth.users where id = '10000000-0000-0000-0000-0000000000a3'), 'conta apagada do Auth');
select pg_temp.ok((select name from public.workers where id = '10000000-0000-0000-0000-0000000000a3') = 'Conta excluída',
  'perfil anonimizado');
select pg_temp.ok(not exists (select 1 from public.reviews where author_label like 'Carla%'), 'nome sai das avaliações');

-- Visitante sem login não chama nada disso.
set local role anon;
select pg_temp.fails(format('select public.delete_job(%L)', (select v from t_ids where k = 'futura')), '42501');
reset role;

rollback;
