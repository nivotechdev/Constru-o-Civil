-- L06 (lançamento) — back-office: só a equipe lê e chama o admin; filas, decisões, auditoria e suspensão.
begin;
select pg_temp.new_user('86000000-0000-0000-0000-0000000000e1', 'trabalhador', 'Pessoa Da Equipe');
select pg_temp.new_user('86000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quer O Selo');
select pg_temp.new_user('86000000-0000-0000-0000-0000000000a2', 'trabalhador', 'Denunciado');
select pg_temp.new_user('86000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Pendente', '11.222.333/0001-81');
create temp table t_ids (k text primary key, v text);
grant all on t_ids to authenticated;
insert into t_ids values ('j', pg_temp.new_job('86000000-0000-0000-0000-0000000000c1'));

-- Ninguém nasce da equipe: nada do admin para conta comum nem para visitante.
select pg_temp.login('86000000-0000-0000-0000-0000000000a1');
select pg_temp.ok(not public.is_staff(), 'conta comum não é da equipe');
select pg_temp.fails($$select * from public.admin_identity_queue()$$, 'BC401');
select pg_temp.fails($$select * from public.admin_company_queue()$$, 'BC401');
select pg_temp.fails($$select * from public.admin_report_queue('aberta')$$, 'BC401');
select pg_temp.fails($$select * from public.admin_actions(10)$$, 'BC401');
select pg_temp.fails($$select public.admin_decide_identity('86000000-0000-0000-0000-0000000000a1', 'verificado', null)$$, 'BC401');
select pg_temp.fails($$select public.admin_decide_company('86000000-0000-0000-0000-0000000000c1', 'verificada', null)$$, 'BC401');
select pg_temp.fails($$select public.admin_hide_job((select v from t_ids where k = 'j'), 'teste')$$, 'BC401');
select pg_temp.fails($$select public.admin_suspend_account('86000000-0000-0000-0000-0000000000a2', 'teste')$$, 'BC401');
select pg_temp.fails($$select public.admin_unsuspend_account('86000000-0000-0000-0000-0000000000a2', null)$$, 'BC401');
select pg_temp.fails($$select public.admin_resolve_report(gen_random_uuid(), 'arquivar', null)$$, 'BC401');
select pg_temp.fails($$select public.admin_unhide_job((select v from t_ids where k = 'j'), null)$$, 'BC401');
select pg_temp.fails($$select * from public.staff_members$$, '42501');
select pg_temp.fails($$select * from public.staff_actions$$, '42501');
select pg_temp.fails($$select public.add_staff_member('teste+86000000-0000-0000-0000-0000000000a1@bicos.test', 'admin')$$, '42501');
select pg_temp.fails($$select public.staff_log('x', 'y', 'z', null)$$, '42501');
select pg_temp.fails($$select public.account_history('86000000-0000-0000-0000-0000000000a2')$$, '42501');
select pg_temp.fails($$select public.report_target_info('vaga', 'BC-1')$$, '42501');
select pg_temp.fails($$select suspended_reason from public.accounts$$, '42501');
-- A selfie e o documento continuam fechados para quem não é da equipe.
select public.submit_identity('86000000-0000-0000-0000-0000000000a1/selfie.jpg', '86000000-0000-0000-0000-0000000000a1/doc.jpg', '1.0');
select public.report_content('vaga', (select v from t_ids where k = 'j'), 'golpe', 'Pediu PIX adiantado');
select public.report_content('perfil', '86000000-0000-0000-0000-0000000000a2', 'ofensa', null);
select pg_temp.logout();

insert into t_ids select 'rv', id::text from public.reports where target_type = 'vaga';
insert into t_ids select 'rp', id::text from public.reports where target_type = 'perfil';
insert into storage.objects (bucket_id, name, owner)
values ('identidade', '86000000-0000-0000-0000-0000000000a1/selfie.jpg', '86000000-0000-0000-0000-0000000000a1');
select pg_temp.login('86000000-0000-0000-0000-0000000000a1');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'identidade') = 0, 'nem o dono lê a própria selfie');
select pg_temp.logout();

-- Visitante (anon) não chama nada do admin.
set local role anon;
select pg_temp.fails($$select * from public.admin_identity_queue()$$, '42501');
select pg_temp.fails($$select public.is_staff()$$, '42501');
reset role;

-- A equipe entra pelo SQL Editor (service_role/dono do banco).
select public.add_staff_member('teste+86000000-0000-0000-0000-0000000000e1@bicos.test', 'admin');

select pg_temp.login('86000000-0000-0000-0000-0000000000e1');
select pg_temp.ok(public.is_staff(), 'equipe reconhecida');
select pg_temp.ok((select count(*) from storage.objects where bucket_id = 'identidade') = 1, 'equipe lê a selfie (URL assinada)');

-- Fila de identidades → recusar com motivo (obrigatório) → sai da fila.
select pg_temp.ok((select count(*) = 1 and min(selfie_path) = '86000000-0000-0000-0000-0000000000a1/selfie.jpg'
                     from public.admin_identity_queue()), 'identidade na fila com as fotos');
select pg_temp.fails($$select public.admin_decide_identity('86000000-0000-0000-0000-0000000000a1', 'recusado', '  ')$$, 'BC422');
select public.admin_decide_identity('86000000-0000-0000-0000-0000000000a1', 'recusado', 'Documento ilegível');
select pg_temp.ok((select count(*) from public.admin_identity_queue()) = 0, 'decidida sai da fila');
select pg_temp.fails($$select public.admin_decide_identity('86000000-0000-0000-0000-0000000000a1', 'verificado', null)$$, 'BC409');

-- Fila de construtoras: CNPJ inteiro para conferir → aprovar.
select pg_temp.ok((select document = '11222333000181' and document_kind = 'cnpj' from public.admin_company_queue()
                    where company_id = '86000000-0000-0000-0000-0000000000c1'), 'construtora pendente com CNPJ');
select pg_temp.fails($$select public.admin_decide_company('86000000-0000-0000-0000-0000000000c1', 'reprovada', null)$$, 'BC422');
select public.admin_decide_company('86000000-0000-0000-0000-0000000000c1', 'verificada', null);
select pg_temp.ok((select count(*) from public.admin_company_queue() where company_id = '86000000-0000-0000-0000-0000000000c1') = 0,
                  'aprovada sai da fila');

-- Fila de denúncias: conteúdo + conta + histórico; ocultar a vaga.
select pg_temp.ok((select count(*) from public.admin_report_queue('aberta')) = 2, 'duas denúncias abertas');
select pg_temp.ok((select target ->> 'account_id' = '86000000-0000-0000-0000-0000000000c1'
                          and (account ->> 'jobs')::int = 1 and target ->> 'title' is not null
                     from public.admin_report_queue('aberta') where target_type = 'vaga'), 'denúncia mostra vaga, conta e histórico');
select public.admin_resolve_report((select v::uuid from t_ids where k = 'rv'), 'ocultar_vaga', 'Golpe confirmado');
select pg_temp.fails($$select public.admin_resolve_report((select v::uuid from t_ids where k = 'rv'), 'arquivar', null)$$, 'BC409');
select pg_temp.fails($$select public.admin_resolve_report((select v::uuid from t_ids where k = 'rp'), 'ocultar_vaga', null)$$, 'BC422');
select pg_temp.fails($$select public.admin_suspend_account('86000000-0000-0000-0000-0000000000e1', 'eu mesma')$$, 'BC409');
select pg_temp.logout();

select pg_temp.ok((select hidden_at is not null from public.jobs where id = (select v from t_ids where k = 'j')), 'vaga oculta');
select pg_temp.ok(public.public_job_card((select public_slug from public.jobs where id = (select v from t_ids where k = 'j'))) is null, 'link público não abre a vaga oculta');
select pg_temp.ok(exists (select 1 from public.notifications where company_id = '86000000-0000-0000-0000-0000000000c1'
                            and title = 'Vaga retirada do mural'), 'construtora avisada');
select pg_temp.login('86000000-0000-0000-0000-0000000000a2');
select pg_temp.ok((select count(*) from public.jobs where id = (select v from t_ids where k = 'j')) = 0, 'outra pessoa não vê a vaga oculta');
select pg_temp.fails($$select public.submit_application((select v from t_ids where k = 'j'))$$, 'BC409');
select pg_temp.logout();
select pg_temp.login('86000000-0000-0000-0000-0000000000c1');
select pg_temp.ok((select count(*) from public.jobs where id = (select v from t_ids where k = 'j')) = 1, 'a dona ainda vê a vaga');
select pg_temp.logout();

-- Suspender a conta denunciada: não entra, não se candidata; a construtora suspensa não publica.
select pg_temp.login('86000000-0000-0000-0000-0000000000e1');
select public.admin_resolve_report((select v::uuid from t_ids where k = 'rp'), 'suspender_conta', 'Ofensas repetidas');
select public.admin_unhide_job((select v from t_ids where k = 'j'), 'Engano');
select public.admin_suspend_account('86000000-0000-0000-0000-0000000000c1', 'Teste de suspensão de construtora');
select pg_temp.logout();

select pg_temp.ok((select banned_until > now() + interval '50 years' and banned_until <> 'infinity' from auth.users where id = '86000000-0000-0000-0000-0000000000a2'), 'login bloqueado no Auth');
select pg_temp.ok((select suspended_at is not null from public.accounts where id = '86000000-0000-0000-0000-0000000000a2'), 'conta marcada como suspensa');
select pg_temp.ok((select hidden_reason = 'conta suspensa' from public.jobs where id = (select v from t_ids where k = 'j')), 'vagas da construtora suspensa saem do mural');
select pg_temp.fails($$select pg_temp.new_job('86000000-0000-0000-0000-0000000000c1')$$, 'BC401');

select pg_temp.login('86000000-0000-0000-0000-0000000000a2');
select pg_temp.ok((select suspended_at is not null from public.accounts where id = '86000000-0000-0000-0000-0000000000a2'), 'a conta sabe que está suspensa');
select pg_temp.logout();

select pg_temp.new_user('86000000-0000-0000-0000-0000000000c2', 'recrutador', 'Outra Obra', '45.723.174/0001-10');
insert into t_ids values ('j2', pg_temp.new_job('86000000-0000-0000-0000-0000000000c2'));
select pg_temp.login('86000000-0000-0000-0000-0000000000a2');
select pg_temp.fails($$select public.submit_application((select v from t_ids where k = 'j2'))$$, 'BC401');
select pg_temp.logout();

-- Reativar devolve tudo; cada ação ficou no registro de auditoria.
select pg_temp.login('86000000-0000-0000-0000-0000000000e1');
select public.admin_unsuspend_account('86000000-0000-0000-0000-0000000000a2', 'Conversamos');
select public.admin_unsuspend_account('86000000-0000-0000-0000-0000000000c1', null);
select pg_temp.ok((select array_agg(action order by id) from public.admin_actions(50)) =
  array['recusar_identidade', 'aprovar_construtora', 'ocultar_vaga', 'suspender_conta', 'mostrar_vaga',
        'suspender_conta', 'reativar_conta', 'reativar_conta']::text[], 'auditoria registra cada ação, em ordem');
select pg_temp.ok((select reason from public.admin_actions(50) where action = 'recusar_identidade') = 'Documento ilegível',
                  'auditoria guarda o motivo');
select pg_temp.ok((select bool_and(staff_email = 'teste+86000000-0000-0000-0000-0000000000e1@bicos.test') from public.admin_actions(50)),
                  'auditoria guarda quem fez');
select pg_temp.logout();
select pg_temp.ok((select banned_until is null from auth.users where id = '86000000-0000-0000-0000-0000000000a2'), 'login liberado');
select pg_temp.ok((select hidden_at is null from public.jobs where id = (select v from t_ids where k = 'j')), 'vagas voltam ao mural');
select pg_temp.login('86000000-0000-0000-0000-0000000000a2');
select public.submit_application((select v from t_ids where k = 'j2'));
select pg_temp.logout();
rollback;
