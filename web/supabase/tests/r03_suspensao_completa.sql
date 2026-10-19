-- R03 — suspender cancela o que já estava aprovado/contratado (sistema, "conta suspensa"), avisa o outro lado,
-- libera a posição; get_contact não abre com conta suspensa.
begin;
select pg_temp.new_user('93000000-0000-0000-0000-0000000000e1', 'trabalhador', 'Equipe Bicos');
select pg_temp.new_user('93000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Normal', '11.222.333/0001-81');
select pg_temp.new_user('93000000-0000-0000-0000-0000000000c2', 'recrutador', 'Obra Suspensa', '45.723.174/0001-10');
select pg_temp.new_user('93000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Joao Suspenso');
select pg_temp.new_user('93000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Recusado Automatico');
select pg_temp.new_user('93000000-0000-0000-0000-0000000000a3', 'trabalhador', 'Maria Contratada');
select pg_temp.new_user('93000000-0000-0000-0000-0000000000a4', 'trabalhador', 'Pedro Contato');
select public.add_staff_member('teste+93000000-0000-0000-0000-0000000000e1@bicos.test', 'admin');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j1', pg_temp.new_job('93000000-0000-0000-0000-0000000000c1', 1));
insert into t_ids values ('j2', pg_temp.new_job('93000000-0000-0000-0000-0000000000c1', 2));
insert into t_ids values ('j3', pg_temp.new_job('93000000-0000-0000-0000-0000000000c2', 1));
insert into t_ids values ('j4', pg_temp.new_job('93000000-0000-0000-0000-0000000000c1', 1));

-- J1: João contratado (vaga cheia), o outro recusado automaticamente. J2: João pré-selecionado.
-- J3 (construtora que vai ser suspensa): Maria contratada. J4: Pedro pré-selecionado (para o contato).
insert into public.applications (job_id, worker_id, status) values
  ((select v from t_ids where k = 'j1'), '93000000-0000-0000-0000-0000000000a1', 'contratado'),
  ((select v from t_ids where k = 'j2'), '93000000-0000-0000-0000-0000000000a1', 'pre_selecionado'),
  ((select v from t_ids where k = 'j3'), '93000000-0000-0000-0000-0000000000a3', 'contratado'),
  ((select v from t_ids where k = 'j4'), '93000000-0000-0000-0000-0000000000a4', 'pre_selecionado');
insert into public.applications (job_id, worker_id, status, auto_rejected) values
  ((select v from t_ids where k = 'j1'), '93000000-0000-0000-0000-0000000000a2', 'nao_selecionado', true);

-- A transição nova é só do sistema e só de pré-selecionado/contratado (igual ao applicationMachine.ts).
select pg_temp.ok(public.application_next_status('cancelar_por_suspensao', 'contratado', 'sistema') = 'cancelado_pela_equipe'
              and public.application_next_status('cancelar_por_suspensao', 'pre_selecionado', 'sistema') = 'cancelado_pela_equipe'
              and public.application_next_status('cancelar_por_suspensao', 'contratado', 'construtora') is null
              and public.application_next_status('cancelar_por_suspensao', 'enviada', 'sistema') is null,
                  'transição cancelar_por_suspensao: sistema, de pré-selecionado ou contratado');

-- A tabela inteira do banco = a de src/services/applicationMachine.ts (applications.test.ts tem a mesma lista).
select pg_temp.ok((
  select array_agg(m order by m) from (
    select s::text || ' -' || a || '/' || r::text || '-> ' || public.application_next_status(a, s, r)::text as m
      from unnest(array['analisar', 'aprovar', 'recusar', 'desfazer_aprovacao', 'desfazer_recusa', 'contratar',
                        'desistir', 'cancelar_contratacao', 'concluir', 'marcar_falta', 'expirar',
                        'cancelar_por_suspensao']) a,
           unnest(enum_range(null::public.application_status)) s,
           unnest(enum_range(null::public.application_actor)) r
     where public.application_next_status(a, s, r) is not null) x
) = (select array_agg(m order by m) from unnest(array[
  'enviada -analisar/construtora-> em_analise', 'enviada -analisar/sistema-> em_analise',
  'enviada -aprovar/construtora-> pre_selecionado', 'em_analise -aprovar/construtora-> pre_selecionado',
  'enviada -recusar/construtora-> nao_selecionado', 'enviada -recusar/sistema-> nao_selecionado',
  'em_analise -recusar/construtora-> nao_selecionado', 'em_analise -recusar/sistema-> nao_selecionado',
  'pre_selecionado -desfazer_aprovacao/construtora-> em_analise', 'nao_selecionado -desfazer_recusa/construtora-> em_analise',
  'pre_selecionado -contratar/construtora-> contratado',
  'pre_selecionado -desistir/trabalhador-> desistiu', 'contratado -desistir/trabalhador-> desistiu',
  'pre_selecionado -cancelar_contratacao/construtora-> cancelado_pela_construtora',
  'contratado -cancelar_contratacao/construtora-> cancelado_pela_construtora',
  'contratado -concluir/construtora-> concluida', 'contratado -concluir/sistema-> concluida',
  'contratado -marcar_falta/construtora-> nao_compareceu', 'pre_selecionado -expirar/sistema-> expirada',
  'pre_selecionado -cancelar_por_suspensao/sistema-> cancelado_pela_equipe',
  'contratado -cancelar_por_suspensao/sistema-> cancelado_pela_equipe']) m), 'tabela do banco = tabela do app');

-- 1. Trabalhador suspenso.
select pg_temp.login('93000000-0000-0000-0000-0000000000e1');
select public.admin_suspend_account('93000000-0000-0000-0000-0000000000a1', 'Golpe relatado');
select pg_temp.logout();
select pg_temp.ok((select bool_and(status = 'cancelado_pela_equipe') and count(*) = 2 from public.applications
                    where worker_id = '93000000-0000-0000-0000-0000000000a1'), 'bicos do suspenso cancelados pela equipe');
select pg_temp.ok((select count(*) from public.application_events e join public.applications a on a.id = e.application_id
                    where a.worker_id = '93000000-0000-0000-0000-0000000000a1' and e.status = 'cancelado_pela_equipe'
                      and e."by" = 'sistema' and e.reason = 'conta suspensa') = 2, 'histórico: sistema, "conta suspensa"');
select pg_temp.ok(public.job_holding((select v from t_ids where k = 'j1')) = 0, 'a posição liberou');
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'j1'), '93000000-0000-0000-0000-0000000000a2') = 'em_analise',
                  'recusado automaticamente volta para análise');
select pg_temp.ok((select count(*) from public.notifications where company_id = '93000000-0000-0000-0000-0000000000c1'
                    and title = 'Bico cancelado pela equipe' and body like 'Joao não vai mais em %') = 2,
                  'construtora avisada de cada bico');
select pg_temp.ok((select body like '%voltou para o mural.' from public.notifications
                    where company_id = '93000000-0000-0000-0000-0000000000c1' and target = '/vaga-gerenciar/' || (select v from t_ids where k = 'j2')),
                  'aviso diz que a vaga voltou ao mural');

-- 2. Construtora suspensa.
select pg_temp.login('93000000-0000-0000-0000-0000000000e1');
select public.admin_suspend_account('93000000-0000-0000-0000-0000000000c2', 'CNPJ falso');
select pg_temp.logout();
select pg_temp.ok(pg_temp.status_of((select v from t_ids where k = 'j3'), '93000000-0000-0000-0000-0000000000a3') = 'cancelado_pela_equipe',
                  'contratada na construtora suspensa: cancelado pela equipe');
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '93000000-0000-0000-0000-0000000000a3'
                            and kind = 'contratacao_cancelada' and title = 'Bico cancelado pela equipe'
                            and body like '%Não vá até a obra.%'), 'trabalhadora avisada');

-- 3. get_contact com um dos lados suspenso (sem passar pela suspensão, que já cancelaria o bico).
select pg_temp.login('93000000-0000-0000-0000-0000000000a4');
select pg_temp.ok((select phone from public.get_contact((select id from public.applications
                    where job_id = (select v from t_ids where k = 'j4')))) is not null, 'contato abre com os dois ativos');
select pg_temp.logout();
update public.accounts set suspended_at = now() where id = '93000000-0000-0000-0000-0000000000c1';
select pg_temp.login('93000000-0000-0000-0000-0000000000a4');
select pg_temp.fails($$select * from public.get_contact((select id from public.applications
                       where job_id = (select v from t_ids where k = 'j4')))$$, 'BC404');
select pg_temp.logout();
update public.accounts set suspended_at = null where id = '93000000-0000-0000-0000-0000000000c1';
update public.accounts set suspended_at = now() where id = '93000000-0000-0000-0000-0000000000a4';
select pg_temp.login('93000000-0000-0000-0000-0000000000c1');
select pg_temp.fails($$select * from public.get_contact((select id from public.applications
                       where job_id = (select v from t_ids where k = 'j4')))$$, 'BC404');
select pg_temp.logout();
rollback;
