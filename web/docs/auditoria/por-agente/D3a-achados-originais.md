# D3a — Migrations z01…f18 e testes SQL (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente D3a (o agente não conseguiu gravar o arquivo). Leu por inteiro as 24 migrations (z01…f18 + habilitar_pg_net) e 22 testes SQL; staging só leitura; produção só `list_migrations`, `md5(pg_get_functiondef)` e `count(*)`. Contagem: S0 0, S1 0, S2 1, S3 10, M 0. Caminhos relativos a `web/supabase/`.

### D3a-001 — Quem souber o CPF/CNPJ de outra pessoa trava o cadastro dela e apaga o cadastro pendente dela; não há prova de posse nem contestação

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: provável
- Onde: `migrations/20261010000300_z07_documento_login.sql:84-111` (`claim_document_for`); `migrations/20261011000300_y16_y17_documento.sql:10-63` (só dígito verificador); `migrations/20261012000800_l13_conta_google.sql:35-42`; teste `tests/z07_documento.sql:34-45`
- Prova: a definição final no staging faz `raise 'Documento já cadastrado.'` se a conta tem e-mail confirmado e `delete from auth.users` se está pendente. O teste z07:35 prova o bloqueio do 2º cadastro. `grep -i "contest|disputa"` em DECISOES e CHECKLIST: nada.
- Impacto: um golpista ou concorrente cadastra o CPF/CNPJ alheio com e-mail descartável e o dono real fica sem conta.
- Causa raiz: o documento vale como identidade sem nenhuma prova de posse.
- Correção recomendada: função da equipe para liberar documento + canal "esse CPF é meu"; só tratar o documento como ocupado com alguma prova (CNPJ ativo, identidade aprovada); registrar em DECISOES.
- Critério de aceite: teste SQL de contestação liberada pela equipe.
- Dependências: decisão dos sócios

### D3a-002 — Migrations "idempotentes" que reescrevem dados/permissões quando rodam de novo

- Área: banco
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `migrations/20261012000100_l18_pagamento.sql:24` (`update jobs set payment_method='pix_dia' where payment_method is null`); `migrations/20261010000600_z06_endereco.sql:14-19` (`revoke select on jobs` + lista fixa de colunas); `APLICAR.md:13-14` e `:6-7`; `web/scripts/staging/aplicar-banco.sh:60-72` (`psql -f` por arquivo, sem transação única)
- Prova: desde o U01 a vaga pode ficar sem pagamento (`tests/l18_pagamento.sql:24-27` espera null). Reaplicar a l18 troca todas por "PIX no dia", uma promessa que a empresa não fez. Reaplicar o z06 sozinho tira `select` das colunas concedidas depois (`l18:26`, `public_slug`, `weekdays`…) e o mural dá 42501. Não reapliquei no staging.
- Impacto: reaplicar o pacote depois do lançamento altera dado de empresa e pode derrubar o mural. Hoje a produção tem 0 vagas.
- Causa raiz: migrations não são realmente idempotentes em dados e permissões.
- Correção recomendada: l18 com `and created_at < '2026-10-12'`; z06 revogar só se o privilégio de tabela ainda existir; ajustar a frase do APLICAR.md; usar `psql --single-transaction`.
- Critério de aceite: rodar a pilha duas vezes no CI e comparar o estado.
- Dependências: nenhuma

### D3a-003 — Aviso "Bico novo" mostra o valor com vírgula americana: R$ 1.500 sai "R$ 1,500"

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261011000700_y28_alerta_bico.sql:66` e `migrations/20261019000100_u01_vaga_simples.sql:149` (versão final): `to_char(new.pay,'FM999G999')`
- Prova: staging `to_char(1200,'FM999G999')` = `1,200`; `lc_numeric` = en_US.UTF-8. A diária vai até R$ 5.000 (W08). O teste y28 não confere o texto.
- Impacto: o trabalhador lê R$ 1,500 (um real e meio) na notificação e no push, em diárias de R$ 1.000 ou mais.
- Causa raiz: o formato de número depende do locale do servidor.
- Correção recomendada: `replace(to_char(...), ',', '.')`.
- Critério de aceite: teste com pay=1500 e `body like '%R$ 1.500%'`.
- Dependências: nenhuma

### D3a-004 — CNPJ alfanumérico (Receita, desde julho/2026) é recusado no cadastro e na verificação

- Área: produto
- Severidade: S3
- Esforço: M
- Confiança: provável (a regra da Receita, IN RFB 2.229/2024, é externa ao repositório; a falha está provada)
- Onde: `migrations/20261011000300_y16_y17_documento.sql:32-54` (`cnpj_valid` apaga o que não é dígito e exige 14); `migrations/20261012000700_l10_cnpj_receita.sql:18`; `mask_document`; `web/src/utils/document.ts:19`; `grep -ri alfanum` no repositório: nada
- Prova: staging `cnpj_valid('12.ABC.345/01DE-35')` = false (exemplo oficial).
- Impacto: empresa aberta depois de julho/2026 não consegue se cadastrar nem verificar com CNPJ; o problema cresce a cada mês.
- Causa raiz: validação só numérica.
- Correção recomendada: aceitar `[0-9A-Z]{14}` com módulo 11 sobre `ascii(c)-48`; ajustar `mask_document`, `document_hash`, `verificar-cnpj` (BrasilAPI) e o front.
- Critério de aceite: `cnpj_valid('12.ABC.345/01DE-35')` = true.
- Dependências: nenhuma

### D3a-005 — `cpf_valid`, `cnpj_valid`, `document_valid_for`, `whatsapp_valid` executáveis por visitante

- Área: banco
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261011000300_y16_y17_documento.sql:157-158`, `migrations/20261011000600_y25_whatsapp.sql:138` (só `grant … to authenticated, service_role`, sem `revoke … from public, anon`); regra do CLAUDE.md §4/§6
- Prova: staging `has_function_privilege('anon', …)` = true nas 4 (as outras 59 funções da lista: false).
- Impacto: baixo (funções puras); o ponto é a regra "só `public_job_card` para anon" ficar falsa e haver RPC anônimo sem limite.
- Causa raiz: faltou o `revoke … from public`.
- Correção recomendada: `revoke execute … from public, anon`.
- Critério de aceite: consulta em `pg_proc` devolve só `public_job_card` para anon.
- Dependências: nenhuma

### D3a-006 — Todo cadastro novo nasce com "São Paulo, SP" e coordenadas de SP; na produção as 4 contas ainda têm

- Área: produto
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261010000300_z07_documento_login.sql:149,155`; `migrations/20261011000300_y16_y17_documento.sql:112,118`; a versão final de `create_account_for` no staging ainda tem o texto e -23.5505
- Prova: produção `count(*)`: companies com location 'São Paulo, SP' = 3 de 3; workers com city 'São Paulo, SP' = 1 de 1. O piloto é Caxias do Sul. Pelo U67, empresa que completa sem cidade fica em SP.
- Impacto: quem não escolhe a cidade aparece em São Paulo e vê/aparece no mural errado.
- Causa raiz: padrão fixo gravado no cadastro.
- Correção recomendada: gravar vazio e exigir a cidade em `finish_sign_up`; limpar as contas existentes.
- Critério de aceite: conta nova sem cidade padrão.
- Dependências: nenhuma

### D3a-007 — Testes SQL sem as regras mais importantes de autorização, Storage e pagamento

- Área: testes
- Severidade: S3
- Esforço: M
- Confiança: confirmado
- Onde: `tests/z01_candidaturas.sql`, `tests/seguranca.sql:38`, `tests/l22_desfazer_recusa.sql`, `tests/z12_fotos.sql:22-24`, `tests/z02_pagamentos.sql`, `tests/x01_mural.sql`, `tests/y01_y04_ciclo.sql`, `tests/l10_cnpj.sql`, `tests/l11_validacao_perfil.sql`, `tests/l13_conta_google.sql`, `tests/f12_presenca.sql`, `tests/y24_verificacao.sql`
- Prova: sem teste: `transition_application` chamada por OUTRA empresa em vaga alheia; `submit_application` com perfil incompleto, empresa chamando, prazo vencido, vaga cheia; `withdraw_application` após a decisão; `delete_my_account` de empresa e sem confirmar compromissos; políticas de Storage do z12 (só confere a ausência de `SELECT`), logo da empresa e mais de 8 fotos; z02: `fail_boost_payment`, `get_payment` virando "expirado", preços 1200/2800, impulsionar vaga já impulsionada/cheia; x01: `p_quando`, `p_oficio`, ordens cedo/valor, vaga cheia/vencida, visitante; y01: `update_job` (menos vagas que aprovados, aviso, reabrir recusados), "a combinar" contratado; l10: caminho positivo de `company_cnpj_for_check`; l11: `companies_name_length`; l13: WhatsApp inválido, nome curto, termos vazios; l22: recusa automática não desfaz; f12: `confirm_presence` após o prazo, por não-trabalhador, e o cron; y24: aviso de reprovada.
- Impacto: uma regressão no IDOR entre empresas ou nas políticas de Storage passa no CI sem ninguém ver.
- Causa raiz: os testes cobrem o caminho feliz de cada rodada.
- Correção recomendada: `authz_cruzado.sql` com 2 empresas e 2 trabalhadores; teste de Storage com `insert into storage.objects` como authenticated; completar os demais itens.
- Critério de aceite: cada item acima com teste negativo.
- Dependências: nenhuma

### D3a-008 — Testes que só passam em banco vazio e mexem no banco inteiro

- Área: testes
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `tests/x01_mural.sql:26-29,45` (array exato e `count(*)=5` sobre todas as vagas); `tests/y01_y04_ciclo.sql:42,49-50,62,67` (`conclude_finished_jobs()` sem argumento; contagem de avisos por título sem filtrar a conta); `tests/f12_presenca.sql:31-32` (`remind_presence() = 1` global)
- Prova: leitura dos testes.
- Impacto: ficam vermelhos sem causa assim que o staging/E2E tiver dados; uma vaga real vencida é travada e alterada dentro da transação do teste. Contradiz o "pode rodar até na produção" do CLAUDE.md §5.
- Causa raiz: asserções globais em vez de filtradas pelos ids do teste.
- Correção recomendada: filtrar pelos ids do teste e usar `conclude_finished_jobs(p_worker, p_company)`; corrigir a frase do CLAUDE.md §5.
- Critério de aceite: rodar a suíte num banco com dados de exemplo continua verde.
- Dependências: nenhuma

### D3a-009 — Testes e conferências que descrevem comportamento antigo ou não rodam o que dizem

- Área: testes
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `tests/y16_y17_documento.sql:39-43` (refaz o UPDATE da migration dentro do teste); `tests/z06_endereco.sql:1,11-34` (afirma "endereço só da dona e dos escolhidos", mas `has_column_privilege('authenticated','jobs','street','select')` é true no staging desde o U53; o front ainda chama `get_job_addresses`, `web/src/services/remote/data.ts:93,109`); `tests/z08_app_antigo.sql:23-24` ("até a remoção pendente do L07": o L07 não removeu o gatilho); `APLICAR.md:129` (#6 espera `street select -- false`, a #59 espera true)
- Prova: leitura dos testes e do APLICAR.md contra o estado do staging.
- Impacto: a prova de segurança do endereço não prova mais nada (ver D1-001, D1-002).
- Causa raiz: U53 mudou o grant sem atualizar testes e docs.
- Correção recomendada: testar a migration de limpeza de verdade; renomear z06 e decidir sobre `get_job_addresses`; corrigir #6 e o comentário do z08.
- Critério de aceite: cada teste afirma o comportamento atual.
- Dependências: D1-001

### D3a-010 — Constraints `NOT VALID` do L11 nunca validadas

- Área: banco
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261012000300_l11_validacao_perfil.sql:4-13`
- Prova: staging `convalidated=false` em `workers_name_length` e `companies_name_length`; produção `count(*)` fora da regra: 0 de 1 worker e 0 de 3 companies.
- Impacto: uma linha antiga fora da regra faria edições sem relação falharem com 23514.
- Causa raiz: faltou o `validate constraint`.
- Correção recomendada: migration com `validate constraint` nas duas.
- Critério de aceite: nenhuma constraint `*_name_length` com `convalidated=false`.
- Dependências: nenhuma

### D3a-011 — Mesmo ID de mudança usado em rodadas diferentes (L10, L11, L13)

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `l10_cnpj_receita` × `lanc10_link_publico`; `l13_conta_google` × `lanc13_mural_volume`; `l11_validacao_perfil` × CLAUDE.md §7.7; `APLICAR.md` #12 "(Y24 + L10)", #21 e #42 "(L10)", #22 e #44 "(L13)"; `migrations/20261011000500_y24_verificacao.sql:1` cita um "L10" que só nasce no dia seguinte
- Prova: leitura dos nomes e do APLICAR.md.
- Impacto: ninguém sabe a qual "L10" um texto se refere.
- Causa raiz: IDs reaproveitados entre rodadas.
- Correção recomendada: usar sempre `lanc10`/`lanc13` nos textos e anotar no CLAUDE.md §6 (não renomear arquivos: já estão no histórico). A desatualização geral de CLAUDE.md/APLICAR.md já está em D1-009.
- Critério de aceite: nenhum texto ambíguo restante.
- Dependências: nenhuma

## Hipóteses não confirmadas

- H1 — `migrations/20261012000200_l22_desfazer_recusa.sql:38`: sem evento `nao_selecionado`, `v_last."by"` e `v_last.at` são nulos, a condição vira NULL e o `raise` não dispara (desfaz fora dos 10 minutos). Só dados migrados do app antigo poderiam não ter evento; não reproduzido.
- H2 — `migrations/20261011000600_y25_whatsapp.sql:25-31,78`: a confirmação vale para o número, não para a conta, por 30 minutos; outra conta poderia pegar o selo se a vítima confirmar naquele momento.
- H3 — `z07:47-53`, `z08:57-64`, `f12:84-91`: sem `pg_cron` o `if exists` pula em silêncio e nenhuma rotina é agendada; não conferiu se o `staging.yml` pega isso.
- H4 — Produção × staging: `claim_document_for`, `confirm_boost_payment` e `document_login_email` têm md5 diferente; a única diferença são comentários SQL (lógica igual). O X16 diz que o conteúdo é "o dos arquivos": igual em lógica, não em bytes.

## Bom e deve ser preservado

- Nenhuma função `security definer` da lista é executável por anon; as de cobrança, `mark_whatsapp_verified`, `company_cnpj_for_check`, `set_company_verification` e `document_login_email` só têm service_role; todas com `search_path` fixo (as com PostGIS incluem `extensions`).
- Lista de `repair` do APLICAR.md exata (script): 41 "applied" = arquivos até x23; 53 "reverted" = versões da produção; a ordem #1–#63 bate com os arquivos; 25 pendentes na produção (lanc06…u67). O staging tem as mesmas versões dos arquivos.
- Enums novos usados só em `plpgsql` (z02, y01, y24, y28, f12): é o que permite a transação única do `APLICAR-TUDO.sql`.
- z09 (documento fora dos metadados do Auth), z02 (pagamento idempotente e revalidado), Storage sem listagem, contrato `BC4xx` mantido, algoritmos de CPF/CNPJ conferidos à mão.
