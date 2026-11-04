-- AUD-118 — o valor do aviso "Bico novo" usa ponto de milhar, qualquer que seja a configuração do servidor.
begin;
select pg_temp.ok(public.reais_text(1500) = '1.500', 'mil e quinhentos sai 1.500');
select pg_temp.ok(public.reais_text(150) = '150', 'centena sem ponto');
select pg_temp.ok(public.reais_text(1234567) = '1.234.567', 'milhões com dois pontos');
select pg_temp.ok(public.reais_text(80.5) = '80', 'centavos ficam de fora na diária');
rollback;
