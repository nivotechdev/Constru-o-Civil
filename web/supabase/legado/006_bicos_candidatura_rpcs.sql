-- Fase 3 do front novo (Bicos): as três transições de status de candidatura
-- que precisam ser atômicas (mexem em mais de uma linha, ou decidem o que
-- outra pessoa vê) viram RPC — nunca um update direto do cliente na tabela.
-- Isso também é por que `candidaturas` não ganhou nenhuma policy de UPDATE:
-- SECURITY DEFINER deixa a função mexer na tabela sem depender de RLS, desde
-- que a própria função confira "quem pode fazer o quê" explicitamente.
--
-- Reverter: drop function if exists public.decidir_candidatura(uuid, text);
--           drop function if exists public.fechar_vaga(uuid);
--           drop function if exists public.concluir_candidatura(uuid);

-- Construtora aprova ou recusa um candidato. Ao aprovar, se as vagas
-- (slots) da vaga lotarem, rejeita automaticamente o restante dos
-- candidatos ainda pendentes — mesmo comportamento do mock (decideApplication).
create or replace function public.decidir_candidatura(p_candidatura_id uuid, p_decisao text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_vaga_id uuid;
  v_autor_id uuid;
  v_slots int;
  v_aprovados int;
  v_novo_status text;
begin
  select c.vaga_id, v.autor_id, coalesce(v.slots, 1)
    into v_vaga_id, v_autor_id, v_slots
  from public.candidaturas c
  join public.vagas v on v.id = c.vaga_id
  where c.id = p_candidatura_id;

  if v_vaga_id is null then
    raise exception 'Candidatura não encontrada.';
  end if;
  if auth.uid() <> v_autor_id then
    raise exception 'Você não tem permissão para decidir sobre esta candidatura.' using errcode = '42501';
  end if;

  v_novo_status := case p_decisao
    when 'aprovado' then 'pre_selecionado'
    when 'recusado' then 'nao_selecionado'
    else 'em_analise'
  end;

  update public.candidaturas set status = v_novo_status where id = p_candidatura_id;

  if p_decisao = 'aprovado' then
    select count(*) into v_aprovados from public.candidaturas
      where vaga_id = v_vaga_id and status in ('pre_selecionado', 'contratado');

    if v_aprovados >= v_slots then
      update public.candidaturas
        set status = 'nao_selecionado'
        where vaga_id = v_vaga_id and status in ('enviada', 'em_analise');
    end if;
  end if;
end;
$$;

grant execute on function public.decidir_candidatura(uuid, text) to authenticated;

-- Construtora encerra a vaga manualmente (com ou sem ninguém contratado) —
-- marca `sem_contratacao` conforme o caso e rejeita quem ainda estava pendente.
create or replace function public.fechar_vaga(p_vaga_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_autor_id uuid;
  v_contratou boolean;
begin
  select autor_id into v_autor_id from public.vagas where id = p_vaga_id;
  if v_autor_id is null then
    raise exception 'Vaga não encontrada.';
  end if;
  if auth.uid() <> v_autor_id then
    raise exception 'Você não tem permissão para encerrar esta vaga.' using errcode = '42501';
  end if;

  select exists(
    select 1 from public.candidaturas
    where vaga_id = p_vaga_id and status in ('pre_selecionado', 'contratado')
  ) into v_contratou;

  update public.vagas set status = 'preenchida', sem_contratacao = not v_contratou where id = p_vaga_id;

  update public.candidaturas
    set status = 'nao_selecionado'
    where vaga_id = p_vaga_id and status in ('enviada', 'em_analise');
end;
$$;

grant execute on function public.fechar_vaga(uuid) to authenticated;

-- Trabalhador marca a própria diária (já contratada) como concluída.
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
    where id = p_candidatura_id and status = 'contratado';
end;
$$;

grant execute on function public.concluir_candidatura(uuid) to authenticated;
