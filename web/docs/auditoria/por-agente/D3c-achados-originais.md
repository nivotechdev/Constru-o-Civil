# D3c — Migrations u01…u67 e testes SQL u* (Frente 3)

Achados abaixo, escritos conforme provados (a ordem por severidade é refeita no fim). Já cobertos por outros relatórios e **não repetidos aqui**: D1-001 (endereço exato de toda vaga por `select`, U53), D1-003 (campos sem limite gravados direto), D1-002 (seguranca.sql/documentação desatualizados).

### D3c-001 — Excluir a conta NÃO apaga as avaliações que a pessoa escreveu (só as que recebeu), apesar do U24, da política de privacidade e do teste verde

- Área: LGPD
- Severidade: S2
- Esforço: P
- Confiança: confirmado (consulta no staging + leitura do código)
- Onde: `web/supabase/migrations/20261021000500_u48_publico_geral.sql:101-102` e `:138-139` (versão em uso de `anonymize_account`; mesma lógica em `20261020000300_u24_exclusao_completa.sql:36-37,73-74`); gravação das avaliações em `u48…sql:501-502` e `:510-511` (`submit_review`); `web/src/services/legal.ts:155`; fixture em `web/supabase/tests/u24_exclusao_completa.sql:20-24`
- Prova: (1) `submit_review` grava a avaliação do trabalhador (`para_construtora`) só com `company_id` e a da empresa (`para_trabalhador`) só com `worker_id` (o outro fica nulo). Staging: `reviews` `para_trabalhador` = 25 linhas, `worker_id`=25, `company_id`=0; `para_construtora` = 25 linhas, `worker_id`=0, `company_id`=25. (2) A exclusão só apaga por cascata o que tem a chave da conta excluída: `reviews_worker_id_fkey` e `reviews_company_id_fkey` são `on delete cascade`; logo, ao excluir o trabalhador some o que ele **recebeu** (`worker_id`), mas o que ele **escreveu** (`company_id` preenchido, `worker_id` nulo) fica, com o `author_label` ("Ana S.") e o comentário; o mesmo vale para a empresa (o que escreveu sobre trabalhadores fica, assinado com o nome da empresa). (3) `v_others` (as contas cuja nota deve ser refeita) é lido com `worker_id = <excluído> and direction = 'para_construtora'` / `company_id = <excluída> and direction = 'para_trabalhador'`, combinação que nunca existe nos dados reais (0 linhas acima): a lista vem sempre vazia. (4) O teste U24 insere as duas avaliações com `company_id` **e** `worker_id` preenchidos (`u24…sql:20-24`), forma que o app nunca grava; por isso passa.
- Impacto: quem pede a exclusão acredita que tudo foi apagado (a política diz "apagamos na hora … as avaliações que você fez e recebeu"), mas nome abreviado e texto escritos por ela continuam à vista no perfil do outro lado. Também fica sem efeito o que o U24 decidiu para as notas do outro lado.
- Causa raiz: a regra de exclusão assume as duas chaves preenchidas em cada avaliação; o desenho real guarda só a chave do lado avaliado. O teste foi escrito com dados que casam com a suposição, não com o que `submit_review` produz.
- Correção recomendada: em `anonymize_account`, apagar também as avaliações escritas: trabalhador → `direction = 'para_construtora'` das candidaturas dele (via `application_id`, que é `set null` quando a candidatura some, então apagar antes de apagar o perfil) ou, melhor, guardar o autor (`author_account_id`) na avaliação e apagar por ele; empresa → `direction = 'para_trabalhador'` pelas vagas dela. Refazer `v_others` com essas linhas. Trocar a fixture do teste para o formato real (uma chave por linha, criada por `submit_review`).
- Critério de aceite: teste novo em que a avaliação é criada por `submit_review`, a conta autora é excluída e `select count(*) from reviews where author_label = <rótulo>` dá 0, e a nota/contagem do avaliado volta ao valor sem ela; a fixture antiga com as duas chaves também continua passando.
- Dependências: nenhuma. Observação: `reviews.application_id` fica nulo ao apagar a candidatura (`on delete set null`), então depois da exclusão não há mais como achar essas linhas por candidatura.

### D3c-002 — Apagar a conta apaga também as denúncias, os bloqueios e o registro de suspensão: quem foi denunciado some e volta limpo com o mesmo CPF

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: provável (código e catálogo; não reproduzido de ponta a ponta para não apagar conta no staging)
- Onde: `web/supabase/migrations/20261021000500_u48_publico_geral.sql:104-108` e `:140-144` (`delete from public.reports … target_type 'perfil'/'post'/'avaliacao'/'vaga'`), mesma regra em `20261020000300_u24_exclusao_completa.sql:39-43,75-79`; `blocks_blocker_id_fkey` e `blocks_blocked_id_fkey` → `auth.users` com `on delete cascade`; `accounts` (com `suspended_at`, `document_hash`) é apagada na mesma função; `delete_my_account` (staging, `prosrc`) não olha `suspended_at` nem denúncias abertas; teste que exige o apagamento: `web/supabase/tests/u24_exclusao_completa.sql:52-53`
- Prova: no staging não existe tabela de "documentos barrados" (lista de 39 tabelas do `public`, só `reports`, `blocks`, `staff_actions`, `terms_acceptances` têm relação). `staff_actions` guarda só o que a equipe fez (`action, target_type, target_id, reason`). `claim_document_for` só confere `accounts` e `profiles`, então o CPF/CNPJ de uma conta apagada fica livre na hora. DECISOES U24 registra como pedido do responsável: "as feitas sobre o perfil … também saem (não há mais o que moderar)".
- Impacto: um golpista denunciado (vaga falsa, cobrança) pode excluir a conta antes de a equipe agir; as denúncias contra ele somem, ninguém que o bloqueou continua protegido, e ele cria outra conta no mesmo minuto. A equipe não consegue saber que é reincidente.
- Causa raiz: a exclusão foi tratada só como direito do titular (LGPD), sem a exceção de prevenção a fraude e segurança (LGPD art. 7º, IX e art. 11, II, g) e sem guardar nenhum rastro mínimo.
- Correção recomendada: ao excluir, manter um registro mínimo e sem dado pessoal em claro: `document_hash` + data + se havia denúncia procedente/suspensão (tabela própria, só `service_role`), e usá-lo no cadastro para avisar a equipe (não precisa barrar sozinho); manter as denúncias abertas/procedentes anonimizadas (sem `reporter_id`) por um prazo; descrever isso na política de privacidade. Alternativa mais simples: recusar `delete_my_account` enquanto houver denúncia aberta contra a conta e pedir contato com o suporte.
- Critério de aceite: teste SQL em que a conta com denúncia procedente é excluída e `signup_taken('documento', …)`/cadastro novo gera marca para a equipe (ou a exclusão é recusada); o texto da política cita o registro mínimo.
- Dependências: decisão do responsável e revisão do advogado (política de privacidade); "ação do responsável".

### D3c-003 — `feed_jobs` não limita o texto da busca: poucos KB de palavras repetidas prendem o banco por segundos (custo cresce com palavras × vagas)

- Área: desempenho
- Severidade: S2
- Esforço: P
- Confiança: confirmado (custo medido no staging); a extrapolação para o volume do mural é estimativa
- Onde: `web/supabase/migrations/20261021000400_u49_busca_vagas.sql:22,29-34,64-72` (mesmo corpo em u52:299-351, u53:20-72, u65:17-71); chamada do app `web/src/services/remote/data.ts:193` (`p_search: q.search.trim() || null`)
- Prova: no staging (11 vagas em Caxias do Sul), `explain (analyze, timing off) select count(*) from feed_jobs('Caxias do Sul','RS',-29.17,-51.18, p_search => …)`: 1 palavra = 58 ms; 1000 palavras iguais (8 KB) = 223 ms; 20000 palavras (180 KB) = **3,7 s**, sempre para as mesmas 11 vagas. A função não corta `p_search` (só `btrim` + `fold_text`) nem deduplica `words`; para cada vaga e **para cada palavra** ela recalcula `fold_text(concat_ws(título, bairro, cidade, UF, sinônimos do ofício))` (linhas 67-70), porque a subconsulta correlacionada roda por elemento de `unnest(o.words)`. Custo medido ≈ 16 µs por par (palavra, vaga). Com 5.000 vagas abertas na área da busca (`p_all_cities` varre todas), 500 palavras (4 KB) já passam de 40 s de CPU; o `statement_timeout` do papel `authenticated` é 8 s (`pg_roles.rolconfig`), então cada pedido gasta 8 s de um banco do plano Free antes de cair.
- Impacto: qualquer conta logada consegue deixar o mural lento ou fora do ar para todo mundo com algumas chamadas paralelas; nem o campo de busca do app tem limite (`web/src/pages/worker/feed/FeedParts.tsx:118`, sem `maxLength`), e a RPC também pode ser chamada direto pela API.
- Causa raiz: a regra "cada palavra precisa estar na vaga" foi escrita como `not exists (… unnest(words) …)` com o texto da vaga calculado dentro do laço, e sem teto de tamanho.
- Correção recomendada: no começo da função, `left(p_search, 60)` e no máximo 6 palavras distintas (`select distinct … limit 6`); calcular o texto dobrado da vaga uma vez por linha (coluna calculada num CTE/`lateral`) e comparar as palavras contra ele; opcional: índice `pg_trgm` na coluna dobrada quando o volume pedir.
- Critério de aceite: o mesmo `explain analyze` com 20000 palavras fica abaixo de 100 ms (texto cortado), e um teste SQL em `u49_busca_vagas.sql` chama a busca com 5000 palavras e confere que responde igual à busca com as 6 primeiras.
- Dependências: nenhuma.

### D3c-004 — WhatsApp único sem prova de posse: dá para "reservar" o número de outra pessoa e derrubar o cadastro dela em andamento

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: provável (código e catálogo; não reproduzido com duas contas)
- Onde: `web/supabase/migrations/20261020000100_u10_dados_unicos.sql:38-54` (`claim_whatsapp_for`: recusa número de conta confirmada, **apaga** `auth.users` do cadastro não confirmado que tem o número), `:77` (índice único `accounts_whatsapp_key`), `:98-99` (`create_account_for` chama a regra), `:157` (`change_whatsapp`); `20261022000200_u63_um_nome_so.sql:50-52` (`create_my_account` só confere o formato com `whatsapp_valid`, `^[1-9][1-9]9[0-9]{8}$`)
- Prova: nenhum caminho de criação exige `whatsapp_verifications`: o código por WhatsApp/SMS é opcional (`whatsapp_recently_verified` só alimenta `whatsapp_verified_at` em `change_whatsapp:158`) e está desligado no lançamento (CLAUDE.md §4, "Twilio … Desligado"). O teste `u10_dados_unicos.sql:36-41` confirma que o cadastro com o número de uma conta confirmada recebe `BC409`, e `:43-51` que o cadastro com o número de um cadastro ainda não confirmado **apaga** esse cadastro. Logo: (a) quem cria uma conta confirmada (basta um e-mail) com o celular de outra pessoa passa a ser o "dono" do número e o dono real, ao se cadastrar, vê "Esse WhatsApp já está em outra conta"; (b) quem digita o número de alguém que está no meio do cadastro (e-mail ainda sem confirmar) apaga o cadastro dessa pessoa. Antes do U10 o número podia repetir; o bloqueio é novo.
- Impacto: um ex-parceiro, concorrente ou golpista trava o WhatsApp da vítima na Bicos (ela não consegue entrar nem trocar para o próprio número) sem ter o celular dela; o suporte não tem rotina para soltar o número (não há RPC `admin_*` para isso; o teste só cobre o caminho feliz).
- Causa raiz: unicidade aplicada a um dado que ninguém comprovou ser seu.
- Correção recomendada: aplicar a unicidade só a número **verificado** (`where whatsapp <> '' and whatsapp_verified_at is not null`) enquanto o código por WhatsApp estiver desligado, ou deixar o número repetir e só avisar; criar uma função da equipe (`admin_release_whatsapp(conta)`) e documentar o pedido ao suporte; não apagar cadastro alheio por causa de número (só por documento já é assim desde a Z07).
- Critério de aceite: teste SQL em que a conta A (não verificada) usa o número e a conta B se cadastra com o mesmo número sem apagar A (ou com a regra escolhida), e outro teste da função da equipe soltando o número.
- Dependências: decisão do responsável (o U10 foi pedido por ele); se o código por WhatsApp for ligado (Twilio, "ação do responsável"), a unicidade passa a fazer sentido só para número verificado.

### D3c-005 — Limites de localização diferentes entre as funções: quem mora em Fernando de Noronha não consegue cadastrar o endereço; UF e cidade da empresa não são conferidas

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado (lista de cidades do app + CHECK no staging)
- Onde: longitude máxima `-34` em `20261021000600_u51_endereco.sql:22,74` (`addresses_lon_check`, `save_address`) e em `finish_sign_up` (`20261020000200_u12…:30`, `u51:136`, `u62:30`, `u67:28`); longitude máxima `-28` em `job_from_draft` (`u01:61`, `u48:291`, `u52:93`); `u67:36` (`v_city !~ ', [A-Z]{2}$'`)
- Prova: `web/src/data/cidades.ts` tem 5.571 cidades; a única fora de `lon <= -34` é "Fernando de Noronha, PE (-3,84; -32,41)". No staging `pg_constraint`: `addresses_lon_check = CHECK (lon >= -74 AND lon <= -34)`. Para essa cidade a vaga é aceita (`-28`), mas o trabalhador recebe "Não achamos esse endereço no mapa" em `save_address` e não completa o perfil. Em `finish_sign_up` da empresa (U67) basta o texto terminar em ", XX": "abc, ZZ" é gravado em `companies.location`, enquanto `save_address` confere os 27 UFs.
- Impacto: cerca de 3 mil moradores da ilha não conseguem se cadastrar como trabalhador; o mural da empresa pode abrir numa "cidade" que não existe (o app cai na cidade padrão, sem quebrar).
- Causa raiz: o mesmo limite (caixa do Brasil) foi copiado em cinco lugares com valores diferentes, e a cidade da empresa é texto livre com só o final conferido.
- Correção recomendada: uma função `public.in_brazil(lat, lon)` (`lon <= -28`) usada por `save_address`, `finish_sign_up`, `job_from_draft` e pelo CHECK de `addresses`; em `finish_sign_up`, conferir o UF contra a mesma lista de 27 siglas.
- Critério de aceite: teste SQL que grava endereço em Noronha (-3.85, -32.42) e recusa "abc, ZZ".
- Dependências: nenhuma.

### D3c-006 — Textos e comentários que ficaram para trás depois do U48/U53/U24 (inclui um "construtora" no aviso de suspensão)

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `20261021000500_u48_publico_geral.sql:70` (`coalesce(…companies.name…, 'construtora')` dentro do aviso "… na construtora foi cancelado pela equipe…", visível no staging em `admin_suspend_account`); `20261021000700_u52_dias_e_local.sql:6` ("o número da casa continua escondido como o resto do endereço") e `20261021000600_u51_endereco.sql:8-10` (ponto "100 a 200 m", sem valor depois do U53 que abre `lat/lon` exatos); `delete_my_account` no staging ("perfil anonimizado, que o histórico do outro lado ainda usa" — o U24 deixou de anonimizar); `anonymize_account` (nome e comentários "As construtoras que ele avaliou"); `web/supabase/tests/u12_perfil_simples.sql:30` ("sem gravar cidade nem endereço" — o U67 grava a cidade da empresa); `web/supabase/tests/u51_endereco.sql:1-2,57-71` (garante o ponto deslocado que o U53 tornou inútil); nomes de fixture "Obra …" em u01, u06, u12, u24, u32, u51
- Prova: varredura de `pg_proc.prosrc` no staging por `construtora|obra|EPI`: só restam nomes internos, comentários e o texto de `admin_suspend_account`. O teste `u48_publico_geral.sql:7-10` procura 15 frases exatas e não inclui `'construtora'` como valor padrão, por isso passa.
- Impacto: o texto "na construtora" hoje não chega a ninguém (o nome da empresa nunca é nulo, então o valor padrão é inalcançável), mas fica como armadilha se o código mudar; quem mantém o banco lê comentários que dizem o contrário do que o código faz (endereço escondido, perfil anonimizado).
- Causa raiz: as migrations só se corrigem por novas migrations (`create or replace` de função inteira), então comentário e texto antigos sobrevivem; o teste de textos confere frases, não padrões.
- Correção recomendada: trocar o valor padrão por 'a empresa'; atualizar os comentários na próxima migration que tocar nessas funções; trocar a lista de frases do teste U48 por uma busca de padrão (`prosrc ~* '\mconstrutora\M'` fora de aspas simples de identificadores internos) com a lista de exceções.
- Critério de aceite: `select proname from pg_proc where prosrc ~ 'Construtora|obra|EPI'` vazio; o teste U48 falha se alguém reintroduzir o texto.
- Dependências: nenhuma.

### D3c-007 — A busca do banco só acha o que está no título, bairro e cidade: os sinônimos são de construção e as vagas novas não têm ofício

- Área: produto
- Severidade: S3
- Esforço: M
- Confiança: confirmado (staging: catálogo e função)
- Onde: `20261021000400_u49_busca_vagas.sql:67-70` (texto pesquisado: título, bairro, cidade, UF e `oficios.nome + sinonimos` da vaga) e, copiado, `u52`, `u53`, `u65`; `20261019000100_u01_vaga_simples.sql:12` (`oficio_id` pode ser nulo e o app não envia mais); `docs/DECISOES.md` U48 ("A tabela `oficios` do banco não mudou (só vagas antigas a usam)")
- Prova: staging `select count(*) from oficios` = 14, todos de obra (armador, azulejista, gesseiro, pedreiro, servente "auxiliar de obra" …). A lista nova de serviços (garçom, limpeza/diarista, babá …) existe só em `web/src/data/oficios.ts`. Uma vaga nova ("Diarista para apartamento", sem ofício) só é achada por palavras do título; "faxina", "limpeza" ou "garçonete" não a encontram, e a descrição também não é pesquisada. O DECISOES U49 promete busca "pelo serviço (o título ou o ofício, com sinônimos)", o que só vale para vagas antigas.
- Impacto: o campo de busca (que é o único jeito de achar um serviço depois que o filtro de ofício saiu, U01) deixa de achar vagas que o trabalhador esperaria; fica pior quando o volume crescer.
- Causa raiz: o catálogo de sinônimos ficou no banco e foi esvaziado de uso pelo U01, sem substituto (categoria na vaga ou pesquisa na descrição).
- Correção recomendada: incluir `description` (e `requirements`) no texto pesquisado, ou guardar uma `category` curta na vaga (lista do `data/oficios.ts`) e pesquisar nome e sinônimos dela; migrar o catálogo `oficios` para a lista nova (ids iguais aos do app).
- Critério de aceite: teste SQL em `u49_busca_vagas.sql`: vaga "Diarista para apartamento" aparece para "faxina" e "limpeza".
- Dependências: decisão do responsável (muda o U49); D3c-003 (a mesma função).

### D3c-008 — Lacunas nos testes SQL u* (regras importantes sem caso negativo, ou com dado que o app não grava)

- Área: testes
- Severidade: S3
- Esforço: M
- Confiança: confirmado (leitura dos 17 arquivos)
- Onde: ver lista; arquivos em `web/supabase/tests/`
- Prova: (1) `u24_exclusao_completa.sql:20-24` — avaliações com as duas chaves (esconde D3c-001); não há caso de empresa excluída com trabalhador `contratado` (o aviso `contratacao_cancelada` não é conferido). (2) `u10_dados_unicos.sql` — o bloco que apaga o número repetido existente (`u10…sql:58-75`) nunca roda no CI (não há repetido); `signup_taken('documento')` só com CPF (não CNPJ nem o ramo `profiles` legado); nada chama `signup_taken` como `anon`; não há teste de duas contas disputando o mesmo número (corrida → `23505` cru em vez de `BC409`). (3) `u49_busca_vagas.sql` — não usa `p_all_cities => true`, nem `%`, `_` ou `\` na busca, nem texto só com palavras de ligação ("de"), nem entrada longa (D3c-003). (4) `u52_dias_e_local.sql` — não cobre `weekdays: [null]` (passa por `job_from_draft` e só cai no CHECK `23514`, medido no staging) nem o aviso aos candidatos em `update_job`. (5) `u53_endereco_publico.sql` — só caso positivo para logado; nada confere que vaga excluída/oculta não entrega rua (a RLS cobre, mas a coluna agora está aberta). (6) `u37_cadastro_google.sql` — não cobre a conta antiga com `profiles.tipo` (a exceção do próprio SQL) nem a não confirmada com `accounts` (ramo antigo). (7) `u12_perfil_simples.sql` — não testa a longitude de Noronha (D3c-005) nem a cidade da empresa depois do U67.
- Impacto: a regra pode quebrar sem o CI avisar, e o CI verde dá confiança que o teste não justifica (caso de D3c-001).
- Causa raiz: testes escritos junto de cada pedido, olhando o caminho feliz e uma recusa por regra.
- Correção recomendada: acrescentar os casos acima; para avaliações, usar sempre `submit_review` na fixture.
- Critério de aceite: cada item acima com um `pg_temp.ok`/`fails` e o CI verde.
- Dependências: D3c-001, D3c-003, D3c-005.

### D3c-009 — Roteiro de aplicação na produção: dados atuais não correm risco, mas há 9 colunas apagadas sem volta, 2 funções removidas e ordem rígida

- Área: processo
- Severidade: M (agora)
- Esforço: P
- Confiança: confirmado (contagens na produção e no staging)
- Onde: `u06` (`drop function close_job`), `u12` (`drop column workers.oficio_id, specialties, companies.tipo_obra`), `u32` (`availability, years_experience, desired_pay, travel_km`), `u63` (`companies.contact_name`), `u65` (`drop function feed_jobs(12 args)`), `u62` (`delete from addresses` de empresas), `u10` (zera WhatsApp repetido), `u37` (limpeza de logins Google sem conta)
- Prova: produção (`ppnxdajiihsjaojxokzh`, só `count(*)` e catálogo): última migration aplicada `20261012033541`; faltam as 25 do repositório. Contagens: `jobs` 0, `reviews` 0, `reports` 0, `job_alerts` 0, `accounts` 4, `workers` 1, `companies` 3; trabalhadores com ofício/especialidades preenchidos 0, com os 4 campos do U33 preenchidos 0, `bio` > 500 caracteres 0, empresas com `tipo_obra` ou `contact_name` 0; WhatsApp repetido 0; empresas "Construtora (conta excluída)" 0; contas sem e-mail confirmado 0. Pré-requisitos presentes: gatilho `touch_job_v2` em `jobs` e `area_lat` gerada (o bloco do U51 depende dos dois). Staging: as 67 versões e os corpos finais conferem com o repositório (consulta de assinatura em 12 funções e objetos: `feed_jobs` com 13 argumentos, gatilho `jobs_area_point`, índice `accounts_whatsapp_key`, `account_prefs` no Realtime, `close_job` ausente).
- Impacto: aplicar em ordem hoje não perde dado nenhum. O risco está no processo: a produção está no plano Free sem backup diário, nenhuma migration tem volta, e o `U24` muda a exclusão de conta para apagar tudo (irreversível) assim que for aplicado.
- Causa raiz: n/a (registro).
- Correção recomendada: antes do "pode": (1) `pg_dump` manual; (2) aplicar em ordem `lanc06 … r04, u01 … u67` (os `u*` usam funções de `lanc06`, `lanc07`, `r03`, `r04`) e só depois publicar as Edge Functions `verificar-cadastro` (precisa de `signup_taken`, U10) e `entrar-com-firebase`; (3) repetir as contagens acima logo antes (se alguém criar dados reais entre hoje e lá, `u10`, `u12`, `u32` e `u63` passam a apagar ou zerar dado de verdade); (4) publicar o app novo junto com o U06/U65 (o app antigo ainda chama `close_job`); (5) rodar `supabase/tests/*.sql` na produção (cada teste termina em `rollback`) e o advisor de segurança depois.
- Critério de aceite: lista acima executada e registrada em `CHECKLIST-LANCAMENTO.md`.
- Dependências: "ação do responsável" (o "pode" e o backup).

## Hipóteses não confirmadas

- **`weekdays: [null]` e `lat: "abc"` na vaga**: `job_from_draft` deixa passar `{NULL}` (medido no staging: devolve `weekdays = {NULL}`) e dá `22P02` no `lat` não numérico; o INSERT cairia no CHECK `jobs_weekdays_check` (`23514`). O client traduz `22P02`/`23514` como `validacao` (`services/remote/client.ts:35-36`), então só a mensagem fica genérica e só com chamada feita à mão. Não tratado como achado.
- **`signup_taken('email')`** compara `lower(email) = lower(v)` em `auth.users`: sem índice em `lower(email)` pode varrer a tabela inteira a cada pergunta. Não medido (poucos usuários); o limite de 30 por IP da Edge Function atenua.
- **`terms_acceptances` some com a conta** (`on delete cascade` de `accounts`): a prova de que a pessoa aceitou os termos deixa de existir depois da exclusão. Depende de a política jurídica exigir guardar o aceite por prazo (ação do advogado); relacionado a D3c-002.
- **Pagamentos de impulso apagados com a empresa** (`boost_payments` `on delete cascade` de `companies`/`jobs`): decisão registrada em DECISOES U24 (o comprovante fica no Mercado Pago); se o contador pedir o histórico na Bicos, vira problema fiscal. Não é falha do código.
- **Corrida no WhatsApp**: dois cadastros ao mesmo tempo com o mesmo número passam em `claim_whatsapp_for` e o segundo cai no índice único (`23505`, traduzido para `conflito`), sem a mensagem `BC409` correta. Não reproduzido (precisa de duas sessões).
- **Distância no mural** (`feed_jobs`, `u51`): o filtro e a ordenação usam o ponto deslocado (`area_geog`, até 200 m do exato) e o card passa a mostrar o ponto exato depois do U53; diferença de até 200 m. Não medido no app.

## Bom e deve ser preservado

- **U48 é cópia fiel**: comparei as 13 funções com a última definição anterior (script `work/funcdiff.py`): a diferença é só de texto (obra/construtora/EPI). Foi uma boa decisão manter a mesma assinatura e os mesmos grants. Frágil: `create or replace` de função inteira só para trocar texto reverte qualquer mudança paralela; sempre diffar antes.
- **Endereço privado do trabalhador**: `addresses` tem RLS própria (`account_id = auth.uid()`), sem `insert/update/delete` para `authenticated` (conferido em `column_privileges`), gravação só por `save_address` (revogada de `public, anon, authenticated`) e leitura de volta em `export_my_data`. O perfil público guarda só a cidade e o ponto a 0,01° (`save_address`, testado em `u51`).
- **Limites do app e do banco batem**: preço R$ 80–5.000 (`jobForm.ts` ↔ `job_from_draft`; o CHECK da tabela é mais folgado, até 100.000, como segunda trava), título 60, descrição 20–1000, pessoas 1–50, diárias 1–60, bio e "sobre" 500, experiências 10×(2–80).
- **Busca sem injeção**: `feed_jobs` usa `position()` sobre texto "dobrado" e `regexp_split_to_table` com padrão fixo, sem `LIKE` com entrada do usuário e sem SQL dinâmico; `p_limit` é limitado a 60 e a ordenação usa chave estável com cursor.
- **Migrations idempotentes na prática**: `if not exists`, `create or replace`, `drop … if exists`, blocos `do $$` com `duplicate_object` e guardas por catálogo (U51 conferindo `attgenerated`/expressão antes de mexer); o único `delete` em massa (U62) tem `where` por junção de papel; o `update` de dados do U48 tem `where` por texto.
- **U30/U32/U62/U65**: RLS própria com `(select auth.uid())`, `revoke` + `grant` explícitos, e no U65 a função nova recebe de volta o `revoke/grant` depois do `drop`. Compatibilidade com o app aberto antes da versão (`p_min_pay` por último, `p_contact_name` ignorado, `finish_sign_up` aceita o formato antigo).
- **Testes**: `u06` (assertiva por `sqlstate` + mensagem exata), `u51` (negativos `42501`/`BC422`, `anon`, exclusão em cascata), `u52`, `u65` e `u30` testam recusa de papel/anon e não só o caminho feliz.
