-- Y25 — trocar o WhatsApp: validação, código confirmado vale uma vez, troca sem código zera a confirmação.
begin;

select pg_temp.ok(public.whatsapp_valid('(11) 98888-7777') and not public.whatsapp_valid('1188887777')
                  and not public.whatsapp_valid('(01) 98888-7777') and not public.whatsapp_valid('abc'), 'celular com 11 números');

-- Cadastro com WhatsApp inválido é recusado.
select pg_temp.fails($$insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
  values ('72000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'zap@bicos.test', now(), '{"role": "trabalhador", "nome": "Sem Zap", "documento": "52998224725", "whatsapp": "abc"}', now(), now())$$, 'BC422');

-- Número confirmado por código antes do cadastro: a conta nasce confirmada.
select public.mark_whatsapp_verified('11977776666');
select pg_temp.new_user('72000000-0000-0000-0000-0000000000a1', 'trabalhador', 'Zap Confirmado');
insert into auth.users (id, instance_id, aud, role, email, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('72000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'zap2@bicos.test', now(), '{"role": "trabalhador", "nome": "Com Código", "documento": "39053344705", "whatsapp": "(11) 97777-6666", "maior_de_idade": true}', now(), now());
select pg_temp.ok((select whatsapp_verified_at is not null from public.accounts where id = '72000000-0000-0000-0000-0000000000a2'),
  'cadastro com código confirmado');

-- Troca sem código: número novo, confirmação zerada; trabalhador e conta em sincronia.
update public.accounts set whatsapp_verified_at = now() where id = '72000000-0000-0000-0000-0000000000a1';
select pg_temp.login('72000000-0000-0000-0000-0000000000a1');
select pg_temp.fails($$select public.change_whatsapp('123')$$, 'BC422');
select public.change_whatsapp('(21) 99999-0000');
select pg_temp.logout();
select pg_temp.ok((select a.whatsapp = '21999990000' and a.whatsapp_verified_at is null and w.whatsapp = '21999990000'
                     from public.accounts a join public.workers w on w.id = a.worker_id
                    where a.id = '72000000-0000-0000-0000-0000000000a1'), 'trocou e ficou sem confirmação');

-- Troca com código: confirmada, e o código não vale de novo.
select public.mark_whatsapp_verified('21988881111');
select pg_temp.login('72000000-0000-0000-0000-0000000000a1');
select public.change_whatsapp('21988881111');
select pg_temp.logout();
select pg_temp.ok((select whatsapp_verified_at is not null from public.accounts where id = '72000000-0000-0000-0000-0000000000a1'),
  'trocou confirmado');
select pg_temp.ok(not exists (select 1 from public.whatsapp_verifications where phone = '21988881111'), 'código usado uma vez');

-- Construtora: a coluna não é mais editável direto; pela função sim, e a conta acompanha.
select pg_temp.new_user('72000000-0000-0000-0000-0000000000c1', 'recrutador', 'Obra Zap', '11.222.333/0001-81');
select pg_temp.login('72000000-0000-0000-0000-0000000000c1');
select pg_temp.fails($$update public.companies set whatsapp = '11900000000' where id = '72000000-0000-0000-0000-0000000000c1'$$, '42501');
select public.change_whatsapp('11966665555');
select pg_temp.logout();
select pg_temp.ok((select c.whatsapp = '11966665555' and a.whatsapp = '11966665555'
                     from public.companies c join public.accounts a on a.company_id = c.id
                    where c.id = '72000000-0000-0000-0000-0000000000c1'), 'construtora trocou');

-- Ninguém de fora marca um número como confirmado.
select pg_temp.login('72000000-0000-0000-0000-0000000000c1');
select pg_temp.fails($$select public.mark_whatsapp_verified('11955554444')$$, '42501');
select pg_temp.logout();

rollback;
