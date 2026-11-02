-- AUD-061 e AUD-072 — as validações de documento/WhatsApp não são para visitante; o cadastro novo não copia mais
-- nome e e-mail para a tabela do app antigo (profiles).
begin;
set local role anon;
select pg_temp.fails($$select public.cpf_valid('52998224725')$$, '42501');
select pg_temp.fails($$select public.cnpj_valid('11222333000181')$$, '42501');
select pg_temp.fails($$select public.document_valid_for('trabalhador', '52998224725')$$, '42501');
select pg_temp.fails($$select public.whatsapp_valid('11988887777')$$, '42501');
reset role;
select pg_temp.ok((select array_agg(p.proname::text order by p.proname) = array['public_job_card']
                     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                    where n.nspname = 'public' and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
                      and p.proname in ('public_job_card', 'cpf_valid', 'cnpj_valid', 'document_valid_for', 'whatsapp_valid')),
                  'das funções públicas e de validação, o visitante só executa public_job_card');
-- Quem está logado segue validando.
select pg_temp.new_user('96000000-0000-0000-0000-000000000ae1', 'trabalhador', 'Ana Legada', '529.982.247-25');
select pg_temp.login('96000000-0000-0000-0000-000000000ae1');
select pg_temp.ok(public.cpf_valid('52998224725') and public.whatsapp_valid('11988887777'), 'conta logada ainda valida');
select pg_temp.logout();
-- O cadastro novo não cria mais o perfil do app antigo.
select pg_temp.ok(not exists (select 1 from public.profiles where id = '96000000-0000-0000-0000-000000000ae1'),
                  'sem cópia de nome e e-mail para profiles');
select pg_temp.ok(exists (select 1 from public.accounts where id = '96000000-0000-0000-0000-000000000ae1'), 'a conta nova nasce normal');
rollback;
