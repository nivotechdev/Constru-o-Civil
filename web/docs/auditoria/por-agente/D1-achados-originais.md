# D1 — Banco: tabelas, RLS, grants, Storage, gatilhos (auditoria AUD)

Medido no staging `setyxomsbfrkneqqfoam` (67 migrations = 67 arquivos do repositório) e comparado, só em catálogo e `count(*)`, com a produção `ppnxdajiihsjaojxokzh` (54 linhas de histórico, parou em 12/10). Provas de RLS: transação com erro final (nada ficou gravado). Os achados estão em ordem de severidade. Contagem: S0 0, S1 0, S2 2, S3 7, M 0.

### D1-001 — Rua, número, CEP e ponto exato de TODA vaga (inclusive casa/apartamento de pessoa física) saem por `select` direto para qualquer conta logada

- Área: LGPD
- Severidade: S2
- Esforço: M
- Confiança: confirmado (reproduzido no staging)
- Onde: `web/supabase/migrations/20261021000800_u53_endereco_publico.sql:10` (`grant select (cep, street, number, complement, lat, lon) on public.jobs to authenticated`); política `jobs` (`using (deleted_at is null and hidden_at is null …)`); `jobs.place_type` aceita `casa`/`apartamento` (`20261021000700_u52_dias_e_local.sql:22-24`)
- Prova: no staging, como uma trabalhadora de fora, `select street,number,lat,lon,cep from public.jobs where id='BC-5164'` devolveu 1 linha e `select id from public.jobs` devolveu 11 de 11 vagas visíveis, sem filtro e sem passar pelo app. `has_column_privilege('authenticated','public.jobs','street','select')` = true. Na produção (U53 ainda não aplicada) as mesmas colunas NÃO são legíveis (`cep,street,number,complement,lat,lon,area_geog` fora do `select`).
- Impacto: uma conta grátis (e-mail + senha, sem verificação de identidade) consegue baixar de uma vez a lista de endereços exatos de todas as vagas, inclusive de quem contrata um serviço em casa. Dá para montar um mapa de casas com data/horário em que a pessoa estará no local.
- Causa raiz: a decisão U53 ("qualquer pessoa vê onde é o bico") foi implementada como permissão de coluna na tabela inteira, sem limite de volume e sem distinguir local comercial de residência; depois do U48 o produto aceita pessoa física como contratante. A decisão está documentada (DECISOES U53), mas o desenho não tem freio: ID sequencial + coluna aberta = coleta em massa.
- Correção recomendada: voltar a ler endereço só por RPC (ex.: `get_job_addresses` ampliada) que devolve rua/número apenas depois da candidatura (ou para quem passou pelo mural), com limite por conta; até lá, mostrar bairro/ponto aproximado (`area_lat/area_lon` já existem) e liberar o exato quando `place_type` = comércio ou depois de a empresa aprovar. Alternativa mínima: manter o público, mas esconder rua/número/ponto exato quando `place_type in ('casa','apartamento','condominio')`.
- Critério de aceite: como conta de fora, `select street, number, lat, lon from jobs` falha (42501) ou volta nulo para vagas residenciais; o teste `seguranca.sql` passa a exercitar a coluna (hoje só testa `get_job_addresses`).
- Dependências: decisão do responsável (muda o U53 pedido por ele); texto da política de privacidade.

### D1-004 — Denúncia de perfil, avaliação ou publicação não tem como tirar o conteúdo do ar

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: confirmado (política no catálogo do staging + código das funções)
- Onde: `web/supabase/migrations/20261015000100_lanc06_backoffice.sql:462-495` (`admin_resolve_report`: só `arquivar`, `ocultar_vaga` e `suspender_conta`); `20261021000500_u48_publico_geral.sql:20-75` (`admin_suspend_account` só esconde as vagas e cancela bicos); políticas `workers`, `reviews`, `worker_posts` = `using (true)` para `authenticated`; `report_target` aceita `vaga | perfil | avaliacao | post`
- Prova: no staging, `pg_policies`: `workers` "Perfis de trabalhador visíveis para quem está logado" `qual=true`; `reviews` "Avaliações são públicas…" `true`; `worker_posts` "Portfólio visível…" `true`. Nenhuma tem teste de `suspended_at`/`hidden`. Como trabalhadora suspensa (staging, transação revertida) `select id from workers` continuou devolvendo todos os perfis, e `update workers set name=…` e `insert into worker_posts` seguiram funcionando.
- Impacto: se alguém denunciar uma foto, legenda, bio ou avaliação ofensiva, a equipe só consegue arquivar a denúncia ou suspender a conta; a conta suspensa continua com perfil, publicações e avaliações visíveis para todos. Só o SQL Editor tira o conteúdo do ar.
- Causa raiz: o painel foi desenhado em torno da vaga (único conteúdo com `hidden_at`); perfil, avaliação e post ficaram sem coluna/política de ocultação.
- Correção recomendada: `hidden_at` em `worker_posts` e `reviews` e uma flag em `workers`/`companies`; políticas de leitura que ignoram o oculto (exceto para a equipe e o dono); ação `ocultar_conteudo` em `admin_resolve_report`; `admin_suspend_account` deve esconder o perfil público.
- Critério de aceite: teste SQL: após `admin_resolve_report(…, 'ocultar_conteudo')` ou suspensão, outro usuário logado não lê o perfil/post/avaliação (0 linhas).
- Dependências: decisão do responsável sobre o que a moderação precisa poder fazer.

### D1-002 — `seguranca.sql` e a documentação afirmam proteção que não existe mais (endereço, nota, selo, impulso "não saem por select")

- Área: testes / docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/tests/seguranca.sql:1-2,21-22` (cabeçalho "nenhuma conta comum lê … endereço da obra"; teste de `get_job_addresses` = 0 linhas); `CLAUDE.md` §4 "grants por coluna (WhatsApp, endereço, documento, nota, selo e impulso não saem por `select`)"; `web/docs/SUPABASE.md:51-53` ("não saem nem mudam por select/update")
- Prova: no staging `rating`, `review_count`, `verified`, `identity_status`, `boost_ends_at` e (desde U53) `cep,street,number,complement,lat,lon` estão no `select` de `authenticated` (consulta de `has_column_privilege`); só WhatsApp (workers/companies), `document_hash`/`document_cipher`, `suspended_reason`, `cnpj_check`, `identity_reason`, `hidden_*` ficam fechados. O teste de `get_job_addresses` passa mesmo com o endereço aberto por `select`, então não protege nada.
- Impacto: quem confia no teste/doc acredita que o endereço está fechado; uma regressão em colunas realmente sensíveis pode passar despercebida.
- Causa raiz: U53 mudou o grant sem atualizar teste/doc; nota/selo/impulso nunca foram escondidos do `select` (são exibidos), eles só não podem ser ALTERADOS.
- Correção recomendada: reescrever o cabeçalho e a asserção do teste (colunas realmente fechadas: `whatsapp`, `document_*`, `hidden_*`, `cnpj_check`, `identity_reason`, `suspended_reason`; colunas que não podem ser alteradas: `rating`, `verified`, `boost_ends_at`…) e corrigir CLAUDE.md/SUPABASE.md.
- Critério de aceite: o teste falha se alguma dessas colunas fechadas virar legível por `authenticated`/`anon`.
- Dependências: D1-001 (se o endereço voltar a fechar, o teste atual volta a fazer sentido).

### D1-003 — Campos de texto e coordenadas gravados direto pela API sem limite; portfólio sem teto de linhas

- Área: segurança
- Severidade: S3
- Esforço: P
- Confiança: confirmado (reproduzido no staging)
- Onde: grants `update (name, city, neighborhood, lat, lon, photo_url, cover_url, bio, experiences)` em `workers` e `update (name, location, logo_url, cover_url, about)` em `companies`; `insert (worker_id, media_url, media_type, caption)` em `worker_posts` (`20261009000100_bicos_v2_schema.sql:286,293,304` e migrations posteriores); só gatilho `check_post_media_v2`
- Prova: como trabalhadora, `update workers set city=repeat('c',100000)`, `neighborhood=repeat('c',100000)`, `lat=999, lon=999` e `lat='NaN'` deram OK (1 linha); como empresa, `update companies set location=repeat('a',100000)` OK. `insert into worker_posts … select … from generate_series(1,200)` (sem mídia) inseriu 200 linhas num único comando. Por outro lado `bio` (>limite), `name`, `about`, `caption` e `experiences` têm `check` e recusam (23514).
- Impacto: um usuário mal-intencionado pode (a) fazer o perfil carregar centenas de KB para quem o vê (candidatos, listas), (b) encher o banco do plano Free (500 MB) com posts vazios sem limite, (c) gravar latitude/longitude inválida (`NaN`, 999), que pode estragar a distância mostrada. Não vaza dado.
- Causa raiz: a validação foi feita só nos campos que o app mostra com limite; `city`, `neighborhood`, `location`, `lat`, `lon` e a contagem de posts ficaram sem `check`/gatilho.
- Correção recomendada: `check (char_length(city) <= 80)` etc. em `workers.city/neighborhood` e `companies.location`; `check (lat between -34 and 6 and lon between -74 and -34)` (já usado em `addresses`); gatilho que limita o número de posts por trabalhador (por exemplo 50).
- Critério de aceite: os mesmos comandos passam a falhar com 23514/BC422.
- Dependências: nenhuma.

### D1-005 — Conta suspensa continua gravando até o token de acesso vencer

- Área: segurança
- Severidade: S3
- Esforço: M
- Confiança: confirmado no banco (o limite de tempo depende da configuração do Auth, não lida)
- Onde: só estas funções consultam `suspended_at`: `refuse_suspended_application` e `refuse_suspended_job` (gatilhos de insert), `get_contact`, `account_history` e as `admin_*` (company_queue, suspend, unsuspend); `web/supabase/migrations/20261021000500_u48_publico_geral.sql:34-45` (a suspensão grava `auth.users.banned_until` e apaga `auth.sessions`)
- Prova: no staging (transação revertida), a equipe suspendeu uma empresa e uma trabalhadora por `admin_suspend_account`; depois, com o papel `authenticated` dessas contas: a trabalhadora conseguiu `update workers set name=…`, `insert into worker_posts`, `insert into saved_jobs`, `block_account`, `save_job_alert` (todos OK, 1 linha); a empresa conseguiu `update companies set name=…` e `delete_job` (OK). `select proname from pg_proc where pg_get_functiondef(oid) ilike '%suspended_at%'` lista só as funções acima (7). A trabalhadora suspensa não conseguiu se candidatar, mas por outro motivo (BC409 de prazo), então o gatilho de suspensão não foi exercitado.
- Impacto: quem acabou de ser suspenso por abuso pode seguir editando o perfil público e o portfólio até o token expirar (padrão do Supabase: 1 hora; o Auth só recusa novo login e renovação).
- Causa raiz: a suspensão depende do Auth (banimento) e não de checagem nas políticas/RPCs.
- Correção recomendada: incluir `not exists (select 1 from accounts where id = auth.uid() and suspended_at is not null)` em `my_worker_id()`/`my_company_id()` (devolveriam null para suspensos, o que já bloqueia a maioria das RPCs e das políticas de escrita) ou reduzir a validade do token.
- Critério de aceite: teste SQL: depois de `admin_suspend_account`, as mesmas escritas falham com 42501/BC401.
- Dependências: nenhuma.

### D1-006 — Se a linha `storage_public_base` faltar, a conferência das fotos deixa passar tudo e a limpeza diária apaga todas as fotos

- Área: banco
- Severidade: S3
- Esforço: P
- Confiança: provável (lido na definição das funções; não reproduzido porque a ferramenta de SQL do staging parou de responder antes do teste)
- Onde: `public.storage_url_ok` (migration `20261010000700_z12_fotos.sql:27`), `public.orphan_storage_objects` (`20261014000400_x09_arquivos_orfaos.sql:37`: `coalesce(…, '')`), `web/supabase/functions/limpar-arquivos/index.ts:25-39` (apaga o que a função devolve, sem conferir proporção)
- Prova: `storage_url_ok` termina em `p_owner is not null and starts_with(p_url, (select value … 'storage_public_base') || …)`; sem a linha, `starts_with(…, NULL)` é NULL, a função devolve NULL e os gatilhos `check_*_v2` fazem `if not storage_url_ok(…)` — `not NULL` é NULL, nada é recusado. Já `orphan_storage_objects` usa `coalesce(…, '')`, então nenhum arquivo bate com a lista de URLs em uso e todos os arquivos dos 3 buckets públicos com mais de 1 dia viram "órfãos". Hoje a linha existe no staging e na produção (conferido por consulta: produção `count(*) filter (where key='storage_public_base') = 1`), e a z12 grava a URL da produção como padrão ("troque no staging").
- Impacto: um projeto novo/restaurado sem essa linha aceita URL externa em foto de perfil e, uma vez configurada a limpeza, apagaria todas as fotos de vagas, avatares e portfólios em até 1 dia.
- Causa raiz: a configuração é uma linha de tabela sem `not null`/validação e as duas funções não tratam "ausente" como erro.
- Correção recomendada: nas duas funções, `raise exception` quando a base for nula/vazia; na Edge Function, abortar se a lista de órfãos for > X % do total; opcional: `check (value ~ '^https://.+/storage/v1/object/public/$')` em `app_config` para essa chave.
- Critério de aceite: teste SQL que apaga a linha e espera erro em ambas as funções.
- Dependências: nenhuma.

### D1-007 — Nenhum teto de arquivos por conta no Storage (plano Free: 1 GB)

- Área: segurança
- Severidade: S3
- Esforço: M
- Confiança: provável (política e limites lidos no catálogo; envio em massa não executado)
- Onde: `storage.buckets` e `storage.objects` do staging e da produção (idênticos): `portfolio` 50 MB por arquivo, `avatars`/`vagas`/`identidade` 10 MB; políticas de INSERT só conferem a pasta `<uid>/` e o lado da conta
- Prova: `select id, file_size_limit, allowed_mime_types from storage.buckets` e `pg_policies` de `storage.objects` (sem contagem nem cota). A limpeza diária só apaga o que não está em uso depois de 1 dia e, na produção, ainda está desligada (`CLEANUP_SECRET` pendente, CLAUDE.md §4).
- Impacto: uma conta grátis pode encher o armazenamento (vídeo de 50 MB repetido ~20 vezes basta) e fazer o envio de fotos falhar para todo mundo.
- Causa raiz: o Supabase Storage não tem cota por usuário e o banco só valida pasta e tipo.
- Correção recomendada: gatilho em `storage.objects` (ou RPC de envio) que limite N arquivos por pasta; reduzir o limite de vídeo; ligar a limpeza na produção.
- Critério de aceite: o 21º arquivo da mesma pasta é recusado.
- Dependências: "ação do responsável" para ligar `CLEANUP_SECRET` (produção).

### D1-008 — Status da verificação de identidade (`recusado`, `em_analise`) legível por qualquer conta logada

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado (grant e política no catálogo)
- Onde: `web/supabase/migrations/20261013000700_f07_identidade.sql:106` (`grant select (identity_status) on public.workers to authenticated`); política `workers` `using (true)`; também `companies.verification_status` e, nas denúncias, `reports.resolved_by`/`resolution` (só para quem denunciou)
- Prova: `has_column_privilege('authenticated','public.workers','identity_status','select')` = true; a política de `workers` não filtra linhas; valores permitidos: `nao_enviado | em_analise | verificado | recusado`. O motivo (`identity_reason`) está fechado.
- Impacto: qualquer conta logada descobre quem enviou documento para análise e quem foi recusado, por consulta direta, embora a tela só mostre o selo "verificado". `reports.resolved_by` mostra ao denunciante o id de quem da equipe tratou a denúncia (o id é o mesmo do perfil público dessa pessoa).
- Causa raiz: o grant foi dado à coluna inteira; a tela só precisa de `verified`.
- Correção recomendada: tirar `identity_status` do `select` de `authenticated` (o dono já lê por `my_identity()`), e `resolved_by`/`resolution` do `select` de `reports`.
- Critério de aceite: `select identity_status from workers` falha com 42501 para outra conta; a tela do perfil e a do dono continuam funcionando.
- Dependências: conferir `src/services/remote/merge.ts:25`, que hoje pede `identity_status` na lista pública.

### D1-009 — Documentos descrevem o banco de antes (staging "sem migrations", 48 arquivos, 42/54 RPCs)

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `CLAUDE.md` §4 ("Staging … 0 migrations no histórico", "48 arquivos, 09/10 → 16/10", "pendentes na produção: lanc06…lanc13 e as r*", "42 RPCs para authenticated"); `web/docs/ADVISORS.md:13` (54 avisos `authenticated_security_definer_function_executable`); `web/docs/SUPABASE.md:51-53`
- Prova: `list_migrations` do staging = 67 versões, idênticas às 67 do repositório; `get_advisors` do staging = 56 avisos desse tipo; a produção tem 42; faltam na produção 25 migrations (lanc06, 07, 09, 10, 12, 13; r03, r04; u01, 06, 10, 12, 24, 30, 32, 37, 48, 49, 51, 52, 53, 62, 63, 65, 67), fora as duas já aplicadas em pedaços (`bicos_v2_rules`/`bicos_v2_data`).
- Impacto: quem decide a ordem de publicação (ou outra IA) lê um mapa errado do staging e da produção.
- Causa raiz: os números ficam em prosa e não são gerados.
- Correção recomendada: atualizar os três textos e acrescentar ao CI/`conferir-migrations.sh` a contagem esperada (ou remover os números).
- Critério de aceite: os números do texto batem com `list_migrations` e `get_advisors`.
- Dependências: nenhuma.

## Hipóteses não confirmadas

- Janela do token de uma conta suspensa (D1-005): a validade do JWT é configuração do Auth, que não consegui ler; se estiver em 1 hora, a janela é de até 1 hora.
- Tipo de arquivo no Storage: `allowed_mime_types` (`image/jpeg|png|webp`; `video/mp4|quicktime|webm` no portfólio) é checado contra o tipo declarado no envio. Se o servidor não conferir o conteúdo, um HTML enviado como `image/png` seria servido com o tipo declarado (o navegador não o executa). Não testei por falta de rede para o Storage.
- Exclusão de conta (U24, documentada): `terms_acceptances` (prova do aceite) e `reports` (denúncias) saem em cascata com a conta; vale perguntar ao advogado se a prova do consentimento deve ser guardada.
- `saved_jobs`: o trabalhador consegue salvar o id de uma vaga oculta ou excluída (a chave estrangeira ignora a RLS), o que revela só a existência do id; não vaza conteúdo.
- Não consegui rodar, depois que a ferramenta de SQL do staging parou de responder, as consultas de: agendamentos reais do `pg_cron`, privilégios padrão e `search_path` dos papéis, lista de `check`/índices por tabela. Ficaram só pelos arquivos de migration (ver coverage.tsv, linhas `n/v`).

## Bom e deve ser preservado

- RLS ligada em todas as 39 tabelas do `public` (staging e produção), nenhuma `for all`, nenhuma política de escrita ampla; as únicas `using (true)` são o catálogo de ofícios (anon) e leitura de perfis/avaliações/portfólio para quem está logado.
- Grants por coluna funcionam: `whatsapp` (workers e companies), `document_hash`, `document_cipher`, `suspended_reason`, `cnpj_check`, `identity_reason`, `hidden_*` dão 42501 para `authenticated`; `anon` só lê `oficios`. Nota, selo e impulso não podem ser alterados por `update` direto (42501).
- Escritas diretas indevidas recusadas: `accounts`, `applications`, `reviews`, `boost_payments`, `jobs` (insert/update/delete) e `notifications` (título, insert, delete); atualizar perfil/post/notificação de outra pessoa afeta 0 linhas.
- Gatilhos `check_*_v2` recusam foto de perfil, capa, logo, post ou foto de vaga fora da pasta do dono no Storage (BC422).
- Legado (`profiles`, `vagas`, `candidaturas`, `avaliacoes`, `vagas_salvas`, `publicacoes_trabalhador`, `consentimentos`): RLS ligada, sem política e sem grant (42501 provado); nenhuma coluna de documento sai.
- Storage: sem política de `select` nos buckets públicos (sem listagem); `identidade` privado, leitura só pela equipe; envio só na própria pasta e só pelo lado certo (trabalhador no `portfolio`/`identidade`, empresa em `vagas`).
- Staging == repositório: 67 de 67 versões; `APLICAR-TUDO.sql` regenerado é idêntico ao do repositório; `database.generated.ts` bate com o banco (39 tabelas, colunas, 147 funções e seus argumentos, 13 enums).
- Advisors do staging: nenhum ERROR; sem `unindexed_foreign_keys`, `auth_rls_initplan`, `multiple_permissive_policies`, `function_search_path_mutable`, nem `extension_in_public`; produção: único `extension_in_public` é `pg_net` (sai com a lanc09), como documentado.
