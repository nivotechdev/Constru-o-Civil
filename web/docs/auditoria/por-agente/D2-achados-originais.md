# D2 — RPCs e funções do banco (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente D2 (o agente não conseguiu gravar o arquivo). Medido no staging (176 funções de `public`; 62 executáveis por authenticated, 1 por anon). Provas em blocos `do $$ … raise exception` desfeitos. Contagem: S0 0, S1 3, S2 4, S3 8, M 1.

### D2-001 — Texto do endereço da vaga sem limite: uma empresa faz o mural pesar MB

- Área: segurança
- Severidade: S1
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000700_u52_dias_e_local.sql:31` (`job_from_draft`: street/number/complement/neighborhood/city só com btrim); `web/supabase/migrations/20261022000300_u65_valor_minimo.sql:8` (`feed_jobs` devolve street/neighborhood); `jobs` sem CHECK de tamanho; URLs de foto só têm prefixo conferido (`check_job_photos_v2`)
- Prova: `publish_job` com street de 100.000 letras aceito (BC-5296); 3 vagas com street+neighborhood de 1.000.000 letras: `feed_jobs('Caxias do Sul','RS',…)` devolveu 15 itens, 6.020.384 bytes numa página; empresa com status padrão `pendente`.
- Impacto: qualquer conta de empresa nova deixa o mural da cidade baixando dezenas de MB por página (celular simples): a tela principal fica inutilizável.
- Causa raiz: a validação cobre título/descrição/requisitos e esqueceu o endereço.
- Correção recomendada: CHECK `char_length` (street ≤120, neighborhood/city ≤80, number ≤10, complement ≤60, URL de foto ≤300) NOT VALID + VALIDATE, e a mesma checagem em `job_from_draft` com BC422 (colunas editáveis: ver D1-003).
- Critério de aceite: `publish_job` com street de 121 letras → BC422; página do mural < 20 KB por vaga.
- Dependências: nenhuma (relacionado a D1-003)

### D2-002 — Empresa sem verificação aprova todos e recebe o WhatsApp deles (coleta para golpe do falso emprego)

- Área: segurança
- Severidade: S1
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000700_u52_dias_e_local.sql:158` (`publish_job` só recusa `reprovada`; padrão da coluna `pendente`); `web/supabase/migrations/20261021000500_u48_publico_geral.sql:522` (`transition_application` aprovar) e `:207` (`get_contact`: basta `pre_selecionado`); `document_valid_for` aceita CPF para empresa
- Prova: empresa `pendente` publica por `publish_job`, aprova e `get_contact` devolve nome e telefone de 11 dígitos na hora; sem limite de aprovações/vagas (D2-007).
- Impacto: um golpista publica vaga atraente, aprova quem se candidatar e junta números de telefone; o trabalhador não é consultado antes.
- Causa raiz: a verificação da empresa não é condição para liberar contato.
- Correção recomendada: só empresa verificada (ou conta com X dias + WhatsApp confirmado + sem denúncia) libera contato; teto diário de aprovações para contas novas; o trabalhador toca em "Compartilhar meu WhatsApp".
- Critério de aceite: empresa `pendente` → aprovar/`get_contact` falham.
- Dependências: ação do responsável (definir a regra)

### D2-003 — Excluir a conta não apaga as avaliações que a pessoa escreveu

- Área: LGPD
- Severidade: S1
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000500_u48_publico_geral.sql:79` (`anonymize_account` apaga `reviews` só pelo id do avaliado) e `:458` (`submit_review`: autor só em `author_label`); `web/docs/DECISOES.md:1833-1850` (U24) e a política dizem "apagamos as avaliações que você fez e recebeu"
- Prova: empresa executa `delete_my_account(true)`: a avaliação dela sobre o trabalhador continua (label=Empresa Tres, comment=otimo), nota 5.0/1; trabalhador exclui: a dele sobre a empresa continua (label=Worker Q., comment=bom), nota da empresa 4.0/1. (S1 e não S0: sobra nome de exibição + comentário, sem documento/contato.)
- Impacto: o nome e a opinião de quem pediu exclusão seguem visíveis para todas as contas; a promessa da política é falsa para metade das avaliações.
- Causa raiz: `reviews` não guarda o autor por id; a FK em cascata só leva as linhas do avaliado.
- Correção recomendada: coluna `author_account` (backfill por `application_id`), apagar por ela em `anonymize_account` e refazer as notas; ou anonimizar label + comentário e corrigir política/decisão.
- Critério de aceite: estender `tests/u24_exclusao_completa.sql` (0 avaliações escritas pela conta, nota refeita).
- Dependências: responsável reconcilia política × decisão

### D2-004 — Bloquear uma conta não corta contato nem contratação já aprovada

- Área: segurança
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261013000400_f04_denuncia_bloqueio.sql:74` (`block_account` só apaga `enviada/em_analise` e convites); `get_contact` e `transition_application` não consultam `blocked_between`
- Prova: trabalhador aprovado bloqueia a empresa → status segue `pre_selecionado`; a empresa bloqueada ainda lê o contato (nome + 11 dígitos) e ainda consegue `contratar`.
- Impacto: quem se sente ameaçado bloqueia e continua exposto.
- Causa raiz: o bloqueio só limpa o que ainda não foi aprovado.
- Correção recomendada: `block_account` cancela também pre_selecionado/contratado (ação do sistema, reabre a vaga como na R03) e `get_contact`/`transition_application` recusam com BC404 se `blocked_between`.
- Critério de aceite: após bloquear, `get_contact` e `contratar` falham.
- Dependências: nenhuma

### D2-005 — Selo "Verificada/Verificado" permanece depois de trocar o nome

- Área: segurança
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: grants `UPDATE(name)` em `companies` e `workers`; `web/supabase/migrations/20261011000500_y24_verificacao.sql:18` (`sync_company_verified` só olha `verification_status`); nenhum gatilho zera o selo
- Prova: empresa `verificada` faz `update companies set name='Banco Exemplo S.A.'` → `verified=true`; trabalhador `verificado` vira `Outro Nome Qualquer` → `verified=true`.
- Impacto: o selo (CNPJ conferido / selfie + documento) passa a atestar outro nome: dá para se passar por marca ou por outra pessoa.
- Causa raiz: o nome é editável direto e o selo não depende dele.
- Correção recomendada: gatilho BEFORE UPDATE OF name que volta `verification_status='pendente'` / `identity_status='nao_enviado'` quando `verified`.
- Critério de aceite: renomear empresa verificada → `verified=false`.
- Dependências: nenhuma

### D2-006 — Reputação fabricada em segundos com duas contas

- Área: segurança
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261010000100_z01_rpcs_candidatura.sql:33` (`job_started` = true sempre que `date_to_arrange`); `transition_application` `concluir`; `submit_review` (`…u48…sql:458`); `application_conclude` soma `jobs_done`
- Prova: empresa publica vaga "data a combinar"; trabalhador se candidata; aprovar → contratar → concluir na mesma transação; duas avaliações 5★ → trabalhador `jobs_done=1, rating 5.0`, empresa `5.0/1`.
- Impacto: quem controla duas contas (CPF e WhatsApp diferentes) fabrica diárias e notas máximas; o mural e os perfis usam isso como sinal de confiança.
- Causa raiz: `concluir` não exige que o dia combinado tenha chegado nem presença confirmada.
- Correção recomendada: `concluir` só depois do dia combinado (a combinar: data registrada ou ≥24 h após `contratado`); contar `jobs_done`/nota só com presença confirmada ou conclusão dos dois lados; alertar pares que só avaliam um ao outro.
- Critério de aceite: `concluir` logo após `contratar` em vaga "a combinar" → BC409.
- Dependências: D2-002, D2-007 (M1-H1 é outro assunto: conclusão automática em 32 dias)

### D2-007 — Nenhum limite de vagas por empresa; "urgente" grátis pela API

- Área: segurança
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000700_u52_dias_e_local.sql:158` (`publish_job` não conta) e `:31` (`job_from_draft` aceita `urgent`); `DECISOES.md` W08 não trata de quantidade
- Prova: 120 `publish_job` seguidos da mesma empresa `pendente`: 120 aceitas; vaga enviada com `urgent=true` sem pagar ficou `_rank=1` (normal `_rank=2`; impulsionada 0).
- Impacto: uma empresa cobre o mural da cidade (a ordem é por distância), gasta os 5 avisos/dia dos alertas e fura a fila sem pagar.
- Causa raiz: falta teto de vagas abertas/por dia; o campo `urgent` do payload é confiado.
- Correção recomendada: teto de abertas (ex.: 10 sem verificação) e por dia; ignorar `urgent` do payload.
- Critério de aceite: 11ª vaga aberta de empresa `pendente` → BC409; `urgent:true` não muda `_rank`.
- Dependências: o responsável define os tetos

### D2-008 — Leituras sem checar vínculo: `worker_track_record`, `job_stats` e erro que revela candidatura

- Área: segurança
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261013000200_f10_perfil_profissional.sql:26`, `…z01_rpcs_candidatura.sql:71`, `…u48_publico_geral.sql:522` (`transition_application` busca a candidatura antes de conferir o dono)
- Prova: empresa sem relação: `worker_track_record(array[w])` → 1 linha (faltas/desistências); trabalhador estranho lê `holding=1 pending=0 total=1` de vaga alheia; estranho chamando `transition_application` recebe BC401 se a candidatura existe e BC404 se não (descobre quem se candidatou onde, sabendo o uuid).
- Impacto: o histórico de faltas de qualquer trabalhador fica visível a qualquer empresa.
- Causa raiz: as funções não conferem vínculo antes de devolver dado.
- Correção recomendada: restringir a candidatos das vagas da empresa; `job_stats` só do dono; conferir o dono antes de ler a candidatura.
- Critério de aceite: empresa estranha → 0 linhas / mesmo BC401 nos dois casos.
- Dependências: nenhuma

### D2-009 — Entrada inválida vira erro SQL cru e há parâmetros sem teto

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `job_from_draft` (casts), `save_job_alert` (`…y28_alerta_bico.sql:28`), `feed_jobs` (`p_radius_km*1000`, `p_search`), `job_stats`
- Prova: `pay:"abc"` e `slots:"1.5"` → 22P02; `save_job_alert` com lat/lon nulos → 23502; `feed_jobs(p_radius_km=>3000000)` → 22003; busca de 180.000 letras = 2,72 s (timeout do authenticated: 8 s).
- Impacto: o contrato BC4xx quebra (mensagem técnica na tela); busca enorme gasta CPU.
- Causa raiz: faltam casts em bloco e tetos nos parâmetros.
- Correção recomendada: casts em bloco com BC422, `left(p_search,80)`, `least(p_radius_km,500)`, guarda de null, teto de 100 ids.
- Critério de aceite: cada caso → BC422 ou vazio.
- Dependências: nenhuma

### D2-010 — O servidor aceita qualquer "versão" de termos e de consentimento

- Área: LGPD
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261015000200_lanc07_aceites.sql:98` (`accept_terms`) e `:120` (`submit_identity`); `create_account_for` (terms_version do metadata, até vazia)
- Prova: `accept_terms('99.9')` grava `terms_version=99.9` e linhas em `terms_acceptances`.
- Impacto: a prova de aceite depende do cliente.
- Causa raiz: a versão vigente não existe no servidor.
- Correção recomendada: versão vigente em `app_config` e exigir igualdade.
- Critério de aceite: `accept_terms('99.9')` → BC422.
- Dependências: nenhuma

### D2-011 — Ordem de travas inconsistente (vaga↔candidatura, pagamento↔vaga): deadlock possível

- Área: banco
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `transition_application` trava vaga→candidatura; `application_conclude` (`…y01_y04_ciclo_vaga.sql:59`, usada por `conclude_finished_jobs`/`conclude_my_finished_jobs`) trava candidatura→vaga; `confirm_boost_payment` (`…z02_pagamentos.sql:154`) trava pagamento→vaga e `begin_boost_payment` (`…u48…sql:156`) vaga→pagamentos `aguardando`
- Prova: leitura dos corpos das funções (o conector não tem sessões paralelas).
- Impacto: raro 40P01; o webhook é reenviado e a ação do usuário falha.
- Causa raiz: ordens de lock opostas.
- Correção recomendada: "vaga primeiro" em `application_conclude` e `confirm_boost_payment`.
- Critério de aceite: teste com 2 conexões sem 40P01.
- Dependências: nenhuma (soma ao M1-H2)

### D2-012 — Limites diários (candidaturas 30/dia, convites 20/dia, denúncias 20/dia) não são atômicos

- Área: banco
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `web/supabase/migrations/20261014000200_x15_rls_desempenho.sql:84`, `20261013000300_f13_convite.sql:24`, `20261013000400_f04_denuncia_bloqueio.sql:51`
- Prova: as funções contam e inserem sem lock; candidaturas travam a vaga, não o trabalhador, então vagas diferentes em paralelo não se enxergam.
- Impacto: um script com chamadas simultâneas passa dos limites.
- Causa raiz: contagem sem exclusão mútua.
- Correção recomendada: `pg_advisory_xact_lock(hashtextextended('cand:'||worker_id,0))` no início.
- Critério de aceite: 40 chamadas paralelas → no máximo 30.
- Dependências: nenhuma

### D2-013 — Denúncias: alvo livre e denúncia analisada reaberta pelo denunciante

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261013000400_f04_denuncia_bloqueio.sql:51` (`report_content`: `p_target_id` sem formato/tamanho/existência; `on conflict … status='aberta'`)
- Prova: `report_content('perfil', repeat('x',100000), …)` aceito; denúncia `analisada/arquivar` volta a `aberta` ao denunciar de novo.
- Impacto: lixo na fila da equipe e fila reaberta à vontade.
- Causa raiz: sem validação do alvo e `on conflict` reabre.
- Correção recomendada: `char_length(p_target_id) ≤ 64` e alvo existente; reabrir só após 30 dias ou com motivo novo.
- Critério de aceite: testes SQL dos dois casos.
- Dependências: nenhuma

### D2-014 — Publicar vaga notifica todos os alertas na mesma transação

- Área: desempenho
- Severidade: S3
- Esforço: M
- Confiança: confirmado (medido) + extrapolação
- Onde: `web/supabase/migrations/20261019000100_u01_vaga_simples.sql:143` (`notify_job_alerts`, AFTER INSERT em `jobs`)
- Prova: 5.000 alertas na cidade → `publish_job` 1,23 s e 5.000 notificações; `statement_timeout` do authenticated = 8 s ⇒ falha com ~30 mil alertas numa cidade.
- Impacto: em cidade grande, publicar vaga passa a dar erro.
- Causa raiz: fan-out síncrono no gatilho.
- Correção recomendada: fila + cron/Edge Function em lotes (ou limite N por vaga ordenado por distância).
- Critério de aceite: `publish_job` < 200 ms com 30 mil alertas.
- Dependências: nenhuma

### D2-015 — Papéis da equipe sem efeito

- Área: processo
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `staff_members.role` ('admin'|'moderador') não é lido por nenhuma das 176 funções; `staff_guard` só pergunta `is_staff()`; `company_members` (F18) é preenchida por gatilho mas nenhuma RPC/política a usa (`my_company_id()` = `accounts.company_id`)
- Prova: `grep "'admin'"` nas definições = 0 ocorrências.
- Impacto: um "moderador" suspende contas, decide identidade e oculta vagas como admin.
- Causa raiz: a coluna de papel nunca foi aplicada.
- Correção recomendada: exigir `role='admin'` em suspender/reativar/`add_staff_member` ou remover a coluna; atualizar docs.
- Critério de aceite: teste de papel.
- Dependências: nenhuma

### D2-016 — (melhoria agora) Valor pago não é conferido antes de confirmar o impulso

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: provável
- Onde: `web/supabase/functions/webhook-pagamento/index.ts:43-45` (confirma por `status==='approved'` + `external_reference`); `confirm_boost_payment(p_payment_id)` sem valor
- Prova: leitura do código.
- Impacto: hoje a cobrança nasce no servidor com o valor do plano; qualquer falha futura libera impulso por valor menor.
- Causa raiz: o valor pago não é comparado ao esperado.
- Correção recomendada: `confirm_boost_payment(p_payment_id, p_amount_cents, p_provider_payment_id)` com BC409 se não bater, antes de ligar o Mercado Pago.
- Critério de aceite: valor menor → BC409 e pagamento segue `aguardando`.
- Dependências: nenhuma

## Hipóteses não confirmadas

- Corridas reais (dupla aprovação/candidatura) não reproduzidas: o conector roda uma sessão por vez. Por leitura, `submit_application`, `aprovar`, desfazer, `update_job`, `delete_job`, `invite_worker` e cobrança travam `jobs … for update` antes de contar vagas. Recomendado `pgbench` antes do lançamento.
- `create_my_account` usa `coalesce(auth.users.email_confirmed_at, now())`: se o Auth permitir login anônimo/por telefone sem e-mail (função `entrar-com-firebase`), a conta nasce "confirmada". Config do Auth não legível por SQL.
- `workers.lat/lon` (~1,1 km) + nome/foto de todos os trabalhadores legíveis por qualquer conta logada (grant); D1-001 cobre só as vagas.
- `whatsapp_verifications` é por número, não por conta (janela de 30 min); `feed_jobs` não esconde vagas de empresa bloqueada.

## Bom e deve ser preservado

- ACL mínima: só `public_job_card` para anon; funções de equipe/serviço (`set_*_verification`, `set_identity_status`, `funnel_daily`, `application_step`, `*_boost_payment`, `conclude_finished_jobs`, `orphan_storage_objects`) fora do alcance de authenticated; `search_path` fixo em todas; nenhum overload; 176/176 corpos iguais às migrations.
- `for update` na vaga serializa candidatar/aprovar/editar/excluir/convidar/cobrar; `applications unique(job_id,worker_id)`; índice único parcial de pagamento `aguardando` por vaga; confirmação de pagamento idempotente.
- Paginação por cursor `(rank,chave,id)` do mural testada em `perto/valor/cedo` com impulsionadas, urgentes e sem valor: sem repetir nem pular; `get_contact` confere status, lado e suspensão dos dois; `public_job_card` (slug 31^12, só bairro/cidade, limite por IP); `delete_my_account` exige login recente; `admin_suspend_account` não suspende a si nem equipe.
