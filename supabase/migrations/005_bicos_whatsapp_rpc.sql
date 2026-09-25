-- Fase 3 do front novo (Bicos): libera o WhatsApp de contato só depois que a
-- candidatura avança para pré-selecionado (ou adiante) — nunca antes, e nunca
-- por select direto em `profiles` (a coluna whatsapp não tem policy de select
-- nenhuma, então só esta função consegue devolvê-la).
--
-- Reverter: drop function if exists public.contato_whatsapp(uuid);

create or replace function public.contato_whatsapp(p_candidatura_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_candidato_id uuid;
  v_autor_id uuid;
  v_status text;
  v_quem_pede_id uuid;
  v_alvo_id uuid;
  v_whatsapp text;
begin
  select c.candidato_id, v.autor_id, c.status
    into v_candidato_id, v_autor_id, v_status
  from public.candidaturas c
  join public.vagas v on v.id = c.vaga_id
  where c.id = p_candidatura_id;

  if v_candidato_id is null then
    return null; -- candidatura não existe
  end if;

  -- Só quem participa desta candidatura específica pode pedir o contato do outro lado.
  if auth.uid() = v_candidato_id then
    v_quem_pede_id := v_candidato_id;
    v_alvo_id := v_autor_id;
  elsif auth.uid() = v_autor_id then
    v_quem_pede_id := v_autor_id;
    v_alvo_id := v_candidato_id;
  else
    return null;
  end if;

  if v_status not in ('pre_selecionado', 'contratado', 'concluida', 'avaliada') then
    return null; -- ainda não foi pré-selecionado/contratado — contato continua fechado
  end if;

  select whatsapp into v_whatsapp from public.profiles where id = v_alvo_id;
  return v_whatsapp;
end;
$$;

grant execute on function public.contato_whatsapp(uuid) to authenticated;

comment on function public.contato_whatsapp(uuid) is
  'Devolve o WhatsApp do outro lado de uma candidatura específica, só para quem participa '
  'dela e só a partir de pre_selecionado — único caminho que expõe profiles.whatsapp.';
