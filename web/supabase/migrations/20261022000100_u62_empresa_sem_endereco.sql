-- U62 — a empresa não tem endereço fixo: o cadastro e o Editar perfil da empresa não pedem mais endereço, e os
-- endereços de empresa já gravados (U51) são apagados. O endereço de cada vaga continua na própria vaga.
--   * finish_sign_up(p): para a empresa só completa o perfil (ignora endereço, cidade e ponto);
--   * set_my_address(p): só para o trabalhador (empresa → BC422);
--   * apaga de addresses as linhas das contas de empresa.

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
  end if;
  update public.accounts set profile_completed_at = coalesce(profile_completed_at, now()) where id = v_account.id;
end;
$$;
revoke all on function public.finish_sign_up(jsonb) from public, anon;
grant execute on function public.finish_sign_up(jsonb) to authenticated;

create or replace function public.set_my_address(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'BC401', message = 'Entre na sua conta de novo para continuar.';
  end if;
  if exists (select 1 from public.accounts where id = auth.uid() and role <> 'trabalhador') then
    raise exception using errcode = 'BC422', message = 'A empresa não tem endereço fixo: o endereço vai em cada vaga.';
  end if;
  perform public.save_address(auth.uid(), p);
end;
$$;
revoke all on function public.set_my_address(jsonb) from public, anon;
grant execute on function public.set_my_address(jsonb) to authenticated;

delete from public.addresses a
 using public.accounts c
 where c.id = a.account_id and c.role <> 'trabalhador';
