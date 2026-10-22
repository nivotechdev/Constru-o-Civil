-- U51 — o endereço da conta: só ela lê, só a RPC grava, os outros continuam vendo só a cidade (e o ponto de ~1 km do
-- trabalhador); o ponto que todos veem da vaga fica a 100–200 m do exato.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-0000000005a1', 'trabalhador', 'Ana Endereço');
select pg_temp.new_user('96000000-0000-0000-0000-0000000005a2', 'trabalhador', 'Bruno Vizinho');
select pg_temp.new_user('96000000-0000-0000-0000-0000000005c1', 'recrutador', 'Empresa Endereço', '51.826.049/0001-39');

select pg_temp.login('96000000-0000-0000-0000-0000000005a1');
select public.set_my_address(jsonb_build_object(
  'cep', '95020000', 'street', '  Rua   Sinimbu ', 'neighborhood', 'Centro', 'city', 'Caxias do Sul', 'uf', 'rs',
  'lat', -29.1687960, 'lon', -51.1787011, 'precision', 'rua'));
select pg_temp.ok((select cep = '95020-000' and street = 'Rua Sinimbu' and uf = 'RS' and precision = 'rua'
                     and lat = -29.168796 from public.addresses), 'a conta grava o próprio endereço, limpo');
select pg_temp.ok((select city = 'Caxias do Sul, RS' and lat = -29.17 and lon = -51.18 and neighborhood is null
                     from public.workers where id = '96000000-0000-0000-0000-0000000005a1'),
                  'o perfil público fica só com a cidade e o ponto arredondado');
select public.set_my_address(jsonb_build_object(
  'cep', '95084-470', 'street', 'Rua Os 18 do Forte', 'neighborhood', 'São Pelegrino', 'city', 'Caxias do Sul',
  'uf', 'RS', 'lat', -29.1641, 'lon', -51.1893, 'precision', 'numero'));
select pg_temp.ok((select count(*) = 1 and bool_and(street = 'Rua Os 18 do Forte') from public.addresses),
                  'trocar o endereço mantém uma linha só');
select pg_temp.fails($$select public.set_my_address('{"cep":"9502","street":"Rua A","neighborhood":"Centro","city":"Caxias do Sul","uf":"RS","lat":-29.1,"lon":-51.1}')$$, 'BC422');
select pg_temp.fails($$select public.set_my_address('{"cep":"95020000","street":"","neighborhood":"Centro","city":"Caxias do Sul","uf":"RS","lat":-29.1,"lon":-51.1}')$$, 'BC422');
select pg_temp.fails($$select public.set_my_address('{"cep":"95020000","street":"Rua A","neighborhood":"Centro","city":"Caxias do Sul","uf":"XX","lat":-29.1,"lon":-51.1}')$$, 'BC422');
select pg_temp.fails($$select public.set_my_address('{"cep":"95020000","street":"Rua A","neighborhood":"Centro","city":"Lisboa","uf":"RS","lat":38.7,"lon":-9.1}')$$, 'BC422');
select pg_temp.fails($$insert into public.addresses (account_id, cep, street, neighborhood, city, uf, lat, lon) values ('96000000-0000-0000-0000-0000000005a1', '95020-000', 'Rua A', 'Centro', 'Caxias', 'RS', -29.1, -51.1)$$, '42501');
select pg_temp.fails($$update public.addresses set lat = 0$$, '42501');
select pg_temp.ok((public.export_my_data()->'endereco'->>'street') = 'Rua Os 18 do Forte', 'o endereço sai em "baixar meus dados"');

select pg_temp.login('96000000-0000-0000-0000-0000000005a2');
select pg_temp.ok(not exists (select 1 from public.addresses), 'outra conta não vê o endereço da Ana');
select pg_temp.logout();

set local role anon;
select pg_temp.fails($$select public.set_my_address('{}')$$, '42501');
select pg_temp.fails($$select * from public.addresses$$, '42501');
reset role;

-- O cadastro manda o endereço (e o formato antigo, cidade e ponto, ainda vale).
update public.accounts set profile_completed_at = null where id = '96000000-0000-0000-0000-0000000005c1';
select pg_temp.login('96000000-0000-0000-0000-0000000005c1');
select public.finish_sign_up(jsonb_build_object('address', jsonb_build_object(
  'cep', '95010-000', 'street', 'Avenida Júlio de Castilhos', 'neighborhood', 'Centro', 'city', 'Caxias do Sul',
  'uf', 'RS', 'lat', -29.1678, 'lon', -51.1794)));
select pg_temp.logout();
-- U62: a empresa não tem endereço fixo — o cadastro só completa o perfil.
select pg_temp.ok((select profile_completed_at is not null from public.accounts where id = '96000000-0000-0000-0000-0000000005c1')
                  and not exists (select 1 from public.addresses where account_id = '96000000-0000-0000-0000-0000000005c1'),
                  'o cadastro da empresa completa o perfil sem gravar endereço');
select pg_temp.login('96000000-0000-0000-0000-0000000005a2');
select public.finish_sign_up('{"city":"Farroupilha, RS","lat":-29.2251,"lon":-51.3478}');
select pg_temp.fails($$select public.finish_sign_up('{}')$$, 'BC422');
select pg_temp.logout();
select pg_temp.ok((select city = 'Farroupilha, RS' and lat = -29.23 from public.workers where id = '96000000-0000-0000-0000-0000000005a2'),
                  'o formato antigo do cadastro continua aceito');

-- O ponto que todos veem da vaga: 100 a 200 m do exato; não muda num update que não mexe no endereço.
create temp table t_ids (k text primary key, v text);
insert into t_ids values ('j', pg_temp.new_job('96000000-0000-0000-0000-0000000005c1'));
select pg_temp.ok((select st_distance(area_geog, st_setsrid(st_makepoint(lon, lat), 4326)::geography) between 95 and 205
                     from public.jobs where id = (select v from t_ids)), 'o ponto público fica entre 100 e 200 m do exato');
select pg_temp.ok((select area_geog = st_setsrid(st_makepoint(area_lon, area_lat), 4326)::geography
                     from public.jobs where id = (select v from t_ids)), 'area_geog é o ponto público');
create temp table antes as select area_lat, area_lon from public.jobs where id = (select v from t_ids);
update public.jobs set description = 'Outra descrição do serviço', area_lat = 0 where id = (select v from t_ids);
select pg_temp.ok((select j.area_lat = a.area_lat and j.area_lon = a.area_lon from public.jobs j, antes a
                    where j.id = (select v from t_ids)),
                  'mudar outra coisa (ou o próprio ponto público) não move o ponto público');
update public.jobs set lat = lat + 0.02 where id = (select v from t_ids);
select pg_temp.ok((select st_distance(area_geog, st_setsrid(st_makepoint(lon, lat), 4326)::geography) between 95 and 205
                     from public.jobs where id = (select v from t_ids)), 'um endereço novo sorteia um ponto novo perto dele');

delete from auth.users where id = '96000000-0000-0000-0000-0000000005a1';
select pg_temp.ok(not exists (select 1 from public.addresses where account_id = '96000000-0000-0000-0000-0000000005a1'),
                  'a exclusão da conta leva o endereço junto');
rollback;
