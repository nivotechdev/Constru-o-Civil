-- AUD-135 — os limites diários tomam uma trava por conta antes de contar (a prova com 60 chamadas ao mesmo tempo foi feita
-- à mão no banco local: sem a trava passou de 20 denúncias; com ela, 5 rodadas de 60 deram sempre 20).
begin;
select pg_temp.ok(pg_get_functiondef('public.limit_application_spam()'::regprocedure) like '%pg_advisory_xact_lock%',
                  'candidaturas: trava por trabalhador');
select pg_temp.ok(pg_get_functiondef('public.invite_worker(text,uuid)'::regprocedure) like '%pg_advisory_xact_lock%',
                  'convites: trava por empresa');
select pg_temp.ok(pg_get_functiondef('public.report_content(public.report_target,text,text,text)'::regprocedure) like '%pg_advisory_xact_lock%',
                  'denúncias: trava por conta');
rollback;
