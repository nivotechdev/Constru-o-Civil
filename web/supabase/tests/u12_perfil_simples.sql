-- U12 — completar o perfil só com a localização; ofício, especialidades e tipo de obra saíram do banco.
begin;

select pg_temp.ok(not exists (select 1 from information_schema.columns where table_schema = 'public'
                               and ((table_name = 'workers' and column_name in ('oficio_id', 'specialties'))
                                 or (table_name = 'companies' and column_name = 'tipo_obra'))),
  'ofício, especialidades e tipo de obra saíram das tabelas');

select pg_temp.new_user('78000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Perfil Simples');
select pg_temp.new_user('78000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Simples');
update public.accounts set profile_completed_at = null
 where id in ('78000000-0000-0000-0000-0000000000a1', '78000000-0000-0000-0000-0000000000c1');

-- Sem a localização, ou fora do Brasil: recusado.
select pg_temp.login('78000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.finish_sign_up('{"city": "Caxias do Sul, RS"}')$$, 'BC422');
select pg_temp.fails($$select public.finish_sign_up('{"city": "", "lat": -29.17, "lon": -51.18}')$$, 'BC422');
select pg_temp.fails($$select public.finish_sign_up('{"city": "Lisboa", "lat": 38.72, "lon": -9.14}')$$, 'BC422');
-- Com a localização atual: guarda a cidade e o ponto arredondado (~1 km), e o perfil fica completo.
select public.finish_sign_up('{"city": "Caxias do Sul, RS", "lat": -29.168123, "lon": -51.179456}');
select pg_temp.logout();
select pg_temp.ok((select city = 'Caxias do Sul, RS' and lat = -29.17 and lon = -51.18 and neighborhood is null
                     from public.workers where id = '78000000-0000-0000-0000-0000000000a1'), 'trabalhador: cidade e ponto');
select pg_temp.ok((select profile_completed_at is not null from public.accounts where id = '78000000-0000-0000-0000-0000000000a1'),
  'perfil completo');

select pg_temp.login('78000000-0000-0000-0000-0000000000c1');
select public.finish_sign_up('{"city": "Caxias do Sul, RS", "lat": -29.17, "lon": -51.18}');
select pg_temp.logout();
-- U62: a empresa não tem endereço fixo — completa o perfil sem gravar cidade nem endereço.
select pg_temp.ok((select profile_completed_at is not null from public.accounts where id = '78000000-0000-0000-0000-0000000000c1'),
  'empresa: perfil completo sem endereço');

rollback;
