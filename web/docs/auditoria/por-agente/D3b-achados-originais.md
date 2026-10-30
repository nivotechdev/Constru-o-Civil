# D3b — Migrations f09…r04, legado, pendentes e testes SQL (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente D3b (o agente não conseguiu gravar o arquivo). Staging e produção só por catálogo e `count(*)`. Contagem: S0 0, S1 0, S2 2, S3 9, M 2. Já cobertos por outros agentes e não repetidos: limpeza que dá 401 (D5-001), equipe vê selfie (D5-020), retenção de `staff_actions` (D5-010), `storage_public_base` vazio apaga tudo (D1-006), teto de arquivos (D1-007). Caminhos relativos a `web/supabase/`.

### D3b-001 — Bloquear conta não corta o contato: `get_contact` segue devolvendo o WhatsApp dos dois lados

- Área: segurança
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261013000400_f04_denuncia_bloqueio.sql:74-94` (`block_account` só apaga enviada/em_analise); `get_contact` vigente (`migrations/20261017000100_r03_suspensao_completa.sql:103-138`) sem `blocked_between`
- Prova: no staging (bloco `DO` terminado em `raise exception`, nada gravado) criei empresa, trabalhador, vaga e candidatura pre_selecionado; a empresa bloqueou; depois: `bloqueio=1; status_app=pre_selecionado; worker_get_contact_linhas=1; company_get_contact_linhas=1`.
- Impacto: quem bloqueia alguém continua com o telefone exposto para o bloqueado.
- Causa raiz: `get_contact` não consulta o bloqueio.
- Correção recomendada: recusar BC404 em `get_contact` se `blocked_between`; decidir se o bloqueio cancela aprovados; teste novo em `tests/f04`.
- Critério de aceite: após o bloqueio, `get_contact` falha nos dois lados.
- Dependências: nenhuma (mesmo problema de D2-004; consolidar)

### D3b-002 — A migration pendente que apaga o app antigo está desatualizada e quebraria `signup_taken('documento')` e o cron `bicos-limpar-cadastros`

- Área: banco
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `pendentes/20261015000900_lanc07_apagar_app_antigo.sql:28-102`; `migrations/20261020000100_u10_dados_unicos.sql:25`; `migrations/20261021000300_u37_cadastro_google.sql:16` (ambas leem `public.profiles`); `pendentes/LEIA.md:11-13`
- Prova: no staging `pg_proc.prosrc ~ 'public.profiles'` acha `signup_taken` e `purge_unconfirmed_signups` (language sql). A pendente (15/10) só troca 4 funções e dá `drop table profiles … cascade`. Os testes u10 (linhas 20, 25) e u37 (linha 16) chamam essas funções, então a frase "os outros testes passam" do LEIA venceu.
- Impacto: quando o responsável der o "pode" para apagar o app antigo, o cadastro com documento e a limpeza de cadastros não confirmados passam a falhar.
- Causa raiz: a pendente foi escrita antes de U10/U37 e não foi atualizada.
- Correção recomendada: incluir `create or replace` dessas duas funções sem `profiles` e reconferir com `run.mjs --with`.
- Critério de aceite: aplicar a pendente num banco com todas as migrations e rodar todos os testes SQL verde.
- Dependências: "pode" do responsável (ver D5-012)

### D3b-003 — A migration destrutiva não tem trava de backup nem ordem segura

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pendentes/20261015000900_lanc07_apagar_app_antigo.sql` passo 0; `pendentes/LEIA.md`; `web/scripts/exportar-app-antigo.sh:21-24`
- Prova: o passo 0 só checa `profiles` × `accounts`, sem exigir backup. O LEIA manda mover o arquivo sem renomear, e `20261015000900` fica antes de 12 migrations já aplicadas (`db push` recusa; em banco novo ela roda antes do U37 e `purge_unconfirmed_signups` falharia ao ser criado). O script de exportação conta linhas `COPY` como "tabelas com dados" e grava `.sql` sem cifrar. Produção: 4 perfis, 3 vagas, plano Free sem backup.
- Impacto: apagar o legado por engano ou sem cópia perde 4 perfis com CPF cifrado e 3 vagas sem volta.
- Causa raiz: a migration não tem trava e a numeração não casa com o histórico.
- Correção recomendada: trava em `app_config` (backup confirmado), passo "renomear" no LEIA, exportação cifrada e conferida.
- Critério de aceite: sem a flag de backup em `app_config`, a migration aborta.
- Dependências: ação do responsável (backup)

### D3b-004 — Auditoria da equipe mutável e com lacunas

- Área: segurança
- Severidade: S3
- Esforço: M
- Confiança: confirmado
- Onde: `migrations/20261015000100_lanc06_backoffice.sql:27-40,65-83,517-519`
- Prova: `pg_trigger` em `staff_actions` vazio; `staff_id … on delete set null`; `add/remove_staff_member`, `set_identity_status` e `set_company_verification` chamadas direto não gravam; abrir selfie/documento (policy + URL assinada) não deixa rastro de quem abriu.
- Impacto: a trilha de auditoria pode ser alterada e não prova quem viu documentos.
- Causa raiz: sem gatilho de imutabilidade e sem registro nos caminhos diretos.
- Correção recomendada: gatilho que recusa update/delete, guardar o e-mail da pessoa, registrar entrada/saída da equipe e abertura de foto. Ver D5-010 e D5-020.
- Critério de aceite: update/delete em `staff_actions` falha; abrir um documento gera linha.
- Dependências: D5-010

### D3b-005 — Papel admin × moderador não faz diferença

- Área: segurança
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261015000100_lanc06_backoffice.sql` (`is_staff`, `staff_guard`, `add_staff_member`)
- Prova: `grep moderador` só acha a coluna e `add_staff_member`; `is_staff`/`staff_guard` só veem se a linha existe.
- Impacto: um moderador suspende, decide identidade e lê o log como se fosse admin. (Mesmo problema de D2-015.)
- Causa raiz: o papel nunca é lido.
- Correção recomendada: usar o papel nas RPCs ou remover a coluna.
- Critério de aceite: teste de papel.
- Dependências: nenhuma (consolidar com D2-015)

### D3b-006 — Alerta de cron não enviado ao Sentry conta como "já alertado" por 24 h e nunca é reenviado

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261016000300_lanc12_vigia_cron.sql:124-131` (o dedupe ignora `sent`)
- Prova: a produção não tem `bicos_sentry_dsn` nem `bicos_heartbeat_url` (count = 0), então cada falha vira linha `sent=false` que silencia o dia seguinte.
- Impacto: uma rotina quebrada (como a limpeza de identidades, D5-001) fica meses sem ninguém saber.
- Causa raiz: o dedupe considera tentativas não enviadas.
- Correção recomendada: dedupe só entre `sent=true` e reenviar as pendentes.
- Critério de aceite: com DSN ausente e depois configurado, o alerta pendente é enviado.
- Dependências: ação do responsável (criar DSN/heartbeat)

### D3b-007 — Link público: IP guardado como sha256(ip|data) sem segredo, limite burlável por IPv6, uma escrita por visita anônima, política não cita

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado (código); IPv6 provável
- Onde: `migrations/20261016000200_lanc10_link_publico.sql:57-67`; `web/src/services/legal.ts:121,156`
- Prova: o slug de 12×31 (~59 bits) não é enumerável, então o limite é só defesa extra; o hash do IP sem segredo é reversível por força bruta (espaço de IPv4 pequeno).
- Impacto: dado pessoal (IP) tratado sem estar na política; o limite de 60/10 min é fácil de contornar com IPv6.
- Causa raiz: hash sem segredo e sem agrupar IPv6.
- Correção recomendada: HMAC com segredo do Vault, agrupar IPv6 por /64, citar na política.
- Critério de aceite: política cita o tratamento; o hash muda com o segredo.
- Dependências: texto jurídico (ação do responsável)

### D3b-008 — `report_content` aceita `target_id` ilimitado e de alvo inexistente

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261013000400_f04_denuncia_bloqueio.sql:12-22,51-72`
- Prova: ver D2-013 (mesma prova).
- Impacto: lixo na fila de denúncias.
- Causa raiz: sem validação de tamanho nem existência.
- Correção recomendada: check de tamanho e existência.
- Critério de aceite: ver D2-013.
- Dependências: nenhuma (duplica D2-013; consolidar)

### D3b-009 — Consentimento é o que o aparelho disser: `submit_identity`/`accept_terms` aceitam qualquer versão e caminho

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261015000200_lanc07_aceites.sql:98-147`
- Prova: ver D2-010; `submit_identity` não confere que o objeto existe em `storage.objects`.
- Impacto: a prova de consentimento da selfie depende do cliente.
- Causa raiz: sem versão vigente no servidor e sem conferência do objeto.
- Correção recomendada: versão corrente em `app_config` e conferir o objeto em `storage.objects`.
- Critério de aceite: versão errada ou objeto inexistente → BC422.
- Dependências: nenhuma (consolidar com D2-010)

### D3b-010 — Testes SQL: regras sem teste negativo, teste sem asserção, três que quebram com segredos reais

- Área: testes
- Severidade: S3
- Esforço: M
- Confiança: confirmado
- Onde: `tests/f10_perfil_profissional.sql:8`; `tests/lanc09_pg_net.sql:10-11`; `tests/lanc12_vigia_cron.sql:20,37,55`; `tests/x03_push.sql:40`; `CLAUDE.md` §5
- Prova: sem teste: bloqueio × contato; limites de 20 denúncias e 20 convites/dia; convite por não-dono; moderador × admin; suspender outra conta da equipe (só "eu mesma"); `remove_staff_member`; status inválido em `admin_decide_company`; limite de 10 aparelhos. `f10` faz update sem afirmar nada. `lanc09` e `lanc12` criam segredos de nome único que na produção já existem (`bicos_cleanup_*` = 1); `x03` conta a fila inteira do pg_net; `lanc12:20` dá `delete from cron.job_run_details`.
- Impacto: o CLAUDE.md afirma que os testes rodam na produção sem rastro, o que é falso para esses; regras importantes de segurança sem prova.
- Causa raiz: cobertura negativa incompleta e testes com efeitos fora da transação.
- Correção recomendada: escrever os testes negativos; trocar os efeitos externos por nomes temporários; corrigir o CLAUDE.md.
- Critério de aceite: todos os casos acima com teste; nenhum teste toca `cron.job_run_details` nem segredos reais.
- Dependências: nenhuma

### D3b-011 — Comentários e cabeçalhos de migration desatualizados

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261017000200_r04_exclusao_pelo_painel.sql` e o comentário de `delete_my_account` (anonimizar; desde U24 apaga); textos "obra/construtora" do r03 (o staging já diz "empresa/local"); `20261013000200_f10_perfil_profissional.sql` (campos que o teste diz terem saído no U33)
- Prova: leitura dos arquivos contra as definições finais no staging.
- Impacto: quem lê uma migration antiga entende o contrário do que está em vigor.
- Causa raiz: migrations são imutáveis e os comentários não são atualizados.
- Correção recomendada: marcar "substituída por Uxx" ou gerar um documento do estado final.
- Critério de aceite: cada migration substituída tem a marca.
- Dependências: nenhuma

### D3b-012 — (melhoria futura) Excluir a conta apaga a prova de aceite e as denúncias contra a pessoa, e libera o CPF para novo cadastro

- Área: LGPD
- Severidade: M
- Esforço: M
- Confiança: confirmado
- Onde: `terms_acceptances … on delete cascade`; `anonymize_account` vigente
- Prova: leitura das definições.
- Impacto: sem prova de que a pessoa aceitou os termos e sem histórico de denúncias, banido volta com novo cadastro.
- Causa raiz: tudo é apagado em cascata.
- Correção recomendada: decidir com o advogado o que reter (prova mínima, denúncias, hash do documento de banidos). Ver D5-010.
- Critério de aceite: política e função alinhadas ao que foi decidido.
- Dependências: advogado (ação do responsável)

### D3b-013 — (melhoria agora, barata) `feed_jobs` não usa `blocked_between`; só o app filtra bloqueados

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261016000400_lanc13_mural_volume.sql:24-89`
- Prova: leitura da função.
- Impacto: outro cliente (ou o link) vê vagas de quem bloqueou.
- Causa raiz: filtro só no front.
- Correção recomendada: acrescentar o filtro no servidor.
- Critério de aceite: teste SQL: conta bloqueada não vê a vaga no `feed_jobs`.
- Dependências: nenhuma

## Hipóteses não confirmadas

- `add_staff_member` sem exigir e-mail confirmado.
- Corrida entre dois decisores (sem `for update`).
- `cf-connecting-ip` chegar ao PostgREST (sem rede ao staging).
- Dono do `drop extension pg_net` na produção.
- Curingas `%`/`_` na busca do `feed_jobs`.
- Reescrita da tabela `jobs` pela coluna gerada `last_day` com volume.
- `ALTER TYPE ADD VALUE` e uso no mesmo `APLICAR-TUDO.sql`.

## Bom e deve ser preservado

- Grants/guard de toda RPC `admin_*` (testes lanc06 provam 42501 nas auxiliares).
- Colunas sensíveis sem grant (`suspended_reason`, `hidden_reason`, `cnpj_check`, `identity_reason`).
- Tabelas e 21 funções do app antigo fechadas na produção (RLS ligada, sem política, sem execute).
- Storage sem listagem pública; chave do Vault do staging não é a de exemplo do baseline.
- Horários dos 7 crons sem conflito; `last_day` = `job_last_day` no staging; `pg_net` no staging em `extensions`.
- Mensagens do banco já dizem "empresa/local".
