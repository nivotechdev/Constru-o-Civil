# Se acontecer um vazamento ou acesso indevido (uma tela)

> Proposta da rodada FIX (AUD-081), escrita sem advogado para o piloto. A Política de privacidade promete avisar a
> pessoa e a ANPD quando houver incidente que possa causar dano; este roteiro é o que fazer. Os telefones e e-mails
> reais ficam com os sócios, aqui só os papéis.

**Quem decide:** o encarregado de dados (o `{{DPO_NOME}}` da Política). Se ele não responder em 1 hora, qualquer sócio.

## 1. Confirmar (primeira hora)

- O que aconteceu? Sentry (quando ligado), logs do Supabase (Logs › Auth, API, Edge Functions) e o histórico de
  `staff_actions` (`select * from staff_actions order by created_at desc limit 50` no SQL Editor).
- Que dados foram tocados? (cadastro, WhatsApp, endereço, CPF cifrado, fotos) e de quantas pessoas
  (`select count(*) from accounts` e a tabela envolvida).
- Anotar: data e hora que descobrimos, quem descobriu, o que vimos. **Sem colar dado pessoal no registro.**

## 2. Conter (o quanto antes)

- Chave `service_role` ou token vazado: girar no Supabase (Settings › API) e refazer o segredo nos provedores.
- Função suspeita: desligar (Edge Functions › a função › Disable) ou despublicar.
- Conta de equipe suspeita: `delete from staff_members where user_id = '<id>'` (com um sócio de testemunha).
- Senhas: se o Auth foi tocado, Authentication › Users › "Sign out all users".
- Se for preciso, pôr o site em manutenção (retirar o domínio do Cloudflare Pages).

## 3. Avisar (até 3 dias úteis depois de saber)

- **Pessoas afetadas**, por e-mail e dentro do app: o que aconteceu, quais dados, o que a pessoa deve fazer (trocar
  senha, desconfiar de mensagens), contato do encarregado.
- **ANPD**, se o incidente puder causar risco ou dano relevante: formulário "Comunicação de incidente de segurança" no
  site da ANPD (gov.br/anpd). Guardar o protocolo.

## 4. Depois

- Corrigir a causa, escrever em `web/docs/DECISOES.md` o que mudou e por quê.
- Guardar este registro (data, dados, quantidade de pessoas, o que foi avisado) por pelo menos 5 anos.
- Contratar um advogado para o caso, se houver dano real. Este roteiro **não substitui** orientação jurídica.
