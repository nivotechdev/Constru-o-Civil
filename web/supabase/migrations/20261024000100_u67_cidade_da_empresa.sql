-- U67 — a empresa volta a ter a sua cidade (só a cidade, sem endereço — U62): no cadastro ("Usar minha localização
-- atual" ou digitada) e em Editar perfil (update de companies.location, que já era liberado). O mural da empresa abre
-- nessa cidade. finish_sign_up grava p.city na empresa; sem cidade, só completa o perfil, como no U62. Idempotente.

create or replace function public.finish_sign_up(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account public.accounts;
  v_city text := btrim(coalesce(p->>'city', ''));
  v_lat double precision;
  v_lon double precision;
begin
  select * into v_account from public.accounts where id = auth.uid();
  if not found then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if v_account.role = 'trabalhador' then
    if jsonb_typeof(p->'address') = 'object' then
      perform public.save_address(v_account.id, p->'address');
    else
      begin
        v_lat := round((p->>'lat')::numeric, 2);
        v_lon := round((p->>'lon')::numeric, 2);
      exception when others then
        v_lat := null;
      end;
      if v_city = '' or char_length(v_city) > 80 or v_lat is null or v_lon is null
         or v_lat not between -34 and 6 or v_lon not between -74 and -34 then
        raise exception using errcode = 'BC422', message = 'Informe seu endereço para continuar.';
      end if;
      update public.workers set city = v_city, neighborhood = null, lat = v_lat, lon = v_lon
       where id = v_account.worker_id;
    end if;
  elsif v_city <> '' then
    -- U67: a empresa guarda só a cidade onde está ("Caxias do Sul, RS"); é onde o mural dela abre.
    if char_length(v_city) > 80 or v_city !~ ', [A-Z]{2}$' then
      raise exception using errcode = 'BC422', message = 'Escolha a cidade na lista.';
    end if;
    update public.companies set location = v_city where id = v_account.company_id;
  end if;
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
end;
$$;
revoke all on function public.finish_sign_up(jsonb) from public, anon;
grant execute on function public.finish_sign_up(jsonb) to authenticated;
