-- Bicos v2 — dados e rotinas: catálogo de ofícios, bucket das fotos das vagas, rotinas agendadas
-- (pg_cron) e as contas que já existiam no app antigo.

-- ---------------------------------------------------------------------------------------------------
-- Catálogo de ofícios (src/data/oficios.ts)
-- ---------------------------------------------------------------------------------------------------

insert into public.oficios (id, nome, sinonimos) values
  ('pedreiro', 'Pedreiro', array['alvenaria', 'reboco', 'contrapiso', 'construtor']),
  ('pedreiro-acabamento', 'Pedreiro de acabamento', array['acabamento', 'massa corrida', 'acabador', 'rodapé']),
  ('servente', 'Servente', array['servente de obra', 'ajudante de pedreiro', 'auxiliar de obra', 'massa']),
  ('ajudante-geral', 'Ajudante geral', array['ajudante', 'auxiliar', 'carga e descarga', 'limpeza de obra']),
  ('pintor', 'Pintor', array['pintura', 'textura', 'grafiato', 'fachada']),
  ('eletricista', 'Eletricista', array['elétrica', 'instalação elétrica', 'fiação', 'quadro de luz']),
  ('encanador', 'Encanador', array['hidráulica', 'bombeiro hidráulico', 'encanamento', 'vazamento']),
  ('azulejista', 'Azulejista', array['revestimento', 'porcelanato', 'assentador', 'ladrilheiro', 'piso']),
  ('armador', 'Armador', array['ferragem', 'ferreiro armador', 'vergalhão', 'laje']),
  ('carpinteiro', 'Carpinteiro', array['fôrma', 'madeira', 'carpintaria', 'escoramento']),
  ('gesseiro', 'Gesseiro', array['gesso', 'drywall', 'forro', 'sanca']),
  ('telhadista', 'Telhadista', array['telhado', 'calha', 'cobertura', 'telha']),
  ('serralheiro', 'Serralheiro', array['solda', 'portão', 'estrutura metálica', 'grade']),
  ('mestre-de-obras', 'Mestre de obras', array['encarregado', 'mestre', 'líder de equipe'])
on conflict (id) do update set nome = excluded.nome, sinonimos = excluded.sinonimos;

-- ---------------------------------------------------------------------------------------------------
-- Storage: fotos das vagas. Mesmo padrão dos buckets do app antigo (avatars, portfolio): leitura
-- pública, e cada conta só grava/apaga na própria pasta (`<auth.uid()>/...`).
-- ---------------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vagas', 'vagas', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "Fotos de vaga públicas para leitura" on storage.objects;
create policy "Fotos de vaga públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'vagas');

drop policy if exists "Construtora envia foto da própria vaga" on storage.objects;
create policy "Construtora envia foto da própria vaga"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vagas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Construtora remove foto da própria vaga" on storage.objects;
create policy "Construtora remove foto da própria vaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vagas' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------------------------------
-- Rotinas agendadas (pg_cron, já usado pelo app antigo)
-- ---------------------------------------------------------------------------------------------------

-- Diárias contratadas cujo último dia passou viram "concluída" e pedem a avaliação dos dois lados.
select cron.schedule('bicos-concluir-diarias', '7 * * * *', $$ select public.conclude_finished_jobs(); $$);
-- Código PIX não pago vence em 30 minutos.
select cron.schedule('bicos-vencer-pix', '*/10 * * * *', $$ select public.expire_pix_payments(); $$);

-- ---------------------------------------------------------------------------------------------------
-- Tempo real: a notificação nova chega no sino sem recarregar (o RLS vale também aqui).
-- ---------------------------------------------------------------------------------------------------

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------------------------------------------
-- Contas que já existiam no app antigo: ganham a conta do app novo, com o perfil a completar (no
-- primeiro acesso o app pede o "Completar perfil"). Vagas e candidaturas antigas ficam no app antigo.
-- ---------------------------------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.id from public.profiles p
     where p.tipo is not null and not exists (select 1 from public.accounts a where a.id = p.id)
  loop
    perform public.account_from_old_profile(r.id);
  end loop;
end;
$$;
