-- U48 — os textos que o banco manda para a tela falam com o público geral: nenhuma mensagem, aviso ou etiqueta de
-- avaliação fala de construtora, obra ou EPI (os nomes internos, como o lado 'construtora' da candidatura, ficam).
begin;

select pg_temp.ok(not exists (
  select 1
    from unnest(array['Não vá até a obra', 'A construtora de ', 'Só a conta de construtora', 'Só a construtora da vaga',
                      'quando a construtora aprova', 'A construtora ainda não', 'CEP da obra', 'endereço da obra',
                      'Construtora não encontrada', 'removida pela construtora', 'EPI no local', 'Usou EPI',
                      'Fale com a construtora', 'A construtora já decidiu', '''obra''']) as f(frase)
    join pg_proc p on p.pronamespace = 'public'::regnamespace and p.prosrc like '%' || f.frase || '%'
), 'nenhuma função do app manda texto de construtora, obra ou EPI');

select pg_temp.ok((select prosrc like '%''Local seguro''%' and prosrc like '%''Cuidadoso''%'
                     from pg_proc where proname = 'submit_review'), 'etiquetas novas das avaliações');

-- Um trabalhador tentando publicar ouve "empresa".
select pg_temp.new_user('94800000-0000-0000-0000-0000000000a1', 'trabalhador', 'Quem Tenta Publicar');
select pg_temp.login('94800000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.publish_job('{}'::jsonb);
  raise exception 'FALHOU: publicar devia ser recusado';
exception when others then
  if sqlerrm <> 'Só a conta de empresa pode publicar vagas.' then
    raise exception 'FALHOU: mensagem inesperada: %', sqlerrm;
  end if;
  raise notice 'ok: a recusa fala de empresa';
end $$;
select pg_temp.logout();

rollback;
