# C1 — Achados (Frente 2: serviços de conta, endereço, admin, alertas, candidaturas, auth, vagas, convites e corpos remotos)

(Ordem de gravação; a ordenação por severidade é feita no fim. Achados de M1 e C2 são citados, não repetidos.)

### C1-001 — Ação que deu certo no servidor aparece como erro quando a releitura seguinte falha; em "publicar vaga" o novo toque cria uma vaga repetida

- Área: bug
- Severidade: S2
- Esforço: P
- Confiança: confirmado (reproduzido com o falso Supabase do projeto)
- Onde: `web/src/services/remote/jobs.ts:25-31` (`publishJob`: RPC e depois `await loadJob(id)`), `:33-38` (`updateJob`); `web/src/services/remote/applications.ts:10-16` (`transition`, usada por aprovar/recusar/contratar/cancelar/concluir/falta/desistir/desfazer), `:24-34` (`submitApplication`, `withdrawApplication`), `:42-46`, `:54-58`; `web/src/services/remote/actions.ts:77-94` (`submitReview`), `:130-134` (`payWithCard`: `loadJob` depois da cobrança aprovada); `web/src/services/invites.ts:88-94` (`answerInvite`). Tela: `web/src/pages/recruiter/CreateJob.tsx:200-211` (o `catch` mostra `publishError` e reabilita o botão).
- Prova: `$SCRATCH/out/C1/repro/falha-parcial.test.ts` (rodar dentro de `web/`: `npx vitest run --config $SCRATCH/out/C1/repro/vitest.config.ts`). O RPC responde certo e, em seguida, as leituras caem (`TypeError: Failed to fetch`). Saída: `1st publish -> offline: Sem internet. Confira sua conexão e tente de novo. | 2nd publish -> ok BC-2 | publish_job RPC calls = 2` (duas vagas criadas) e `1st approve -> offline: Sem internet… | server status now = pre_selecionado | retry -> conflito: Essa candidatura mudou de situação. Atualize a tela e confira.` O `publish_job` do banco não tem trava de repetição (`20261021000700_u52_dias_e_local.sql:158-190`, só confere empresa/perfil/reprovada). Já existe o jeito certo no mesmo arquivo: `deleteJob` faz `await loadJob(jobId).catch(() => undefined)` (`remote/jobs.ts:51`), mas nenhuma das outras ações faz.
- Impacto: com internet ruim (o público do app), a empresa vê "Sem internet" depois de a vaga já estar no mural; toca em Publicar de novo e a vaga sai repetida (candidatos divididos, mural poluído). Nas decisões, a empresa vê erro numa aprovação que valeu e, ao tentar de novo, recebe "A candidatura mudou de situação", sem saber o que aconteceu. Na cobrança do cartão aprovada, a tela diz erro (o banco impede a segunda cobrança: `begin_boost_payment` recusa vaga já impulsionada, então não há cobrança dupla, só susto).
- Causa raiz: o "resultado" da ação e a "atualização da tela" são a mesma promessa; a releitura (`loadJob`: 4 a 7 chamadas) é tratada como parte da ação.
- Correção recomendada: separar os dois: depois do RPC, `await refresh().catch(() => markStale(jobId))` (ou só `catch` e um aviso discreto "Feito. Atualize a tela"), mantendo o erro do RPC como está. Em `publishJob` devolver o id mesmo se a releitura falhar (a tela de "vaga publicada" já recarrega a vaga). Opcional: chave de idempotência em `publish_job` (hash título+endereço+empresa em 2 min).
- Critério de aceite: o teste de reprodução passa a mostrar `1st publish -> ok BC-1` e `publish_job RPC calls = 1` quando só a releitura falha; um teste novo por função (`transition`, `submitApplication`, `submitReview`).
- Dependências: nenhuma. Relacionado (não repete): C2-005 (respostas atrasadas) e C2-009 (erro de rede em Edge Function).

### C1-002 — Cadastro do endereço: sem internet (ou provedor lento) o app diz "Não achamos essa rua", e a localização é salva em silêncio no centro da cidade

- Área: UX
- Severidade: S2
- Esforço: P
- Confiança: confirmado (reproduzido: `$SCRATCH/out/C1/repro/endereco.test.ts`)
- Onde: `web/src/services/remote/address.ts:224-259` (`streetsOnline`: o `catch` do ViaCEP só relança se a pessoa abortou; o do Photon devolve `{ body: null }`) → `web/src/services/address.ts:385-390` (`findCep`) → `:329-338` (`resolveAddress` responde `errors.street`); `remote/address.ts:334-388` (`geocodeOnline`: Nominatim e Photon caem em `catch` vazio e devolvem o centro da cidade com `precision: 'cidade'`). Telas: `pages/shared/CompleteProfile.tsx:105` (cadastro), `hooks/useAddressEditor.ts:40` (editar perfil), `pages/recruiter/CreateJob.tsx:131` (vaga).
- Prova: com `fetch` rejeitando (`TypeError: Failed to fetch`) e sem CEP digitado: `resolveAddress({city:'Caxias do Sul, RS', street:'Rua Sinimbu', neighborhood:'Centro'})` → `{"ok":false,"errors":{"street":"Não achamos essa rua em Caxias do Sul. Escolha a rua na lista ou digite o CEP."}}`. Com o CEP digitado, o mesmo cenário dá o erro certo (`THROWS offline: Não deu para buscar o CEP agora. Confira a internet…`), então o contrato "só lança erro quando os provedores não respondem" (comentário em `address.ts:301`) vale só para o CEP. `getJson` aborta em 7 s (`remote/address.ts:73`), então internet lenta cai no mesmo caminho. O `precision` nunca é mostrado nem usado na tela (`grep precision src/pages src/components` → nada), então a pessoa não sabe que a casa foi salva no centro.
- Impacto: no passo "Seu endereço" do cadastro, quem está com sinal fraco lê que a rua não existe, corrige o que estava certo e desiste ou digita um CEP errado. Quando só o mapa cai, o endereço é salvo no centro da cidade e todas as distâncias "a 300 m" do mural saem erradas sem aviso (a promessa do U51 é a distância de verdade).
- Causa raiz: `streetsOnline`/`geocodeOnline` tratam "provedor não respondeu" como "nada encontrado"; falta distinguir lista vazia de falha (o CEP já faz isso com `reached`).
- Correção recomendada: em `streetsOnline` lançar `offline` quando ViaCEP e Photon falham ao mesmo tempo (e não vir de aborto); em `resolveAddress` deixar esse erro subir; em `geocodeOnline` devolver também `degraded: true` e, no cadastro, avisar "Não deu para marcar a casa no mapa; vamos usar o centro da cidade" ou tentar de novo.
- Critério de aceite: o teste `endereco.test.ts` passa a mostrar `THROWS offline` (sem CEP) e um teste novo cobre `precision: 'cidade'` por falha com aviso.
- Dependências: nenhuma.

### C1-003 — Falha HTTP de um provedor de CEP/mapa vira resposta definitiva: "CEP não encontrado" ou sugestões vazias pela sessão inteira

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado (`$SCRATCH/out/C1/repro/endereco.test.ts`)
- Onde: `web/src/services/remote/address.ts:129-173` (`lookupCepOnline`: ViaCEP com status 5xx entra em `reached = true` e `!body` devolve `null`); `:85-94` (`cached`: só esquece a promessa que _rejeita_) com `:253-255` e `:291-293` (`cached(url, () => getJson(...))` não lança em status != 200: `getJson` devolve `{status, body:null}`).
- Prova: BrasilAPI e ViaCEP respondendo 503: `lookupCep('95020000')` → `null` e `resolveAddress` → `{"errors":{"cep":"Não achamos esse CEP. Confira os números ou deixe em branco."}}`. Photon respondendo 429 na 1ª vez e 200 na 2ª: `neighborhoodsOnline(..., 'cen', ...)` duas vezes → `first [] second [] fetch calls = 1` (a 2ª chamada nem saiu: a resposta vazia ficou no cache da sessão).
- Impacto: uma indisponibilidade ou limite de uso (o Photon limita por IP) faz o bairro "sumir" das sugestões até recarregar o app, e o CEP certo ser chamado de inexistente. Só afeta quando o provedor falha, mas esses provedores são gratuitos e sem contrato (U51).
- Causa raiz: o cache e o `reached` assumem que "não lançou" é "respondeu".
- Correção recomendada: `getJson` lançar em status >= 500 e 429 (como já faz o ViaCEP de ruas e o Nominatim); `lookupCepOnline` só devolver `null` com 404/400/`erro:true`.
- Critério de aceite: o mesmo teste mostra `lookupCep → THROWS offline` com 503 e `second ["Centro"]` depois do 429.
- Dependências: nenhuma. Parente do C1-002.

### C1-004 — "Minhas candidaturas", "Candidatos" e "Minhas vagas" só abrem se uma rotina que escreve (`conclude_my_finished_jobs`) der certo antes

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado (`$SCRATCH/out/C1/repro/conclui-primeiro.test.ts`)
- Onde: `web/src/services/remote/data.ts:145-148` (`concludeMine`), chamada sem `catch` em `:307` (`loadMyApplications`), `:355` (`loadJobCandidates`), `:363` (`loadHistory`); expostas por `services/applications.ts:113-141`.
- Prova: com o RPC `conclude_my_finished_jobs` devolvendo erro, `loadMyApplications()` rejeita com `falha_demo: Não deu certo agora…` e **nenhuma** leitura da tabela `applications` chega a sair (`reads of applications table = 0`).
- Impacto: um soluço da rotina que conclui diárias (ou uma função ausente num ambiente, como a produção, que está 25 migrations atrás) tira do ar as três telas principais de acompanhamento, mesmo com os dados legíveis. A conclusão automática já roda de hora em hora (`bicos-concluir-diarias`), então a chamada é só um adiantamento.
- Causa raiz: efeito colateral tratado como pré-requisito da leitura.
- Correção recomendada: `await concludeMine().catch(() => undefined)` (ou só tentar uma vez por minuto e não esperar o resultado).
- Critério de aceite: o teste passa a mostrar `loadMyApplications -> ok` e uma leitura da tabela.
- Dependências: nenhuma.

### C1-005 — Mensagem pronta do WhatsApp erra o tratamento: "Aqui é da Ana Souza" (pessoa) e "Fui contratado" para qualquer trabalhador

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado (leitura + teste que fixa o texto)
- Onde: `web/src/utils/whatsapp.ts:38-44` (usada por `services/contacts.ts:62-70` e `services/remote/actions.ts:61-70`); testes que fixam o texto: `web/src/__tests__/contacts.test.ts:52,73-83`. Contexto: `DECISOES.md` U63 (quem contrata pode ser "Ana Souza ou Padaria Bom Pão").
- Prova: `companyToWorkerMessage` monta `Aqui é da ${companyName}, pela Bicos`; com o nome de uma pessoa sai "Aqui é da Ana Souza, pela Bicos". `workerToCompanyMessage` monta `Fui ${hired ? 'contratado' : 'aprovado'}` sem olhar quem escreve: uma trabalhadora manda "Fui contratado".
- Impacto: é a primeira mensagem entre as duas partes, a que prova que o app é sério; o erro é pequeno mas aparece em todo contato de pessoa física, que é o público novo do U48. A pessoa pode editar antes de enviar.
- Causa raiz: o texto foi escrito quando só havia construtora (artigo "da") e antes do nome único (U63).
- Correção recomendada: "Aqui é {nome}, pela Bicos" (sem artigo) e "Fui escolhido(a)/Você foi escolhido(a)", ou "Estou dentro da vaga…" — decisão de redação dos sócios.
- Critério de aceite: texto novo nos testes de `contacts.test.ts`.
- Dependências: nenhuma (redação: ação do responsável).

### C1-006 — Documentos e comentários desatualizados nos serviços de conta/candidatura/vaga (higiene)

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/services/account.ts:17` (diz que `exportMyData` "envia uma cópia para o e-mail… uma Edge Function monta e envia"; o código real baixa um JSON no aparelho: `remote/actions.ts:140-153`; o demo não faz nada); `auth.ts:79-83` (dois blocos `/** */` seguidos: o primeiro explica `SignInError` mas fica solto), `auth.ts:134` (campo "F15: recruiter — who talks to the candidates" que não existe mais desde o U63), `auth.ts:380,386` e `applications.ts:125` (parâmetros chamados `_email`, `_newPassword`, `_jobId` e usados: o `_` diz "não usado"); `cities.ts:63` (JSDoc de `cityByLabel` colado em cima de `knownCity`); `jobs.ts:21-26` (dois comentários seguidos sobre `loadFeed`, o primeiro é de antes do X01); `alerts.ts:20,37` (`ALERTS_PER_DAY`, `alertMatches` exportados sem uso fora do arquivo: `knip.log`); `CLAUDE.md` §3 lista só 4 saídas de status (`nao_selecionado`, `desistiu`, `cancelado_pela_construtora`, `nao_compareceu`), mas a tabela tem `expirada` e `cancelado_pela_equipe` (`applicationMachine.ts:96-107`). O nome do código `falha_demo` é usado para erro inesperado do servidor real (`remote/client.ts:10,78`, `remote/storage.ts:57`), o que engana quem lê logs. `alerts.ts`, `invites.ts` e `identity.ts` chamam `remote/client` dentro do próprio serviço, fora do padrão "corpo real em `remote/*.ts`" do CLAUDE.md §3.
- Prova: leitura linha a linha + `grep` (números acima).
- Impacto: quem ler o comentário de `exportMyData` acha que o e-mail é enviado (promessa de LGPD); quem usar o CLAUDE.md para a máquina de status esquece dois estados.
- Causa raiz: acúmulo de rodadas sem limpeza (mesma de C2-015, M1-006).
- Correção recomendada: corrigir os textos; trocar `falha_demo` por um nome neutro (ex.: `falha`) num commit mecânico ou documentar em `errors.ts` que vale para o real também; acrescentar os dois estados ao CLAUDE.md.
- Critério de aceite: grep dos trechos acima não acha os comentários antigos; knip sem `ALERTS_PER_DAY`/`alertMatches`.
- Dependências: nenhuma.

## Hipóteses não confirmadas

- H1 — Salvar vaga (coração) tocado duas vezes rápido: `toggleSavedJob` real (`remote/jobs.ts:55-74`) lê `wasSaved` do estado otimista e dispara `insert` e `delete` ao mesmo tempo, sem trava por vaga (`feedback.ts:8-12`, e as 3 telas que chamam). Se a rede reordenar os dois pedidos, o servidor fica "salva" e a tela "não salva" até recarregar. Faltou prova: o falso Supabase atende em ordem; só reproduz com rede real.
- H2 — Entrar com o Google _sem_ Firebase (`auth.ts:415-424`): `startBusy({message:'Abrindo o Google…'}, {maxMs: 10 min})` sem botão "Cancelar", com o app `inert` e o botão voltar bloqueado (`router.ts` consulta `isBusy()`); nada trata `pageshow`. Se o navegador restaurar a página do cache ao voltar da tela do Google, a pessoa pode ficar presa até 10 min. Faltou prova: depende do navegador e de o build de produção não ter `VITE_FIREBASE_*` (o CHECKLIST U28 trata Firebase como pendente de console).
- H3 — `locateMyCity` (`cities.ts:78-90`) devolve o município _mais próximo_ do GPS sem limite de distância: fora do Brasil (ou com GPS impreciso na fronteira) escolhe uma cidade brasileira distante. Faltou prova de uso real fora do país; baixa probabilidade no piloto.
- H4 — `signUp` guarda a senha em claro em memória (`pendingSignUp`, `auth.ts:189,198`) até confirmar o e-mail, para o "Trocar e-mail" (U11/U43, decisão documentada). Não foi achado nenhum caminho que a grave ou envie ao Sentry (`monitoring.ts` limpa ids; não olhei o conteúdo de todas as mensagens de erro). Risco só com extensão/XSS; fica como lembrete de higiene.
- H5 — `markAllNotificationsRead` (`remote/actions.ts:22-32`) atualiza o servidor com `read_at is null` e a tela com _todos_ os avisos do store; um aviso que chegue por tempo real entre os dois passos aparece lido na tela e não lido no servidor até a próxima leitura do número do sino. Impacto mínimo; faltou prova de ordem real.
- H6 — Já registrado em M1 (H5): o corpo demo de `significantChanges` (`jobs.ts:123-150`) trata a vaga antiga sem `weekdays` como "mesmos dias", mas o banco compara com `NULL` (M1 H5). Não repito; só confirmo que o lado TypeScript tem o comentário (U52) e o SQL não.

## Bom e deve ser preservado

- `applicationMachine.ts` é a única tabela de transições; `transition()` lança `conflito` com texto simples e `autoRejected` é recalculado a cada transição (nenhuma ação deixa o marcador preso). O lado TypeScript bate com o banco (M1, `maquina.md`).
- `remote/client.ts` + `request()` traduzem todo erro para `ServiceError` com os códigos `BC401/404/409/422`; `remote/applications.ts`, `remote/jobs.ts` e `remote/actions.ts` nunca deixam passar mensagem técnica do PostgREST para a tela (o `message` só vem das RPCs, escritas em português).
- `toggleSavedJob` real: insert simples, aceita `23505` como "já salva" e desfaz o estado otimista no erro (`remote/jobs.ts:55-74`); `deleteJob` já isola a releitura com `.catch` (modelo para C1-001).
- `signOut` real nunca falha por rede (`remote/auth.ts:107-114`: `scope: 'local'` com `catch` e `leaveSession()`), inclusive depois de `excluir-conta`.
- `contacts.ts`: o número só sai por `get_contact`, a chave do cache inclui conta + candidatura + situação e é limpa no `leaveSession` (`remote/session.ts:343`).
- `remote/address.ts`: toda entrada do usuário vai para a URL com `encodeURIComponent` e o CEP só entra depois de reduzido a 8 dígitos; a política de privacidade já lista BrasilAPI, ViaCEP e OpenStreetMap (`legal.ts:147`). O cache por URL e o `unlessAborted` evitam pedidos repetidos a cada letra.
- `admin.ts` + `remote/admin.ts`: nenhuma regra no navegador (tudo `admin_*` com `staff_guard`); os nove rótulos de `ACTION_LABELS` batem com os `staff_log(...)` do SQL; no demo todas as funções lançam `nao_autorizado`.
- `busy.ts`: todo bloqueio tem prazo (`maxMs`) e `end()` é idempotente; `startBusy` publica o estado de forma síncrona (`isBusy()` vê o segundo toque).
