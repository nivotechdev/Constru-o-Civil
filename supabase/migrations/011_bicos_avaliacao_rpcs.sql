-- Fase 5 do front novo (Bicos): RPC que grava a avaliação e, no mesmo passo
-- atômico, marca a candidatura como avaliada.
--
-- Também ajusta concluir_candidatura (fase 3): nenhuma tela deste app chega
-- a marcar uma candidatura como 'contratado' — pre_selecionado já é, na
-- prática, o estado final de "foi escolhido" em toda a UI (JobManage,
-- Selected, JobClosed tratam os dois como sinônimo). Sem esse ajuste,
-- "concluir diária" nunca teria uma candidatura elegível pra concluir, e
-- "avaliar" ficaria inalcançável por qualquer conta real.
--
-- Reverter:
--   drop function if exists public.postar_avaliacao(uuid, int, text);
--   -- e recriar concluir_candidatura() exigindo só status = 'contratado'
--   -- (ver supabase/migrations/006_bicos_candidatura_rpcs.sql)

create or replace function public.concluir_candidatura(p_candidatura_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_candidato_id uuid;
begin
  select candidato_id into v_candidato_id from public.candidaturas where id = p_candidatura_id;
  if v_candidato_id is null then
    raise exception 'Candidatura não encontrada.';
  end if;
  if auth.uid() <> v_candidato_id then
    raise exception 'Você não tem permissão para concluir esta candidatura.' using errcode = '42501';
  end if;

  update public.candidaturas set status = 'concluida'
    where id = p_candidatura_id and status in ('pre_selecionado', 'contratado');
end;
$$;

create or replace function public.postar_avaliacao(p_candidatura_id uuid, p_nota int, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_candidato_id uuid;
  v_autor_id uuid;
  v_status text;
  v_avaliado_id uuid;
begin
  select c.candidato_id, v.autor_id, c.status
    into v_candidato_id, v_autor_id, v_status
  from public.candidaturas c
  join public.vagas v on v.id = c.vaga_id
  where c.id = p_candidatura_id;

  if v_candidato_id is null then
    raise exception 'Candidatura não encontrada.';
  end if;
  if v_status <> 'concluida' then
    raise exception 'Só é possível avaliar depois que a diária for concluída.';
  end if;

  if auth.uid() = v_candidato_id then
    v_avaliado_id := v_autor_id;
  elsif auth.uid() = v_autor_id then
    v_avaliado_id := v_candidato_id;
  else
    raise exception 'Você não participou desta candidatura.' using errcode = '42501';
  end if;

  insert into public.avaliacoes (candidatura_id, avaliador_id, avaliado_id, nota, comentario)
  values (p_candidatura_id, auth.uid(), v_avaliado_id, p_nota, p_comentario);

  update public.candidaturas set status = 'avaliada' where id = p_candidatura_id;
end;
$$;

grant execute on function public.postar_avaliacao(uuid, int, text) to authenticated;
