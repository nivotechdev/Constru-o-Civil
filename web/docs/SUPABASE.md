# Supabase — o app ligado ao banco

O front novo (`web/`) usa o **mesmo projeto Supabase do app antigo** (`Nivo Tech Construção Civil`,
`ppnxdajiihsjaojxokzh`, região São Paulo). As telas não mudaram: cada função de `src/services/` tem
dois corpos — o de demonstração (dados em memória) e o real (`src/services/remote/`) — e o app escolhe
um na hora do build.

## 1. Demonstração ou real

| Situação                                                          | Modo         | O que acontece                                                                                        |
| ----------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| Sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (prévia, testes) | demonstração | dados de `src/data/seed.ts`, contas de teste, simulações (e-mail, código de WhatsApp, PIX, CEPs)      |
| Com as duas variáveis no build                                    | real         | contas no Supabase Auth, dados nas tabelas, fotos no Storage, CEP no BrasilAPI/ViaCEP, avisos ao vivo |

`src/services/mode.ts` exporta `IS_DEMO`. As poucas dicas de tela que só fazem sentido na demonstração
(contas de teste no login, "Demonstração: …", interruptor de falhas) somem no modo real.

Para rodar ligado ao banco: copie `.env.example` para `.env.local`, preencha a URL e a chave **anon**
(Supabase → Project Settings → API) e rode `npm run dev`. Em produção, defina as duas variáveis no
ambiente de build da hospedagem. A chave `service_role` **nunca** vai para o front.

## 2. Como o banco está organizado

As tabelas do front novo ficam **ao lado** das do app antigo, que continuam funcionando como antes.
Os dois apps dividem o Auth (`auth.users`), o segredo do CPF/CNPJ no Vault e os buckets do Storage.

| Tabela nova                                                                    | O que guarda                                                                    | Do app antigo, reaproveitado                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `accounts`                                                                     | conta (1:1 com `auth.users`): lado, e-mail confirmado, perfil completo, termos  | CPF/CNPJ cifrado com a mesma chave (`nivotech_documento_key`) |
| `workers` · `companies`                                                        | perfis (o id é o da conta); WhatsApp **privado** (não sai em `select`)          | —                                                             |
| `oficios`                                                                      | catálogo único de ofícios                                                       | —                                                             |
| `jobs`                                                                         | vagas com endereço completo, coordenadas, datas e horários; id curto `BC-5001…` | —                                                             |
| `applications` · `application_events`                                          | candidatura e histórico (status só muda por RPC)                                | —                                                             |
| `reviews` · `saved_jobs` · `worker_posts` · `notifications` · `boost_payments` | o resto do contrato                                                             | aceite dos termos registrado em `consentimentos` (LGPD)       |

- **Regras no banco** (`supabase/migrations/20261009000200_bicos_v2_rules.sql`): RLS em todas as
  tabelas e RPCs `security definer` para tudo que muda mais de um registro — a máquina de status da
  candidatura (`transition_application`, a mesma tabela de `applicationMachine.ts`), publicar/editar/
  encerrar vaga, avaliar, pagar, contato por WhatsApp (`get_contact`), exportar e excluir a conta. As
  RPCs devolvem erros com código próprio (`BC401/404/409/422`) e a mensagem pronta em português.
- **Rotinas** (pg_cron, já usado pelo app antigo): concluir diárias vencidas (de hora em hora) e vencer
  códigos PIX (a cada 10 min).
- **Contas que já existiam** no app antigo ganham a conta nova com o "Completar perfil" pendente; contas
  criadas depois em qualquer um dos dois apps ganham as duas linhas no cadastro (gatilho
  `on_auth_user_created_v2`).
- **Storage**: `vagas` (novo, fotos das vagas), `portfolio` e `avatars` (do app antigo). Cada conta só
  grava na própria pasta.
- **Edge Function** `entrar-com-documento`: entrar com CPF/CNPJ sem o navegador saber o e-mail da conta.

## 3. Situação da aplicação no projeto

| Parte                                                                                                                                                                                    | Situação                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Tabelas, privilégios, RLS (`…000100_bicos_v2_schema.sql`)                                                                                                                                | **aplicada**                                                                                          |
| Políticas, gatilhos de conta e no Auth, RPCs de vagas, candidatura, avaliação, pagamento, contato, exportação (`…000200_bicos_v2_rules.sql`)                                             | **aplicada** (em partes)                                                                              |
| Ofícios, bucket `vagas`, cron, Realtime, contas antigas (`…000300_bicos_v2_data.sql`)                                                                                                    | **aplicada** — as 4 contas antigas já têm conta nova (perfil a completar)                             |
| Edge Function `entrar-com-documento`                                                                                                                                                     | **publicada**                                                                                         |
| `supabase/APLICAR-NO-SQL-EDITOR.sql`: decisões da construtora e desistência (`transition_application`), retirar candidatura, excluir vaga, excluir conta, limpeza de cadastro abandonado | **a aplicar** — colar no SQL Editor do painel e rodar (o conector pedia uma aprovação que não chegou) |

Testado direto no banco (numa transação desfeita no fim): cadastro com documento cifrado e mascarado,
aceite dos termos registrado, publicar vaga (e recusar valor abaixo de R$ 80), PIX gerado e
confirmado, vaga já impulsionada bloqueada, candidatura, contagem privada no mural, WhatsApp ilegível
por `select`, contato fechado antes da aprovação, RLS das vagas salvas, avisos, marcar como lidas,
editar vaga (avisa os candidatos), encerrar (recusa quem esperava). O teste achou e corrigiu um erro em
`update_job`.

## 4. Configurações do painel (Authentication)

1. **URL Configuration**: em _Site URL_ e _Redirect URLs_, o endereço onde o app novo estiver publicado
   (ex.: `https://bicos.nivotech.com.br/`). Os links de confirmação e de nova senha voltam para ele
   (sem `#/rota`: o app trata o `#access_token=…` antes do roteador, como o app antigo).
2. **E-mail**: manter "Confirm email" ligado. Para produção, configurar SMTP próprio (o serviço padrão
   do Supabase tem cota baixa — ver `SETUP-SUPABASE.md` do app antigo).
3. Senha mínima: o app pede 8 caracteres; deixe o mínimo do Auth em 8 ou menos.

## 5. O que ainda depende de serviço externo

| Recurso                        | No modo real hoje                                                                                         | Para ficar completo                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Código de WhatsApp no cadastro | o passo do código não aparece; o número fica guardado sem confirmação (`whatsapp_verified_at` vazio)      | provedor (Twilio ou API do WhatsApp) + Edge Function                       |
| Pagamento do impulsionamento   | cobrança registrada no banco; PIX confirmado pelo botão de simulação, cartão aprovado (final 0000 recusa) | provedor (Mercado Pago, Asaas…) + webhook chamando `confirm_boost_payment` |
| Exportar meus dados            | o arquivo é gerado no servidor e baixado no aparelho                                                      | (opcional) envio por e-mail                                                |
| Fotos de perfil e capa         | continuam só no aparelho, como antes (as telas não as leem do perfil)                                     | ligar `photo_url`/`logo_url`/`cover_url` nas telas                         |
| Entrar com Google / celular    | mensagem "por enquanto, entre com e-mail ou CPF/CNPJ"                                                     | provedores no Auth                                                         |

## 6. Onde está cada coisa no código

| Arquivo                                                                            | Papel                                                                                |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/services/mode.ts`                                                             | `IS_DEMO`                                                                            |
| `src/services/supabase.ts`                                                         | cliente único (carregado sob demanda), sessão salva, fluxo `implicit`                |
| `src/services/remote/client.ts`                                                    | tradução de erros (rede, Auth, PostgREST, RPCs) para `ServiceError`                  |
| `src/services/remote/session.ts`                                                   | restaura a sessão, trata os links do e-mail, conta pendente de confirmação, Realtime |
| `src/services/remote/data.ts`                                                      | leituras por tela (mural, vaga, candidaturas, histórico, perfis, notificações)       |
| `src/services/remote/merge.ts`                                                     | junta as linhas lidas no store (puro, testado)                                       |
| `src/services/remote/{auth,jobs,applications,profiles,actions,address,storage}.ts` | as ações                                                                             |
| `src/types/supabase.ts`                                                            | tabelas e RPCs tipadas (o `supabase-js` confere colunas e argumentos)                |
| `supabase/migrations/` · `supabase/functions/`                                     | banco e Edge Function                                                                |

Leituras: cada tela carrega só o que mostra; ao voltar a uma tela, ela aparece na hora e se atualiza em
segundo plano se os dados tiverem mais de 20 s (`services/queries.ts`). As notificações novas chegam
pelo Realtime.

## 7. Como foi validado

- `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test` (93 testes: os 81 do modo
  demonstração e 12 do modo real com um cliente Supabase falso — login por e-mail e por CPF, cadastro,
  documento/e-mail já usados, mural com contagem privada, decisões por RPC com a mensagem do servidor,
  salvar vaga com desfazer, cartão que nunca sai do aparelho, contato por WhatsApp).
- Build nos dois modos. O build real foi aberto no Chromium com as respostas do Supabase simuladas:
  senha errada mostra "E-mail ou senha incorretos", a certa entra e o mural mostra a vaga do servidor,
  sem erros na página e com o mesmo visual.
- O ambiente de desenvolvimento usado não alcança `*.supabase.co` pela rede; o teste com o banco real
  fica para depois de aplicar as migrations (seção 3).
