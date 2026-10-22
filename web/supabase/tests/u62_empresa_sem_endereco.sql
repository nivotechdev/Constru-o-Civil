-- U62 — a empresa não tem endereço fixo: o cadastro completa o perfil sem endereço, não grava endereço mesmo se vier,
-- e o Editar perfil não aceita endereço de empresa. O trabalhador continua como no U51.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-0000000006e1', 'recrutador', 'Empresa Sem Endereço', '51.826.049/0001-39');
select pg_temp.new_user('96000000-0000-0000-0000-0000000006e2', 'trabalhador', 'Ana Com Endereço');
update public.accounts set profile_completed_at = null
 where id in ('96000000-0000-0000-0000-0000000006e1', '96000000-0000-0000-0000-0000000006e2');

select pg_temp.login('96000000-0000-0000-0000-0000000006e1');
select public.finish_sign_up('{}');
select public.finish_sign_up(jsonb_build_object('address', jsonb_build_object(
  'cep', '95010-000', 'street', 'Avenida Júlio de Castilhos', 'neighborhood', 'Centro', 'city', 'Caxias do Sul',
  'uf', 'RS', 'lat', -29.1678, 'lon', -51.1794)));
select pg_temp.fails($$select public.set_my_address(jsonb_build_object(
  'cep', '95010-000', 'street', 'Avenida Júlio de Castilhos', 'neighborhood', 'Centro', 'city', 'Caxias do Sul',
  'uf', 'RS', 'lat', -29.1678, 'lon', -51.1794))$$, 'BC422');
select pg_temp.logout();
select pg_temp.ok((select profile_completed_at is not null from public.accounts where id = '96000000-0000-0000-0000-0000000006e1'),
                  'a empresa completa o perfil sem endereço');
select pg_temp.ok(not exists (select 1 from public.addresses where account_id = '96000000-0000-0000-0000-0000000006e1'),
                  'nenhum endereço de empresa é gravado');

select pg_temp.login('96000000-0000-0000-0000-0000000006e2');
select pg_temp.fails($$select public.finish_sign_up('{}')$$, 'BC422');
select public.finish_sign_up(jsonb_build_object('address', jsonb_build_object(
  'cep', '95020000', 'street', 'Rua Sinimbu', 'neighborhood', 'Centro', 'city', 'Caxias do Sul', 'uf', 'RS',
  'lat', -29.1688, 'lon', -51.1787)));
select pg_temp.logout();
select pg_temp.ok(exists (select 1 from public.addresses where account_id = '96000000-0000-0000-0000-0000000006e2'),
                  'o trabalhador continua gravando o endereço');
rollback;
