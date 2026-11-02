-- AUD-019 — o "hash do documento" passa a ser HMAC com uma chave do Vault (nivotech_documento_pepper): sem a chave, o
-- banco ou uma cópia dele não permite recuperar os CPFs. Sem a chave configurada tudo segue como antes (SHA-256).
-- A máscara do CPF mostra só os 2 últimos dígitos.
begin;
select pg_temp.new_user('96000000-0000-0000-0000-000000000ad1', 'trabalhador', 'Ana Hash', '529.982.247-25');
create temp table t_plain (h text);
insert into t_plain select encode(extensions.digest('52998224725', 'sha256'), 'hex');
select pg_temp.ok((select document_hash = (select h from t_plain) from public.accounts where id = '96000000-0000-0000-0000-000000000ad1'),
                  'sem a chave: SHA-256 como antes');
select pg_temp.ok(public.document_hash('529.982.247-25') = (select h from t_plain), 'a função segue igual sem a chave');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.rehash_document_hashes()', 'execute'), 'rehash só do service_role');
select pg_temp.ok(public.rehash_document_hashes() = 0, 'sem a chave, o recálculo não faz nada');

-- Com a chave: o hash muda com a chave e o recálculo troca o que está gravado.
select vault.create_secret('chave-a', 'nivotech_documento_pepper');
select pg_temp.ok(public.document_hash('529.982.247-25') <> (select h from t_plain), 'com a chave, o hash não é mais o SHA-256 puro');
select pg_temp.ok(public.document_hash('529.982.247-25') = public.document_hash('52998224725'), 'pontuação não muda o hash');
select pg_temp.ok(public.rehash_document_hashes() = 1, 'recalculou a conta');
select pg_temp.ok((select document_hash = public.document_hash('52998224725') and document = '***.***.***-25'
                     from public.accounts where id = '96000000-0000-0000-0000-000000000ad1'),
                  'hash novo e máscara só com os 2 últimos dígitos');
create temp table t_a (h text);
insert into t_a select public.document_hash('52998224725');
select vault.update_secret((select id from vault.secrets where name = 'nivotech_documento_pepper'), 'chave-b');
select pg_temp.ok(public.document_hash('52998224725') <> (select h from t_a), 'outra chave, outro hash');
-- O CNPJ é dado público da empresa e segue como estava.
select pg_temp.ok(public.mask_document('11222333000181') = '11.222.333/****-**', 'CNPJ sem mudança');
rollback;
