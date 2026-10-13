-- F07 — enviar identidade, a equipe decide, o selo acompanha.
begin;
select pg_temp.new_user('80400000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quer O Selo');
select pg_temp.login('80400000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.submit_identity('outro/selfie.jpg', 'outro/doc.jpg')$$, 'BC422');
select public.submit_identity('80400000-0000-0000-0000-0000000000a1/selfie.jpg', '80400000-0000-0000-0000-0000000000a1/doc.jpg');
select pg_temp.ok((select status = 'em_analise' from public.my_identity()), 'em análise');
select pg_temp.fails($$select public.submit_identity('80400000-0000-0000-0000-0000000000a1/a.jpg', '80400000-0000-0000-0000-0000000000a1/b.jpg')$$, 'BC409');
select pg_temp.fails($$select * from public.identity_submissions$$, '42501');
select pg_temp.fails($$select public.set_identity_status('80400000-0000-0000-0000-0000000000a1', 'verificado')$$, '42501');
select pg_temp.logout();

select public.set_identity_status('80400000-0000-0000-0000-0000000000a1', 'recusado', 'Foto do documento ilegível');
select pg_temp.ok((select not verified and identity_reason = 'Foto do documento ilegível' from public.workers
                    where id = '80400000-0000-0000-0000-0000000000a1'), 'recusado com motivo, sem selo');
select pg_temp.login('80400000-0000-0000-0000-0000000000a1');
select public.submit_identity('80400000-0000-0000-0000-0000000000a1/s2.jpg', '80400000-0000-0000-0000-0000000000a1/d2.jpg');
select pg_temp.logout();
select public.set_identity_status('80400000-0000-0000-0000-0000000000a1', 'verificado');
select pg_temp.ok((select verified from public.workers where id = '80400000-0000-0000-0000-0000000000a1'), 'verificado com selo');
select pg_temp.ok(exists (select 1 from public.notifications where worker_id = '80400000-0000-0000-0000-0000000000a1'
                            and title = 'Identidade verificada'), 'avisado');
rollback;
