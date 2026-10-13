-- Utilidades dos testes SQL (supabase/tests/*.sql). Cada teste roda numa transação desfeita no fim
-- (`begin … rollback`), então pode rodar no banco de verdade sem deixar rastro. Cole este arquivo
-- antes do teste (o script supabase/tests/run.mjs faz isso) ou rode tudo junto no SQL Editor.
--
--   select pg_temp.login('<uuid>');           -- passa a agir como essa conta (role authenticated)
--   select pg_temp.login('<uuid>', 600);      -- idem, com o último login feito há 600 s
--   select pg_temp.logout();                  -- volta para o dono do banco (montar dados, conferir)
--   select pg_temp.new_user('<uuid>', 'trabalhador', 'Nome');  -- conta confirmada e com perfil completo
--   select pg_temp.ok(<condição>, '<o que devia acontecer>');  -- falha o teste se for falso
--   select pg_temp.fails('<sql>', '<SQLSTATE>');                -- o comando tem que falhar com esse código

create or replace function pg_temp.login(p_user uuid, p_auth_seconds_ago integer default 0)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated',
    'amr', json_build_array(json_build_object(
      'method', 'password', 'timestamp', extract(epoch from now())::bigint - p_auth_seconds_ago))
  )::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function pg_temp.logout()
returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Um CPF válido (Y17) e diferente para cada semente: 9 dígitos tirados do md5 + os dois verificadores.
create or replace function pg_temp.valid_cpf(p_seed text)
returns text language plpgsql as $$
declare
  d text := '';
  h text := md5(p_seed);
  s int;
  r int;
begin
  for i in 1..9 loop
    d := d || (('x' || substr(h, i * 2 - 1, 2))::bit(8)::int % 10)::text;
  end loop;
  foreach s in array array[9, 10] loop
    r := 0;
    for i in 1..s loop r := r + substr(d, i, 1)::int * (s + 2 - i); end loop;
    r := (r * 10) % 11;
    d := d || (case when r = 10 then 0 else r end)::text;
  end loop;
  return d;
end;
$$;

create or replace function pg_temp.new_user(p_id uuid, p_role text, p_name text, p_document text default null)
returns void language plpgsql as $$
begin
  p_document := coalesce(p_document, pg_temp.valid_cpf(p_id::text));
  insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'teste+' || p_id || '@bicos.test', now(),
          jsonb_build_object('role', p_role, 'nome', p_name, 'documento', p_document, 'whatsapp', '11988887777',
                             'terms_version', '1.0', 'maior_de_idade', true),
          now(), now());
  update public.accounts set profile_completed_at = now() where id = p_id;
  update public.workers set oficio_id = 'pedreiro' where id = p_id;
end;
$$;

create or replace function pg_temp.ok(p_condition boolean, p_what text)
returns void language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FALHOU: %', p_what;
  end if;
  raise notice 'ok: %', p_what;
end;
$$;

create or replace function pg_temp.fails(p_sql text, p_state text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate = p_state then
      raise notice 'ok: % falhou com %', left(p_sql, 80), p_state;
      return;
    end if;
    raise exception 'FALHOU: % falhou com % (%), esperado %', left(p_sql, 80), sqlstate, sqlerrm, p_state;
  end;
  raise exception 'FALHOU: % devia falhar com %', left(p_sql, 80), p_state;
end;
$$;

-- Uma vaga pronta (como o publish_job grava), com início daqui a `p_start_in` dias.
create or replace function pg_temp.new_job(p_company uuid, p_slots integer default 1, p_start_in integer default 2)
returns text language plpgsql as $$
declare
  v_id text;
begin
  insert into public.jobs (company_id, oficio_id, pay, cep, street, number, neighborhood, city, uf, lat, lon,
                           start_date, end_date, slots, description)
  values (p_company, 'pedreiro', 200, '03307-000', 'Rua Teste', '10', 'Tatuapé', 'São Paulo', 'SP',
          -23.54, -46.57, public.bicos_today() + p_start_in, public.bicos_today() + p_start_in + 1, p_slots,
          'Reboco de parede')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function pg_temp.status_of(p_job text, p_worker uuid)
returns text language sql as $$
  select status::text from public.applications where job_id = p_job and worker_id = p_worker
$$;

-- X13: funções novas do `postgres` não nascem executáveis por todos; os utilitários do teste sim.
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p where p.pronamespace = pg_my_temp_schema() loop
    execute format('grant execute on function %s to public', f.sig);
  end loop;
end $$;
