-- F09: a página pública da vaga (link compartilhado), que abre sem login. Só o que o mural já mostra para
-- quem está logado: área (bairro/cidade), datas, valor, descrição, requisitos, pagamento e a construtora (nome,
-- logo, nota, selo). Nunca o endereço exato nem contato. Vaga excluída não abre.

create or replace function public.public_job_card(p_job_id text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', j.id, 'oficio_id', j.oficio_id, 'title', j.title, 'pay', j.pay,
    'neighborhood', j.neighborhood, 'city', j.city, 'uf', j.uf,
    'date_to_arrange', j.date_to_arrange, 'start_date', j.start_date, 'end_date', j.end_date,
    'start_time', j.start_time, 'end_time', j.end_time, 'diarias', j.diarias, 'dias', j.dias,
    'slots', j.slots, 'urgent', j.urgent, 'photos', j.photos, 'description', j.description,
    'requirements', j.requirements, 'payment_method', j.payment_method, 'payment_note', j.payment_note,
    'created_at', j.created_at,
    'aberta', public.job_is_open(j) and public.job_holding(j.id) < j.slots,
    'company', jsonb_build_object('name', c.name, 'logo_url', c.logo_url, 'rating', c.rating,
                                  'review_count', c.review_count, 'verified', c.verified)
  )
  from public.jobs j join public.companies c on c.id = j.company_id
  where j.id = p_job_id and j.deleted_at is null
$$;

revoke all on function public.public_job_card(text) from public;
grant execute on function public.public_job_card(text) to anon, authenticated;
