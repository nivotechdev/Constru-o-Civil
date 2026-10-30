# D5 — Achados LGPD (Frente 3)

Escopo: `legal/politica-de-privacidade.md`, `legal/termos-de-uso.md`, `web/docs/LGPD.md`, `web/src/services/legal.ts`, confrontados com migrations, RPCs, Edge Functions, serviços do front, Storage, staging (estrutura/contagens) e produção (estrutura/contagens). Commit auditado `67d9ffb`. Mapa completo em `lgpd-tabela.md`.

Contagem: S0 0, S1 5, S2 9, S3 8, M 1 (total 23).

Observação de escala: nenhum achado foi marcado S0 porque o app ainda não tem usuários reais (produção: 4 contas, 0 selfies; staging: só dados de teste). D5-001, D5-002 e D5-003 viram S0 no dia em que o primeiro dado real de selfie/endereço entrar sem correção.

### D5-001 — A limpeza que apaga selfie/documento (30 dias), arquivos órfãos e sobras de exclusão não roda em nenhum ambiente, e o cron aparece como "sucesso"

- Área: LGPD
- Severidade: S1 alto (vira S0 no primeiro envio real de selfie: hoje só há arquivos de teste)
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261014000400_x09_arquivos_orfaos.sql:73` (`call_storage_cleanup`: `if v_url is null or v_secret is null then return;`), `web/supabase/functions/limpar-arquivos/index.ts:12,29`, `web/supabase/migrations/20261016000300_lanc12_vigia_cron.sql:101-120` (`check_cron_failures` só olha status `failed`), `legal.ts:130,156` (promessa de 30 dias)
- Prova: staging (`setyxomsbfrkneqqfoam`), consultas só de contagem: `storage.objects` do bucket `identidade` = 142 arquivos, criados de 19/10 a 24/10/2026; `identity_submissions` = 0 linhas; `orphan_storage_objects(1000)` devolve os 142 de `identidade` (279 no total) — ou seja, todos já deviam ter sido apagados. `vault.secrets` do staging só tem `nivotech_documento_key` (sem `bicos_cleanup_url`/`bicos_cleanup_secret`). `cron.job_run_details` do job `bicos-limpar-arquivos`: 11 execuções `succeeded` (última 29/10 04:40), porque `call_storage_cleanup` sai em silêncio sem os segredos. Produção (`ppnxdajiihsjaojxokzh`): Vault tem os 2 segredos, mas `net._http_response` tem uma resposta 401 (função sem `CLEANUP_SECRET`) e 18 execuções `succeeded` do cron; `web/docs/SUPABASE.md:129` admite "a chamada diária é recusada (401) e nada é apagado". Produção ainda tem 0 arquivos em `identidade`.
- Impacto: a Política (seção 3 e 6) promete que selfie e foto do documento (dado biométrico sensível, art. 11) são apagadas 30 dias após a decisão. Hoje nada as apaga, e ninguém é avisado, porque o painel de cron mostra tudo verde.
- Causa raiz: o apagamento depende de 3 peças configuradas à mão (segredo no Vault, `CLEANUP_SECRET` na função, URL), e a falta de qualquer uma é tratada como "nada a fazer" (sem erro, sem alerta). O vigia de cron (L12) só detecta `failed`; um `succeeded` que não fez nada, ou um HTTP 401/429 no `pg_net`, passa batido.
- Correção recomendada: (1) configurar as 3 peças em produção e staging; (2) `call_storage_cleanup` deve levantar erro (ou gravar em `cron_alerts`) quando faltar segredo; (3) `check_cron_failures` deve também olhar `net._http_response` com status ≠ 2xx da última chamada; (4) um teste/consulta de saúde: "existe arquivo de `identidade` com mais de 31 dias sem linha em `identity_submissions` ou decidida há mais de 30 dias" = alerta; (5) apagar à mão os 142 arquivos de teste do staging.
- Critério de aceite: staging: `select count(*) from public.orphan_storage_objects(1000)` = 0 no dia seguinte à configuração; `storage.objects` de `identidade` sem arquivo órfão; ao remover o segredo de propósito, o cron passa a `failed` ou gera linha em `cron_alerts`.
- Dependências: ação do responsável (criar `CLEANUP_SECRET` na função; já documentado em SUPABASE.md:129). Relacionado a D5-002.

### D5-002 — Excluir a conta não apaga a selfie e o documento na hora: a função só limpa 3 pastas; as fotos de identidade ficam para o cron (e só depois de 1 dia)

- Área: LGPD
- Severidade: S1
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/functions/excluir-conta/index.ts:18` (`const BUCKETS = ['avatars', 'portfolio', 'vagas']`), `web/supabase/migrations/20261014000400_x09_arquivos_orfaos.sql:33-70` (`identity_files`: `o.created_at < now() - interval '1 day'`), `web/src/services/legal.ts:155` ("Ao excluir a conta, apagamos na hora seus dados, arquivos…"), `web/docs/DECISOES.md` R04 ("os arquivos ficam sem uso e orphan_storage_objects os pega")
- Prova: `excluir-conta` roda `delete_my_account` (que apaga as linhas de `identity_submissions` por cascata, `anonymize_account`) e depois remove só `avatars`, `portfolio` e `vagas` da pasta `<uid>/`. O bucket `identidade` não aparece no código. Os objetos só saem pelo cron `bicos-limpar-arquivos` (04:40 UTC), e `orphan_storage_objects` só considera arquivos com mais de 1 dia. Com D5-001 (cron sem efeito), a selfie e o documento de uma conta excluída permanecem indefinidamente. O mesmo vale para a exclusão feita pelo painel do Supabase (`on_auth_user_deleted`).
- Impacto: a pessoa pede para apagar tudo e a foto do rosto e do documento dela continuam guardadas, contra o que a Política promete e contra o art. 18, VI (eliminação) para dado sensível.
- Causa raiz: a lista de buckets da função foi escrita antes do bucket `identidade` (F07) e a decisão do R04 delegou o apagamento ao cron.
- Correção recomendada: incluir `identidade` em `BUCKETS` (a pasta `<uid>/` é a mesma). Para a exclusão pelo painel (sem passar pela função), contar com o cron depois que D5-001 estiver resolvido, mas tirar a espera de 1 dia quando o dono do arquivo já não existe (`not exists (select 1 from auth.users where id::text = (storage.foldername(o.name))[1])`). Não apagar direto em `storage.objects`: o gatilho `protect_objects_delete` do Supabase só aceita a API do Storage.
- Critério de aceite: teste (Deno/Vitest com fake) em que `excluir-conta` remove a pasta `identidade/<uid>/`; em staging, subir selfie, excluir a conta e conferir `storage.objects` = 0 para o uid, sem esperar o cron.
- Dependências: nenhuma (código). Relacionado a D5-001.

### D5-003 — O mapa envia a casa do trabalhador (coordenada de rua, 6 casas) e o IP a servidores públicos de terceiros (OSRM e OpenStreetMap), coisa que a Política nega e não lista

- Área: LGPD
- Severidade: S1
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/components/JobMap.tsx:47-55` (`origin = home`, `drivingRoute(origin, job…)`), `web/src/pages/worker/JobDetail.tsx:274` (`home={role === 'trabalhador' ? workerHome(db) : null}`), `web/src/services/selectors.ts:33-40` (`workerHome` usa primeiro a linha de `addresses`, 6 casas), `web/src/services/route.ts:10-11,41-43` (`router.project-osrm.org`, `routing.openstreetmap.de`), `web/public/_headers` (CSP libera `tile.openstreetmap.org`, `router.project-osrm.org`, `routing.openstreetmap.de`), `web/supabase/migrations/20261021000600_u51_endereco.sql` (`addresses.lat/lon` com 6 casas, `save_address`), `web/src/services/legal.ts:119,147`
- Prova: ao abrir o detalhe de uma vaga, o navegador do trabalhador faz `GET https://router.project-osrm.org/route/v1/driving/<lon_casa>,<lat_casa>;<lon_vaga>,<lat_vaga>` (o comentário do U54 diz "só duas coordenadas, sem nome nem conta", mas o ponto de origem é o endereço salvo da pessoa, rotulado "da sua casa" na tela, e a requisição leva o IP do aparelho). A Política (seção 2, linha 119) diz do endereço: "Fica só com você: no perfil aparece só a cidade, e as empresas veem só um ponto aproximado"; e (seção 5, linha 147) só cita OpenStreetMap "Nominatim e Photon" para achar endereço. Não cita os mapas (`tile.openstreetmap.org`, que recebe o IP e a região vista) nem o cálculo de rota (OSRM público, mantido na Alemanha pela comunidade OSM/FOSSGIS).
- Impacto: a cada vaga aberta, a localização da casa de cada trabalhador e o IP dele chegam a operadores que a pessoa nunca foi avisada que existem. Para quem confia no "fica só com você", é quebra de transparência (art. 6, VI; art. 9, art. 7).
- Causa raiz: serviços gratuitos de mapa/rota chamados direto do navegador; a Política foi escrita a partir de `docs/LGPD.md`, que não tem tiles nem rota.
- Correção recomendada: (a) declarar na Política os provedores de mapa e de rota, com a finalidade e o dado enviado (coordenada de origem e destino, IP), e a base legal; (b) reduzir o dado: arredondar a origem para 2 casas (≈1 km) antes de chamar a rota, ou calcular a rota por uma função própria no servidor (sem IP do usuário), ou só mostrar a linha reta; (c) considerar mapa próprio/pago com contrato (OSRM público é "demo" e sem garantia).
- Critério de aceite: teste de `route.ts` mostrando que a coordenada enviada tem no máximo 2 casas decimais (ou que a chamada sai pelo servidor); Política lista tiles e rota; `headers.test.ts` continua verde.
- Dependências: decisão do produto (ação do responsável) sobre o provedor de rota/mapa.

### D5-004 — Não existe guarda dos registros de acesso por 6 meses (Marco Civil, art. 15); a Política deixa o prazo em branco

- Área: LGPD
- Severidade: S1
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:157` (`{{PRAZO_REGISTROS_ACESSO}}`), `web/docs/LGPD.md:35,66-68` (achado 4), `web/supabase/migrations/20261014000700_x22_limpeza_tentativas.sql` e `20261016000200_lanc10_link_publico.sql:93` (`purge_auth_attempts`: apaga `auth_attempts` com 1 dia)
- Prova: o único registro próprio de IP é `auth_attempts` (chave com IP, 1 dia) e `public_link_hits` (hash do IP, 1 dia). O Supabase Free guarda os logs por cerca de 1 dia (LGPD.md:35, 66). Não há tabela, dreno de logs ou rotina que preserve IP + data/hora + porta de cada acesso por 6 meses. O texto da Política cita o Marco Civil art. 15 como fundamento ("Para cumprir a lei (art. 7º, II): registros … de acesso") sem que exista o registro.
- Impacto: a empresa afirma que guarda e não guarda: descumpre o dever legal de provedor de aplicações (se a NivoTech se enquadra: pessoa jurídica, atividade econômica organizada) e não consegue atender uma ordem judicial pedindo o IP de quem publicou algo.
- Causa raiz: decisão adiada para o advogado/sócios (LGPD.md achado 4); o produto não tem tabela de logs.
- Correção recomendada: decidir com o advogado se o art. 15 se aplica; se sim, gravar o login/ações relevantes (IP, data e hora, versão do app) numa tabela própria com retenção de 6 meses e acesso restrito (ou plano com dreno de logs), declarar o prazo na Política; se não, tirar a promessa do texto.
- Critério de aceite: Política com o prazo preenchido e coerente com o que o banco guarda; consulta mostrando registros com 6 meses de idade e expurgo depois.
- Dependências: ação do responsável (advogado e plano de hospedagem).

### D5-005 — Política e Termos publicados com 10 campos em branco (controlador, encarregado, prazos, base da transferência) e sem revisão jurídica; o build de produção barra, mas o conteúdo exigido pela LGPD não existe ainda

- Área: LGPD
- Severidade: S1
- Esforço: P (preencher) / depende do advogado
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:22` (`LEGAL_REVIEWED = false`), campos `{{RAZAO_SOCIAL}}` `{{CNPJ}}` `{{ENDERECO}}` `{{DPO_NOME}}` `{{DPO_EMAIL}}` (3 usos) `{{CIDADE_FORO}}` `{{PRAZO_PAGAMENTOS}}` `{{PRAZO_REGISTROS_ACESSO}}` `{{PRAZO_AUDITORIA}}` `{{BASE_TRANSFERENCIA_INTERNACIONAL}}`; `web/build/env.ts:99-122`; `web/vite.config.ts:42-45`; `web/docs/CHECKLIST-LANCAMENTO.md:46,139-140`
- Prova: `legalProblems()` junta os `{{…}}` encontrados nos textos e os registra como erro **não escapável** em modo `production`; a variável `BICOS_PILOTO_SEM_REVISAO_JURIDICA=1` só dispensa a falta de revisão, nunca os campos em branco (`escapable: false`, `web/build/env.ts:105`). O CI tem passo que exige a falha (`.github/workflows/web.yml:58-70`). Então o piloto fechado também **não sobe** enquanto os 10 campos distintos não forem preenchidos. Está certo como trava; o achado é o que falta no conteúdo: sem controlador, encarregado e canal (art. 9, I e art. 41 §1), sem prazo de guarda (art. 9, II) e sem base da transferência internacional (art. 33) o texto não cumpre a LGPD, e o aviso "Rascunho para revisão jurídica" aparece nos builds de teste.
- Impacto: nenhum usuário real pode ser aceito legalmente antes disso; o site de teste (GitHub Pages, que usa `npm run build:staging`, `.github/workflows/site.yml:58`) mostra os campos `{{...}}` crus a quem abrir a Política.
- Causa raiz: faltam decisões e dados da empresa (razão social, CNPJ, encarregado, prazos fiscais) e o parecer do advogado.
- Correção recomendada: o responsável envia os 10 dados; o advogado revisa; só então `LEGAL_REVIEWED = true` e `LEGAL_WRITE=1 npx vitest run legal`. Enquanto isso, o site de teste deve avisar que não é para dados reais. Lista de prazos sugeridos para decidir: pagamentos (fiscal, 5 anos, ver D5-009), registros de acesso (6 meses, D5-004), auditoria da equipe (D5-010).
- Critério de aceite: `grep -c "{{" web/src/services/legal.ts` = 0; build de produção passa; advogado assinou.
- Dependências: ação do responsável (dados da empresa, advogado). D5-004, D5-009, D5-010, D5-014.

### D5-006 — Firebase/Google (login por Google e por celular) não é citado como operador e o usuário nunca é apagado de lá; reCAPTCHA, Turnstile e SDK do Mercado Pago contradizem "sem rastreadores de terceiros"

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: confirmado (código); retenção do lado do Google não verificável daqui
- Onde: `web/src/services/legal.ts:147` (operadores: "Google (login, se você escolher; EUA)" e "Twilio (código por WhatsApp ou SMS)"), `legal.ts:177` ("Não usamos cookies de publicidade nem rastreadores de terceiros"), `web/supabase/functions/entrar-com-firebase/index.ts`, `web/supabase/functions/excluir-conta/index.ts` (nenhuma chamada ao Firebase), `web/src/services/remote/firebase.ts:162,198` (só `signOut` local), `web/public/_headers` (CSP libera `apis.google.com`, `www.google.com`, `www.gstatic.com`, `recaptcha.google.com`, `identitytoolkit.googleapis.com`, `sdk.mercadopago.com`, `http2.mlstatic.com`, `challenges.cloudflare.com`), `web/src/components/Captcha.tsx`, `web/src/components/MercadoPagoCardForm.tsx`
- Prova: `grep -rniE "deleteUser|accounts:delete" web/supabase/functions web/src` não encontra nada: ao excluir a conta da Bicos, o registro da pessoa no projeto Firebase `bicoapp-6cc68` (e-mail, nome e foto do Google; ou telefone, no login por SMS) continua lá. `grep -i firebase` em `legal.ts` e em `docs/LGPD.md` = vazio: a Política só fala em "Google (login)", e o código do SMS do login por celular (U28) sai pelo Firebase/Google, não pelo Twilio que a Política cita para "código por WhatsApp ou SMS". O reCAPTCHA invisível do login por celular, o Turnstile (cadastro/login) e o SDK do Mercado Pago (tela de pagamento com cartão) carregam scripts de terceiros que gravam identificadores no aparelho; a seção 9 afirma o contrário em termos absolutos.
- Impacto: a pessoa exclui a conta "por completo" e o telefone/e-mail dela ficam num serviço do Google que a Política não descreve; e o aviso de privacidade diz que não há terceiros de rastreio quando há.
- Causa raiz: o U28 (Firebase) entrou depois da Política 2.0 e nunca foi refletido nela; a exclusão foi desenhada só para Supabase.
- Correção recomendada: (1) incluir Firebase Authentication/Google (finalidade, dado, país) e reCAPTCHA na lista de operadores; trocar o texto da seção 9 por "só usamos o necessário para o funcionamento e a segurança (captcha, pagamento), sem publicidade"; (2) na `excluir-conta`, chamar a API Admin do Identity Toolkit (`accounts:delete`) para o uid do Firebase (localizável pelo e-mail/telefone; ou guardar o `uid` em `accounts`) com conta de serviço, ou usar a opção de apagar usuários do console e documentar o prazo; (3) conferir no console do Firebase que Analytics está desligado.
- Critério de aceite: Política cita Firebase e reCAPTCHA; teste de `excluir-conta` com fake do Firebase mostrando a chamada de exclusão; staging: criar usuário Google/celular de teste, excluir a conta e ver o usuário sumir do Firebase.
- Dependências: ação do responsável (credencial de serviço do Firebase; revisão do advogado). D5-014.

### D5-007 — "Exportar meus dados" não traz tudo o que a Bicos guarda sobre a pessoa, mas a tela e a Política dizem que traz

- Área: LGPD
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000600_u51_endereco.sql:205` (versão atual de `export_my_data`), `web/src/pages/shared/Privacy.tsx` ("baixar uma cópia de tudo o que a Bicos guarda sobre você"), `web/src/services/legal.ts:163`
- Prova: a função (lida em `pg_get_functiondef` no staging) devolve conta (sem `whatsapp_verified_at`, `suspended_at`), endereço, perfil, vagas, candidaturas com histórico, avaliações (as duas direções), vagas salvas, portfólio, notificações, pagamentos (sem `pix_code`), aceites e metadados da verificação de identidade. **Não** traz: `blocks` (quem a pessoa bloqueou), `reports` (denúncias que ela fez), `job_alerts` (alerta de vaga, com coordenadas e raio), `job_invites`, `push_subscriptions` (endpoint e `user_agent` do aparelho), `notification_prefs`, `account_prefs` (tema), `company_members`, `application_attempts`, o motivo de suspensão (`accounts.suspended_reason`), as decisões da equipe sobre ela (`staff_actions`) e as próprias fotos da selfie/documento (só datas). Dois nomes enganam: a chave `avaliacoes_recebidas` também traz as avaliações que a pessoa escreveu. Na produção a função ainda é a versão anterior (sem aceites, sem endereço).
- Impacto: a pessoa recebe um arquivo que parece completo e não é; descumpre o art. 18, II (acesso) e o art. 19, §3º, e a tela afirma o contrário.
- Causa raiz: a função foi montada tabela a tabela e cada tabela nova (U51 `addresses`, `job_alerts`, `blocks`, tema) não entrou; não há teste que compare as tabelas com `account_id`/`worker_id`/`company_id` com o que a exportação cobre.
- Correção recomendada: incluir as tabelas que faltam (sem expor dado de terceiros: de `blocks` só o id e a data; de `reports` só as que a pessoa fez); renomear `avaliacoes_recebidas` para `avaliacoes`; trocar o texto da tela para "seus dados" se algo ficar de fora de propósito (ex.: denúncias contra você) e dizer o motivo; teste SQL que percorre `information_schema` (colunas `worker_id`, `company_id`, `account_id`, `user_id`, `reporter_id`, `blocker_id`) e falha se uma tabela nova não estiver coberta ou numa lista de exceções.
- Critério de aceite: teste SQL novo `export_cobre_todas_as_tabelas` verde; o JSON de uma conta de teste tem as chaves novas.
- Dependências: nenhuma.

### D5-008 — O "hash do documento" é SHA-256 sem segredo: com um vazamento do banco ou de backup, os CPFs saem em minutos (e a máscara mostra 6 dos 9 dígitos); a Política diz "CPF e CNPJ ficam cifrados"

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: confirmado (código); a reversão em si é cálculo, não foi executada
- Onde: `web/supabase/migrations/20261009000200_bicos_v2_rules.sql:140` (`document_hash` = `digest(digits, 'sha256')`, `IMMUTABLE`, sem sal nem chave), `mask_document` (CPF `***.NNN.NNN-**`), `web/supabase/functions/entrar-com-documento/index.ts:45` (`'doc:' + sha256Hex(documento)` gravado em `auth_attempts.key`), `verificar-cadastro/index.ts:67`, `web/src/services/legal.ts:114,170`
- Prova: `select pg_get_functiondef('public.document_hash'::regproc)` no staging mostra `encode(extensions.digest(regexp_replace(...), 'sha256'), 'hex')`. Um CPF tem 9 dígitos livres (≈10^9 combinações) — uma placa de vídeo comum calcula isso em segundos. Quem tem a coluna `accounts.document_hash` (dono do banco, service_role, cópia de segurança, `pg_dump`) recupera todos os CPFs sem precisar da chave do Vault, o que anula a cifra de `document_cipher`. A coluna `accounts.document` guarda `***.123.456-**`, ou seja, 6 dígitos em claro, e reduz a busca a ~1000 tentativas por conta. Os grants por coluna impedem o `select` do app (conferido: `document_hash` e `document_cipher` não estão nos grants de `authenticated`), então o risco é de vazamento do banco/backup/service_role, não de IDOR.
- Impacto: a promessa "CPF e CNPJ ficam cifrados" vale só para quem não olha o hash; um incidente com o banco expõe todos os CPFs dos trabalhadores.
- Causa raiz: o hash foi desenhado só para busca (login por documento), sem pensar em força bruta sobre um espaço pequeno.
- Correção recomendada: trocar por HMAC-SHA256 com uma chave do Vault (`nivotech_documento_pepper`, diferente da de cifra), recalculando os hashes a partir de `document_cipher` numa migration; usar o mesmo HMAC nas chaves de limite (`doc:`); reduzir a máscara do CPF para os 2 últimos dígitos ou nenhum. Alternativa: manter o SHA-256 e declarar o risco ao advogado.
- Critério de aceite: teste SQL mostrando que `document_hash('123.456.789-09')` muda com a chave e que o login por documento continua funcionando; `accounts.document` sem 6 dígitos.
- Dependências: migração em produção só com "pode" (ação do responsável).

### D5-009 — Pagamentos: a Política diz que guarda "por obrigação fiscal", mas excluir a conta apaga `boost_payments` na hora; o prazo está em branco

- Área: LGPD
- Severidade: S2
- Esforço: P (texto) / M (se for preciso reter)
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:155,157` (`Pagamentos: {{PRAZO_PAGAMENTOS}}, por obrigação fiscal`), `web/docs/LGPD.md:33` (base art. 7, II, "5 anos?"), `web/supabase/migrations/20261020000300_u24_exclusao_completa.sql` (`delete from public.companies` → `boost_payments_company_id_fkey ON DELETE CASCADE`), `web/docs/DECISOES.md` U24 ponto (2)
- Prova: FK `boost_payments.company_id → companies ON DELETE CASCADE` e `boost_payments.job_id → jobs ON DELETE CASCADE` (consulta a `pg_constraint` no staging); `anonymize_account` apaga `jobs` e `companies` da empresa. A decisão U24 documenta que "o comprovante fiscal fica no Mercado Pago". A Política, porém, anuncia que a Bicos guarda o registro do pagamento pelo prazo fiscal. Duas coisas não podem ser verdade ao mesmo tempo. `payment_webhook_events` (id do evento e do pagamento no Mercado Pago) não tem expurgo nem dono e fica depois da exclusão.
- Impacto: ou a empresa não consegue provar a receita do impulso em fiscalização (se a obrigação existe), ou a Política diz que retém o que apaga. Em qualquer caso o texto está errado.
- Causa raiz: a regra de exclusão total (pedido do responsável, U24) e o mapa da LGPD (L07) foram escritos em momentos diferentes.
- Correção recomendada: o contador responde se a Bicos tem de guardar o registro de cada cobrança (valor, data, id do Mercado Pago, CNPJ/CPF do pagador); se sim, manter uma tabela mínima `payments_ledger` sem vaga nem nome, com prazo fiscal, fora da cascata, e declarar; se não, trocar o texto por "o comprovante fica com o Mercado Pago".
- Critério de aceite: Política e banco dizem a mesma coisa; teste SQL de exclusão conferindo o que sobra de pagamento.
- Dependências: ação do responsável (contador/advogado).

### D5-011 — Retirar o consentimento da selfie/documento não tem caminho no app nem ferramenta da equipe; a Política promete "a qualquer momento"

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:130,197-202` (`IDENTITY_CONSENT.points`: "pela Ajuda ou pelo e-mail de privacidade"), `web/src/pages/shared/Help.tsx` (sem pergunta sobre selfie/consentimento), `web/src/pages/shared/Privacy.tsx` (só exportar e excluir), RPCs de equipe (`admin_decide_identity`, `admin_identity_queue`, `set_identity_status`: nenhuma apaga as fotos ou o selo a pedido)
- Prova: `grep -rn "withdraw_identity\|retirar_consent\|revoke_consent" web/supabase/migrations web/src` = vazio; lista de funções do `public` no staging não tem nenhuma de retirada. O único caminho é escrever ao suporte, e a equipe teria de apagar os arquivos à mão no painel do Storage e rodar SQL para tirar o selo (sem trilha em `staff_actions`, porque o painel não passa por `staff_log`). O art. 8, §5 pede procedimento gratuito e facilitado, e o art. 18, IX permite revogar a qualquer tempo.
- Impacto: quem se arrepende de ter mandado a foto do rosto e do documento não tem botão; depende de alguém lembrar de apagar.
- Causa raiz: o consentimento foi implementado (L07) só na entrada.
- Correção recomendada: botão "Retirar minha selfie e meu documento" em Configurações › Privacidade e dados (visível se há envio), que chama um RPC `withdraw_identity()`: apaga as linhas e os arquivos (ver D5-002), tira o selo e grava o motivo. Mostrar o e-mail do encarregado nessa tela.
- Critério de aceite: teste SQL e e2e: enviar, retirar, conferir `storage.objects`, `identity_submissions` e `workers.identity_status`.
- Dependências: D5-002.

### D5-012 — O gatilho do app antigo continua copiando nome e e-mail de cada cadastro novo para `profiles`; as 7 tabelas antigas seguem guardadas sem uso, fora da Política e da exportação

- Área: LGPD
- Severidade: S2
- Esforço: P (aplicar o SQL pronto) — mas exige "pode" na produção
- Confiança: confirmado
- Onde: `web/supabase/legado/000_baseline.sql:356,395` (`criar_perfil_ao_cadastrar`, gatilho `on_auth_user_created`), `web/supabase/pendentes/20261015000900_lanc07_apagar_app_antigo.sql` (não aplicado), `web/docs/LGPD.md:40,60-62`, `web/supabase/migrations/…` (funções `document_login_email`, `signup_taken` ainda consultam `profiles`)
- Prova: staging: `information_schema.triggers` lista `on_auth_user_created … EXECUTE FUNCTION criar_perfil_ao_cadastrar()`; `profiles` tem 12 linhas, igual a `auth.users` (12): cada conta nova duplica nome e e-mail. Produção: `profiles` = 4 linhas, 3 com `documento_cifrado`, 1 com WhatsApp, 1 com foto; `vagas` = 3, `consentimentos` = 2; tabelas fechadas por RLS sem política (nada sai pela API) e as RPCs antigas não são executáveis por `authenticated` (testado com `has_function_privilege`), então não há vazamento — o problema é guarda sem finalidade. A Política não menciona essas tabelas, a exportação não as traz, e `docs/LGPD.md` já reconhece "dado duplicado sem finalidade".
- Impacto: dados pessoais (inclusive CPF cifrado de 3 contas reais) guardados depois que a finalidade acabou (art. 15, I e art. 16): se alguém pedir acesso, não está na exportação; se pedir exclusão, a cascata de `auth.users` apaga, mas a existência dessas cópias não é informada.
- Causa raiz: o apagamento do app antigo ficou em `pendentes/` à espera de "pode" e backup (`scripts/exportar-app-antigo.sh`).
- Correção recomendada: decidir (sócios) e executar o `pendentes/…_lanc07_apagar_app_antigo.sql` em staging e depois em produção (com backup antes, como manda CLAUDE.md §9); até lá, tirar o gatilho (`drop trigger on_auth_user_created`) para parar de copiar dados novos.
- Critério de aceite: `select count(*) from information_schema.tables where table_name in ('profiles','vagas','candidaturas','avaliacoes','vagas_salvas','publicacoes_trabalhador','consentimentos')` = 0; cadastro novo não cria linha antiga.
- Dependências: ação do responsável ("pode" e backup). Hipótese ligada: base legal e prazo para continuar guardando (nenhum).

### D5-013 — Transferência internacional sem base declarada: 6 operadores listados fora do Brasil (e pelo menos 4 não citados) e nenhuma prova de contrato com cláusulas-padrão da ANPD

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: confirmado (texto); contratos não verificáveis
- Onde: `web/src/services/legal.ts:147-148` (`{{BASE_TRANSFERENCIA_INTERNACIONAL}}`), `web/docs/LGPD.md:42-56` (tabela de operadores e "conferir com o advogado")
- Prova: a Política lista Supabase (empresa nos EUA), Cloudflare (mundial), Twilio (EUA), Sentry (EUA), Brevo (França), Google (EUA) e diz "A transferência segue o art. 33 da LGPD ({{BASE…}})" — campo em branco. Ficam de fora da lista, mas recebem dado do usuário: Firebase/Google reCAPTCHA (D5-006), OpenStreetMap tiles/OSRM (D5-003; Alemanha/Reino Unido), GitHub Pages (hospeda o site de teste; EUA). A Resolução CD/ANPD nº 19/2024 exige que a transferência use cláusulas-padrão (ou outra hipótese do art. 33) e que o contrato com cada operador as inclua; não há no repositório contrato, DPA nem registro de aceite deles (`grep -riE "\bdpa\b|cláusulas" web/docs` acha só a nota do `LGPD.md:55` e o item pendente `web/docs/CHECKLIST-LANCAMENTO.md:49` "Assinar os termos de tratamento (DPA) com Supabase, Cloudflare, Twilio, Sentry, Brevo" — sem Google/Firebase, Mercado Pago, OpenStreetMap).
- Impacto: toda coleta de dado pessoal passa por operador estrangeiro sem base legal de transferência declarada; fiscalização da ANPD pode exigir.
- Causa raiz: depende do advogado e da assinatura dos DPAs com os provedores (todos oferecem DPA/SCC online).
- Correção recomendada: aceitar os DPAs/SCCs de Supabase, Cloudflare, Twilio, Sentry, Brevo, Google (Firebase), Mercado Pago; registrar data e versão em `web/docs/LGPD.md`; preencher o campo da Política com a hipótese (cláusulas-padrão, art. 33, II, "b"/Res. 19/2024) e listar os operadores que faltam.
- Critério de aceite: tabela de operadores no `docs/LGPD.md` com coluna "DPA aceito em"; Política sem campo em branco.
- Dependências: ação do responsável (advogado, contas nos provedores). D5-005.

### D5-022 — Os direitos do titular existem no texto, mas o app só tem "exportar" e "excluir": não mostra o canal do encarregado nem como corrigir CPF, pedir anonimização ou se opor

- Área: LGPD
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/pages/shared/Privacy.tsx` (só dois cartões), `web/src/services/legal.ts:163-164` ("corrigir, pedir anonimização ou eliminação, saber com quem compartilhamos, retirar consentimentos… Pelo app ou pelo {{DPO_EMAIL}}"), `web/src/pages/shared/Help.tsx`
- Prova: `grep -rniE "encarregado|\bdpo\b|privacidade@" web/src --include=*.tsx` (fora de `legal.ts`) = nenhuma ocorrência. O CPF/CNPJ não tem tela de correção (`grep -rn "change_document"` = vazio; o documento só nasce em `create_my_account`); WhatsApp e nome têm. A tela "Privacidade e dados" não tem link para a Política, nem lista de com quem os dados são compartilhados, nem e-mail do encarregado, nem "retirar consentimento" (D5-011), nem "revisar decisão" (a suspensão por moderação não tem tela de contestação; o texto dos Termos §7 manda "falar com o suporte").
- Impacto: o prazo de resposta de 15 dias (art. 19, II) só corre se a pessoa conseguir pedir; quem não acha o e-mail desiste ou usa o WhatsApp do suporte, onde o pedido fica sem registro.
- Causa raiz: o canal depende do campo `{{DPO_EMAIL}}` (D5-005) e nenhuma tela o usa.
- Correção recomendada: na tela Privacidade e dados, acrescentar: link para a Política, "Falar com o encarregado" (`mailto:` com o assunto pronto), "Pedir correção do CPF" e "Retirar a selfie". Registrar cada pedido (e-mail dedicado + planilha com data de recebimento e resposta) para provar o prazo de 15 dias.
- Critério de aceite: a tela mostra os 4 itens; `legal.test.ts` cobre o mesmo e-mail nos dois lugares.
- Dependências: D5-005 (e-mail do encarregado), D5-011.

### D5-023 — Não há plano de resposta a incidente de segurança, mas a Política promete avisar a pessoa e a ANPD

- Área: LGPD
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:171` ("Se houver um incidente que possa causar risco a você, avisamos você e a ANPD"), `web/docs/` (nenhum documento trata de incidente)
- Prova: `grep -rniE "incidente|vazamento|ANPD" web/docs/*.md` fora de `LGPD.md` = vazio; não existe roteiro de quem decide, o que registrar, como avisar as pessoas e em quanto tempo (a regulamentação da ANPD sobre comunicação de incidente fixa prazo de poucos dias úteis — conferir com o advogado o número vigente).
- Impacto: num vazamento real, a equipe de três sócios perde dias decidindo o que fazer, e o prazo legal passa.
- Causa raiz: foco técnico das rodadas anteriores; documento de resposta nunca pedido.
- Correção recomendada: uma página `docs/INCIDENTE.md` (1 tela): quem é o encarregado, como confirmar o incidente (Sentry, logs do Supabase), contenção (rodar a chave `service_role`, desligar a função), registro (data, dados, quantidade de titulares), modelo de aviso à ANPD e aos titulares, contato do advogado. O advogado revisa.
- Critério de aceite: documento existe e é referenciado no `CHECKLIST-LANCAMENTO.md`; simulação de mesa feita uma vez.
- Dependências: ação do responsável (nomear o encarregado, D5-005).

### D5-010 — Histórico sem prazo de apagamento: decisões da equipe (`staff_actions`), denúncias resolvidas, avisos e eventos de pagamento ficam para sempre; as decisões da equipe sobrevivem à exclusão

- Área: LGPD
- Severidade: S3
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:157` (`{{PRAZO_AUDITORIA}}`), `web/docs/LGPD.md:32`, `web/supabase/migrations/20261015000100_lanc06_backoffice.sql:58` (`staff_log` grava `target_id` e `reason` livres), cron `bicos-*` (nenhum expurga essas tabelas)
- Prova: `select cron.job` no staging: 7 jobs, nenhum limpa `staff_actions`, `reports`, `notifications`, `application_events`, `payment_webhook_events`, `cron_alerts`. `anonymize_account` não toca em `staff_actions` (só a FK `staff_id` vira NULL ao sair um membro da equipe): depois que a pessoa exclui a conta, ficam linhas com o uuid dela e o motivo escrito pela equipe (campo livre, pode ter nome ou fato). Staging: `staff_actions` = 265 linhas (todas de teste: suspender/reativar/aprovar).
- Impacto: dado pessoal sem prazo de guarda (art. 6, III e art. 15–16); a Política diz "apagamos na hora" mas isso não vale para o registro da equipe.
- Causa raiz: auditoria foi pensada como "para sempre"; nunca se definiu o prazo.
- Correção recomendada: definir com o advogado (sugestão: 5 anos para `staff_actions` por defesa em processo, art. 7, VI; 1 ano para denúncias resolvidas; avisos lidos há mais de 1 ano) e criar cron de expurgo; no texto da exclusão, dizer que o registro de moderação fica pelo prazo X; pedir à equipe para não escrever dado pessoal no motivo (placeholder/validação).
- Critério de aceite: cron de expurgo no staging; Política com prazos; teste SQL.
- Dependências: ação do responsável (advogado).

### D5-014 — Relatórios de erro (Sentry): a Política diz "sem dados pessoais", mas o mapa interno admite IP; a retenção de 30 dias e a opção de não guardar IP não estão comprovadas

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `web/src/services/legal.ts:30,147,157` ("relatórios de erro sem nome, e-mail, documento ou telefone"; "Relatórios de erro: 30 dias"), `web/docs/LGPD.md:36,50` ("erro sem dado pessoal (pode haver IP)"), `web/src/services/monitoring.ts` (envia direto ao endpoint `store`, com limpeza de e-mail, CPF/CNPJ, telefone, uuid, token), `web/supabase/functions/_shared/monitoring.ts`
- Prova: o código do front e das funções limpa bem o texto (regexes testados), mas quem recebe a requisição HTTP no Sentry vê o IP do navegador; o Sentry guarda esse IP por padrão em eventos recebidos pelo `store` sem `user.ip_address` explícito, a menos que o projeto tenha "Prevent Storing of IP Addresses" ligado — o repositório não documenta que isso foi feito (`grep -ri "ip address\|Prevent Storing" web/docs` = vazio). A retenção do Sentry também depende do plano, não do código.
- Impacto: pequena, mas o texto afirma mais do que o sistema garante.
- Causa raiz: configuração externa não documentada.
- Correção recomendada: ligar "Prevent Storing of IP Addresses" (e "Data Scrubber") no projeto Sentry, registrar a retenção real em `docs/SUPABASE.md` e dizer na Política "pode registrar o endereço IP, que apagamos em 30 dias".
- Critério de aceite: print/nota da configuração do Sentry em `docs/`; Política igual ao mapa.
- Dependências: ação do responsável (acesso ao Sentry).

### D5-015 — Coleta que a Política não descreve ou descreve só em parte

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: lista abaixo
- Prova:
  1. `public_link_hits.ip_hash` (hash de IP + data de quem abre o link público de vaga, mesmo sem conta; 1 dia): `20261016000200_lanc10_link_publico.sql:37-60`; a seção 2 só cita IP "nas tentativas de login". Falta em `docs/LGPD.md`.
  2. `auth_attempts.key` guarda **o número de telefone** (`zap:<fone>`, `zap-conferir:<fone>`) e o IP (`ip:`, `zap-ip:`, `firebase-ip:`, `cadastro-ip:`) em claro, e hashes de CPF/e-mail/telefone (`doc:`, `cadastro:`) — `entrar-com-documento/index.ts:44-45`, `codigo-whatsapp/index.ts:57-64`, `verificar-cadastro/index.ts:56-68`, `entrar-com-firebase/index.ts:55`. Prazo de 1 dia confere (`purge_auth_attempts`, cron `bicos-limpar-tentativas`, confirmado no staging), mas o telefone/CPF-hash não está descrito.
  3. Sessão do Supabase Auth: `auth.sessions` e `auth.refresh_tokens` guardam `ip`, `user_agent` e (no `auth.users`) metadados do cadastro enquanto a sessão vive (colunas conferidas no staging); a Política não cita.
  4. `push_subscriptions.user_agent` (até 300 caracteres, `save_push_subscription`): coberto por "registro do aparelho", sem dizer que inclui o modelo/navegador.
  5. O aparelho guarda uma **cópia da conta** (`localStorage` `bicos.conta`: e-mail, WhatsApp, documento mascarado, papel, suspensão; `web/src/services/remote/session.ts:144-165`), o telefone digitado no login por SMS (`sessionStorage` `bicos-celular`, `auth.ts:526`) e o papel do Google (`bicos-google-papel`); a seção 9 só fala de "sessão e preferências (cidade, filtros)". A cópia sai no `leaveSession`, mas não se a sessão simplesmente expirar em aparelho compartilhado.
  6. Serviços de push do navegador (Google FCM, Apple, Mozilla): o `endpoint` em `push_subscriptions` aponta para eles e é por eles que passa o texto de cada aviso (cifrado) — são destinatários não nomeados; o push está desligado no lançamento (L12), mas o código e a tabela existem (`enviar-push`, `save_push_subscription`).
  7. `reports.details`, `reviews.comment`, `application_events.reason`, `job_invites`: texto livre dos usuários, coberto de forma genérica ("denúncias, avaliações…"), sem aviso para não escrever dado sensível/de terceiros.
- Impacto: transparência incompleta (art. 9), sem dano direto.
- Causa raiz: a Política foi escrita a partir do mapa `docs/LGPD.md`, que também não lista esses itens.
- Correção recomendada: acrescentar os itens 1–6 às seções 2, 5 e 9 e ao `docs/LGPD.md`.
- Critério de aceite: cada tabela/chave acima aparece no mapa e na Política; `legal.test.ts` continua verde.
- Dependências: D5-005 (revisão do advogado).

### D5-016 — "Apagamos na hora" não diz nada sobre cópias de segurança; e hoje o plano Free nem tem cópia

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `web/src/services/legal.ts:155`, `web/docs/DECISOES.md` X30 (hospedagem Free, "backup manual antes de qualquer mudança")
- Prova: o texto promete eliminação imediata. Quando o projeto passar para o Pro (decisão X30, "antes de receber pessoas reais"), o Supabase mantém cópias diárias por alguns dias (prazo a confirmar no plano contratado) e o dado excluído continua nelas até vencer; a decisão X30 também registra que um `pg_dump` manual seria guardado fora (GitHub) só com aprovação. Hoje (Free) é o contrário: sem cópia, uma exclusão por engano ou falha não tem volta (risco de perda de dados, tratado por outras frentes).
- Impacto: a promessa absoluta fica imprecisa; não é descumprimento se o texto avisar.
- Causa raiz: texto escrito antes da decisão de plano.
- Correção recomendada: acrescentar "Cópias de segurança são apagadas em até N dias" na seção 6; ao restaurar um backup, reaplicar as exclusões pedidas desde a data dele (procedimento em `docs/SUPABASE.md`).
- Critério de aceite: texto da Política e procedimento de restauração documentados.
- Dependências: plano contratado (ação do responsável).

### D5-017 — Depois que o trabalhador exclui a conta, o primeiro nome dele continua nos avisos da empresa (e vice-versa)

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: funções `transition_application`, `confirm_presence`, `answer_invite`, `admin_suspend_account` (usam `first_name(...)` dentro de `notify(...)`; consulta em `pg_proc.prosrc` no staging), `anonymize_account` (apaga só os avisos da própria conta)
- Prova: `notifications` tem FK com `ON DELETE CASCADE` só para o `worker_id`/`company_id` dono do aviso. `anonymize_account` de um trabalhador chama `application_step(..., 'desistir')`, que gera "<primeiro nome> não vai poder ir…" para a empresa; esse aviso fica na caixa da empresa depois que o trabalhador é apagado.
- Impacto: mínimo (primeiro nome + título da vaga), mas contraria "apagamos na hora seus dados".
- Causa raiz: avisos são texto pronto, sem ligação com a pessoa citada.
- Correção recomendada: trocar o primeiro nome por "O trabalhador" nos avisos gerados durante a exclusão, ou aceitar e dizer na Política que avisos já entregues à outra parte não são apagados.
- Critério de aceite: teste SQL: excluir um trabalhador e `select … from notifications where body ilike '%<nome>%'` = 0.
- Dependências: nenhuma.

### D5-018 — A exportação devolve o CPF/CNPJ em claro sem pedir a senha de novo (a exclusão pede)

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000600_u51_endereco.sql:205` (`'documento', v_doc` via `pgp_sym_decrypt`), `web/src/services/remote/actions.ts:140-153` (nenhuma verificação), comparar com `delete_my_account` (`session_authenticated_at() < now() - 5 minutes` → BC401)
- Prova: leitura das duas funções no staging; `export_my_data` só chama `auth.uid()`.
- Impacto: quem pegar um celular com a Bicos aberta baixa o CPF completo, o WhatsApp, o endereço e o histórico da pessoa com um toque.
- Causa raiz: a exportação não foi tratada como operação sensível.
- Correção recomendada: exigir login recente (mesma regra de 5 minutos da exclusão) ou pedir a senha/código na tela antes de gerar o arquivo.
- Critério de aceite: teste SQL: `export_my_data` com sessão de 1 hora falha com BC401.
- Dependências: nenhuma.

### D5-019 — Documentos internos desatualizados em relação ao código

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/docs/LGPD.md:18` ("Data de nascimento / 18+": não se coleta data de nascimento, só uma caixa `maior_de_idade` gravada no metadado do Auth no cadastro por e-mail — `web/src/services/remote/auth.ts:228` — e não gravada no cadastro por Google/celular, onde `create_my_account(p_adult)` só valida e descarta); `LGPD.md:15,21,22,24` falam de "construtoras", "obra", "tipo de obra" (colunas e termos já removidos no U12/U48); `LGPD.md:19,31,32,33,35,55` ainda têm 6 campos `{{…}}` próprios; faltam linhas (grep sem resultado) para `addresses`, `account_prefs`, `public_link_hits` e `cron_alerts`.
- Prova: leitura do arquivo e `information_schema` do staging (colunas existentes).
- Impacto: a Política foi escrita "a partir desta tabela" (cabeçalho do `LGPD.md`), então herda as lacunas D5-003, D5-015.
- Correção recomendada: regenerar `docs/LGPD.md` a partir de `information_schema` (script que falha o CI se uma tabela com `account_id`/`worker_id`/`company_id` não está no mapa) e atualizar os nomes.
- Critério de aceite: teste de CI "toda tabela do `public` com FK para contas está em `docs/LGPD.md`".
- Dependências: nenhuma.

### D5-020 — Todo membro da equipe (inclusive "moderador") enxerga a selfie e a foto do documento; a Política diz "equipe de verificação"

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: política de Storage "Equipe lê as fotos de identidade" (`is_staff()`), `staff_members.role in ('admin','moderador')` (CHECK), `admin_identity_queue` (`staff_guard()` sem distinguir papel), `web/src/services/legal.ts:129`
- Prova: no staging, `pg_policies` de `storage.objects` lê `bucket_id = 'identidade' AND is_staff()`; `is_staff()` = existe linha em `staff_members` (qualquer papel). Ver a imagem (URL assinada) não gera linha em `staff_actions`; só a decisão é registrada.
- Impacto: moderadores de conteúdo (denúncias) também acessam dado biométrico; sem trilha de quem viu.
- Causa raiz: papel único de acesso.
- Correção recomendada: papel `verificador` separado, ou limitar a política a `role = 'admin'`; registrar a abertura da imagem (RPC que gera a URL assinada e grava em `staff_actions`).
- Critério de aceite: teste SQL com usuário `moderador` recebendo negado no bucket `identidade`.
- Dependências: nenhuma.

### D5-021 — Política em linguagem jurídica para um público de celular simples

- Área: produto
- Severidade: M (agora, antes do lançamento)
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:134-141` ("legítimo interesse, art. 7º, IX", "art. 11, I"), seção 5 (lista longa de operadores numa só linha)
- Prova: CLAUDE.md §1: "Texto curto, direto… sem jargão. Isso pesa mais que estética". A política tem 10 seções e cita artigos de lei no meio do texto.
- Impacto: baixo risco legal, mas consentimento e transparência valem só se a pessoa entende (art. 9, §1º); o ganho é menos pedido ao suporte e mais confiança no cadastro.
- Correção recomendada: no topo da política, um quadro de 6 linhas ("O que guardamos / por quê / quem vê / por quanto tempo / como apagar / com quem falar") e os artigos de lei para o fim, em "Bases legais". O advogado revê junto com D5-005.
- Critério de aceite: o quadro existe nos dois lugares (`legal.ts` e `/legal/*.md`); teste de legibilidade manual com 3 pessoas.
- Dependências: D5-005.

## Hipóteses não confirmadas

1. **Twilio Verify**: não sei por quanto tempo o Twilio guarda o telefone e o registro de cada verificação (e se o idioma/canal WhatsApp gera conversa no WhatsApp Business). Não há como ver daqui; se for mais de 1 dia, a Política ("códigos do WhatsApp: 1 dia") só vale para o lado da Bicos. Ação: conferir no console do Twilio e documentar.
2. **Brevo**: os e-mails do Auth passam pela Brevo (e-mail do destinatário e link). Não sei se o rastreio de abertura/clique está ligado para e-mail transacional nem a retenção dos logs. Os modelos têm só texto e tabela, sem imagem remota (`DECISOES.md` L04), o que ajuda, mas a opção é da conta.
3. **Logs do Supabase**: `edge_logs` costuma ter IP e caminho de cada requisição; não consultei o conteúdo (regra de não ler dado pessoal), então não confirmei quais campos de IP existem nem o tempo exato no plano atual (D5-004).
4. **Firebase**: não consegui ver o console do projeto `bicoapp-6cc68`: se há usuários guardados, se Analytics ou "Identity Platform" estão ligados, e a retenção dos números de SMS. D5-006 assume que o usuário não é apagado porque nenhum código chama a API de exclusão.
5. **Sentry**: opção "Prevent Storing of IP Addresses", retenção real e região (EUA ou UE) não verificáveis (D5-014).
6. **Menores de idade**: só há a caixa "tenho 18 anos" (`create_my_account(p_adult)` e metadado do Auth); nem a selfie opcional prova idade, e não existe rotina para apagar a conta de quem se descobre menor. É o padrão do mercado, mas vale o advogado dizer se, com a legislação de proteção de crianças e adolescentes em ambiente digital em vigor em 2026, basta a autodeclaração para um app de trabalho.
7. **Produção hoje**: 4 contas (uma só com versão dos termos gravada, `accounts.terms_version`), `terms_acceptances` não existe lá; quando a Política 2.0 subir, o `guards.ts` exige novo aceite e isso corrige o registro; a exclusão de conta na produção ainda é a antiga (anonimização do Y15: usa `author_label`, não apaga avaliações) — o que ela fez com as 4 contas reais não foi verificado, e o texto da Política 2.0 ("apagamos na hora… as avaliações") só passa a valer depois que as migrations `u24` e `r04` forem aplicadas.
8. **Backups do Supabase**: sem acesso ao painel, não sei o plano, a janela de retenção nem se Point-in-Time Recovery está ligado (D5-016).
9. **Notas fiscais**: se a NivoTech precisa emitir nota pelo impulso e por quanto tempo guardar o registro do pagamento é pergunta para o contador (D5-009).
10. **`reports.details` e `staff_actions.reason`** são texto livre; não li o conteúdo (regra), então não sei se já há dado pessoal de terceiros escrito neles.

## Bom e deve ser preservado

- **Trava de build** (`web/build/env.ts` + `vite.config.ts` + passo do CI): produção não sobe com campo `{{…}}` aberto; o escape do piloto só dispensa a revisão, nunca os campos em branco (`escapable: false`, `env.ts:105`).
- **`legal.test.ts`**: `legal/*.md` e `legal.ts` são a mesma coisa (gerado); mudou um, o teste quebra.
- **Consentimento da selfie separado**: caixa própria, versão gravada em `identity_submissions.consent_version` e `consent_at`, e o RPC `submit_identity` recusa sem versão (`BC422`).
- **Bucket `identidade` privado**, só leitura pela equipe; caminho exige prefixo `<uid>/` (`submit_identity` confere) e política de Storage só deixa o dono enviar na própria pasta; `file_size_limit` e MIME restritos.
- **Fotos reencodadas no navegador** (`utils/image.ts`: `createImageBitmap` + `canvas.toBlob`) → EXIF/GPS não sobe para os buckets públicos.
- **Exclusão completa e atômica** (`delete_my_account`): pede login de no máximo 5 min, apaga trabalhador/empresa, candidaturas, avaliações dos dois lados, vagas, avisos, endereço, aceites, preferências, push, bloqueios e denúncias da conta numa transação; o gatilho `on_auth_user_deleted` cobre a exclusão pelo painel (R04). Conferi as FKs (`ON DELETE CASCADE` em todas as tabelas de dados da pessoa).
- **Limpeza de cadastro nunca confirmado** (7 dias) e de `auth_attempts`, `whatsapp_verifications`, `application_attempts`, `public_link_hits` (1–2 dias): cron ativo no staging e na produção; no staging a função `purge_auth_attempts` confere os prazos da Política.
- **Sem analytics, sem fontes externas** (CSP `font-src 'self'`), sem script de publicidade; sentry sem SDK e com limpeza de texto testada; o monitoramento das Edge Functions manda só mensagem e pilha já limpas (nunca o corpo do pedido).
- **Grants por coluna**: WhatsApp, documento (cifra/hash), endereço, `suspended_reason` e fotos de identidade não saem por `select` (conferido nos grants de `authenticated`).
- **Aceite versionado** (`terms_acceptances`) com novo aceite quando `TERMS.version` muda.
