-- F16: portfólio — legenda de até 280 caracteres e editável pelo dono do post.

do $$ begin
  alter table public.worker_posts add constraint worker_posts_caption_length check (char_length(caption) <= 280) not valid;
exception when duplicate_object then null;
end $$;

grant update (caption) on public.worker_posts to authenticated;
drop policy if exists "Trabalhador edita a legenda do próprio post" on public.worker_posts;
create policy "Trabalhador edita a legenda do próprio post" on public.worker_posts
  for update to authenticated
  using (worker_id = (select public.my_worker_id()))
  with check (worker_id = (select public.my_worker_id()));
