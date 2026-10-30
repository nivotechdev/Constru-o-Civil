# Auditoria completa do Bicos (rodada AUD)

> **Rodada AUD** (29–30/10/2026) · commit auditado `67d9ffb` = `master` (`5bddd2c`, 24/10) + 6 commits de limpeza e correções X30–X32 (branch `claude/eloquent-heisenberg-y5hwt6`; CI verde nesse commit) · entrega na branch `claude/auditoria`.
> **Somente leitura**: nenhuma alteração em código, banco, configuração ou segredo. Produção (`ppnxdajiihsjaojxokzh`): só catálogo e `count(*)`. Staging (`setyxomsbfrkneqqfoam`): leitura e provas em transações desfeitas.
> Documentos desta rodada: `PLANO-CORRECAO.md` (blocos e decisões), `PROMPT-CORRECAO.md` (prompt da rodada FIX), `AUDITORIA-ACHADOS-S3.md` (achados S3) e a pasta `auditoria/` (anexos dos agentes: inventários, matrizes, tabela de LGPD, medições).
> Como foi feita: 20 agentes especialistas leram o código e testaram o app (frentes 1 a 7), um consolidador juntou as duplicatas (290 registros → 222 achados) e dois céticos + um caçador revisaram o resultado (seção 8.7).

## 1. Resumo executivo

- **Nota geral: 6,0 / 10. Pronto para o público: NÃO.** A base é boa (RLS em todas as 39 tabelas, ACL mínima nas funções, máquina de status idêntica no app e no banco, 287 testes + 66 testes SQL, CI verde, nenhum segredo no repositório). O que impede o lançamento é privacidade, operação e alguns defeitos que o demo esconde.
- **222 achados:** 1 S0, 6 S1, 48 S2, 147 S3 e 20 melhorias. Estimativa de correção: cerca de 98 dias de uma pessoa (blocos 0 a 7).
- **Os 5 problemas mais graves**
  1. **A selfie e a foto do documento não são apagadas** — nem 30 dias depois da decisão (a rotina de limpeza não roda de verdade) nem quando a pessoa exclui a conta. A Política promete o contrário (S0 a exclusão da conta, S1 a limpeza dos 30 dias).
  2. **O link público da vaga e a Ajuda quebram para quem não tem conta** na versão de produção ("Essa tela não abriu"). No demo funciona, por isso ninguém viu. É o link que a empresa manda no WhatsApp (S1).
  3. **Textos legais com 10 campos em branco, sem prazo de guarda dos registros de acesso e com a casa do trabalhador indo para servidores de mapa de terceiros**, que a Política diz que "fica só com você" (S2, privacidade e LGPD).
  4. **Abuso fácil:** empresa sem verificação aprova todos e recebe o WhatsApp deles (golpe do falso emprego, S2); os limites de taxa usam um cabeçalho que o cliente escreve; um endereço gigante derruba o mural; o endereço exato de toda vaga é legível por qualquer conta (os três últimos são S1).
  5. **Produção às cegas:** a produção está 25 migrations e funções atrás do código, nada avisa ninguém quando algo quebra (Sentry e monitor desligados), o CI fica "verde" com o E2E pulado e o token do CI alcança a produção (S2, operação).
- **Os 5 ganhos mais rápidos** (esforço pequeno, efeito grande): (1) não envolver as telas públicas no casco do app logado; (2) aviso "Nunca pague para trabalhar" nas telas do WhatsApp liberado; (3) botões "Aprovar/Recusar" com texto e 48 px; (4) tirar do pré-cache do app os 0,9 MB que só se usam às vezes e carregar as fotos dos cartões sob demanda; (5) limites de tamanho nos campos de endereço (`CHECK`) e corrigir o texto do mural vazio.
- **Antes de mexer em qualquer coisa**: ler a seção 6 (o que está bom e não pode ser estragado) e decidir as perguntas do topo do `PLANO-CORRECAO.md`.

## 2. Notas por dimensão

| Dimensão                   | Nota | Por quê                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segurança                  |  6,0 | Banco muito bem fechado (RLS/ACL/`search_path`), sem segredo no repositório, webhook com HMAC. Mas os limites de taxa usam cabeçalho forjável, empresa sem verificação colhe WhatsApp, o selo "Verificada" é concedido a qualquer CNPJ ativo e sobrevive a troca de nome, e o token do CI enxerga a produção. |
| Privacidade / LGPD         |  4,0 | Há mapa de dados, exportação e exclusão, consentimento da selfie e política — mas a limpeza de identidades não roda, a exclusão deixa selfie/documento e avaliações escritas, a casa do trabalhador vai a terceiros, a Política tem campos em branco e promessas que o sistema não cumpre.                    |
| Corretude                  |  6,5 | A tabela de transições é idêntica nos dois lados e as corridas críticas têm trava. Defeitos reais: link público quebrado sem login, resposta atrasada cai na conta seguinte, hora do aparelho × Brasília, estados de pagamento sem tela.                                                                      |
| Banco                      |  7,5 | 176 funções com `search_path` fixo, nenhum overload, grants por coluna, Storage com tipos/tamanhos, 67 migrations = staging. Falta limite de tamanho em vários campos, tetos de abuso e testes negativos.                                                                                                     |
| Arquitetura / código       |  7,0 | Dois modos, uma porta; serviços coesos; contrato `ServiceError`/`BC4xx`. 24 ciclos entre serviços, demo e real com regras duplicadas, seed no pacote de produção, higiene de comentários.                                                                                                                     |
| Testes                     |  6,0 | 287 testes e 66 SQL, bom `fakeSupabase`. Telas e componentes quase sem teste (cobertura 37,7 %), nenhuma Edge Function testada, E2E pulado no CI, testes que falham em fuso diferente do CI.                                                                                                                  |
| Desempenho                 |  6,0 | 172 KB br de JS inicial e Lighthouse 96–99 no início. Mas o pré-cache baixa 0,9 MB de uma vez, o mural carrega fotos de 1600 px e duas árvores de tela, e consultas com centenas de ids estouram a URL.                                                                                                       |
| Acessibilidade             |  6,5 | axe sem violação em 31 telas e bom uso de teclado em modais. Mas foco invisível em controles, título da aba fixo, alvos < 44 px, contraste de textos pequenos e nomes repetidos ("Salvar vaga" ×26).                                                                                                          |
| UX / produto               |  6,5 | Fluxos curtos, texto claro, boa confirmação. Faltam aviso antigolpe, selo de verificação onde se decide, avisos fora do app, mural vazio correto, candidatos à vista e passos de status.                                                                                                                      |
| Operação / observabilidade |  4,0 | Nada avisa ninguém em produção, backup é uma frase, runbook parou na u12, produção desatualizada, CI e deploys sem freio. Boas travas de produção nos scripts.                                                                                                                                                |
| Documentação               |  5,5 | Muita e detalhada (DECISOES, runbooks), porém CLAUDE.md, ADVISORS, IMPLANTACAO e checklist desatualizados; documentos de fases antigas ainda confundem.                                                                                                                                                       |

## 3. Contagem

Total: **222** achados únicos (de 290 registros brutos dos agentes, depois de juntar duplicatas).

| Severidade | Quantidade |
| ---------- | ---------: |
| S0 crítico |          1 |
| S1 alto    |          6 |
| S2 médio   |         48 |
| S3 baixo   |        147 |
| M melhoria |         20 |

| Área           |  S0 |  S1 |  S2 |  S3 |   M | Total |
| -------------- | --: | --: | --: | --: | --: | ----: |
| bug            |   0 |   1 |   9 |  22 |   0 |    32 |
| LGPD           |   1 |   3 |   8 |  19 |   0 |    31 |
| UX             |   0 |   0 |   4 |  26 |   1 |    31 |
| produto        |   0 |   0 |   7 |   8 |  15 |    30 |
| segurança      |   0 |   2 |   9 |  10 |   2 |    23 |
| acessibilidade |   0 |   0 |   3 |  18 |   0 |    21 |
| processo       |   0 |   0 |   3 |   9 |   1 |    13 |
| testes         |   0 |   0 |   1 |  11 |   1 |    13 |
| desempenho     |   0 |   0 |   3 |   7 |   0 |    10 |
| banco          |   0 |   0 |   0 |   8 |   0 |     8 |
| código         |   0 |   0 |   1 |   4 |   0 |     5 |
| docs           |   0 |   0 |   0 |   5 |   0 |     5 |

| Bloco do plano                                                         |  S0 |  S1 |  S2 |  S3 |   M | Total |
| ---------------------------------------------------------------------- | --: | --: | --: | --: | --: | ----: |
| 0 — Segurança e privacidade                                            |   1 |   5 |  17 |  27 |   0 |    50 |
| 1 — Fluxo principal e correção de comportamento                        |   0 |   1 |  11 |  46 |   0 |    58 |
| 2 — Confiabilidade e observabilidade                                   |   0 |   0 |   5 |  15 |   0 |    20 |
| 3 — UX e acessibilidade para o público real                            |   0 |   0 |   9 |  27 |   0 |    36 |
| 4 — Desempenho                                                         |   0 |   0 |   3 |   6 |   0 |     9 |
| 5 — Código, testes e processo                                          |   0 |   0 |   2 |  19 |   0 |    21 |
| 6 — Documentação e higiene                                             |   0 |   0 |   1 |   7 |   0 |     8 |
| 7 — Melhorias de produto (agora)                                       |   0 |   0 |   0 |   0 |  17 |    17 |
| Fora — Fora desta rodada (potenciais futuros e dependentes de decisão) |   0 |   0 |   0 |   0 |   3 |     3 |

## 4. Achados

Ordem: S0, S1, S2 (aqui, completos). Os S3 estão em `web/docs/AUDITORIA-ACHADOS-S3.md` (mesmo formato) e as melhorias (M) na seção 5. A tabela abaixo lista todos.

| AUD     | Sev | Área           | Bloco | Esf. | Título                                                                                                                                       |
| ------- | --- | -------------- | ----- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-001 | S0  | LGPD           | 0     | P    | Excluir a conta não apaga a selfie e o documento na hora: a função só limpa 3 pastas; as fotos de identidade ficam para o cron (e só depois  |
| AUD-002 | S1  | LGPD           | 0     | M    | Rua, número, CEP e ponto exato de TODA vaga (inclusive casa/apartamento de pessoa física) saem por `select` direto para qualquer conta logad |
| AUD-003 | S1  | segurança      | 0     | P    | Texto do endereço da vaga sem limite: uma empresa faz o mural pesar MB                                                                       |
| AUD-004 | S1  | LGPD           | 0     | P    | Excluir a conta não apaga as avaliações que a pessoa escreveu                                                                                |
| AUD-005 | S1  | segurança      | 0     | P    | Todos os limites de taxa das Edge Functions usam o primeiro IP de `x-forwarded-for`, que o cliente pode escrever                             |
| AUD-006 | S1  | LGPD           | 0     | P    | A limpeza que apaga selfie/documento (30 dias), arquivos órfãos e sobras de exclusão não roda em nenhum ambiente, e o cron aparece como "suc |
| AUD-007 | S1  | bug            | 1     | P    | Link público da vaga e Ajuda quebram para quem não está logado (build de produção)                                                           |
| AUD-008 | S2  | LGPD           | 0     | M    | Vídeos do portfólio sobem sem remover metadados (GPS do aparelho) para um bucket público                                                     |
| AUD-009 | S2  | segurança      | 0     | M    | Empresa sem verificação aprova todos e recebe o WhatsApp deles (coleta para golpe do falso emprego)                                          |
| AUD-010 | S2  | segurança      | 0     | P    | Selo "Verificada/Verificado" permanece depois de trocar o nome                                                                               |
| AUD-011 | S2  | segurança      | 0     | M    | Reputação fabricada em segundos com duas contas                                                                                              |
| AUD-012 | S2  | segurança      | 0     | M    | Nenhum limite de vagas por empresa; "urgente" grátis pela API                                                                                |
| AUD-013 | S2  | segurança      | 0     | M    | "Empresa verificada" é concedida a qualquer pessoa que digite um CNPJ ativo qualquer                                                         |
| AUD-014 | S2  | LGPD           | 0     | M    | O mapa envia a casa do trabalhador (coordenada de rua, 6 casas) e o IP a servidores públicos de terceiros (OSRM e OpenStreetMap), coisa que  |
| AUD-015 | S2  | LGPD           | 0     | M    | Não existe guarda dos registros de acesso por 6 meses (Marco Civil, art. 15); a Política deixa o prazo em branco                             |
| AUD-016 | S2  | LGPD           | 0     | P    | Política e Termos publicados com 10 campos em branco (controlador, encarregado, prazos, base da transferência) e sem revisão jurídica; o bui |
| AUD-017 | S2  | LGPD           | 0     | M    | Firebase/Google (login por Google e por celular) não é citado como operador e o usuário nunca é apagado de lá; reCAPTCHA, Turnstile e SDK do |
| AUD-018 | S2  | LGPD           | 0     | P    | "Exportar meus dados" não traz tudo o que a Bicos guarda sobre a pessoa, mas a tela e a Política dizem que traz                              |
| AUD-019 | S2  | LGPD           | 0     | M    | O "hash do documento" é SHA-256 sem segredo: com um vazamento do banco ou de backup, os CPFs saem em minutos (e a máscara mostra 6 dos 9 díg |
| AUD-020 | S2  | segurança      | 0     | M    | "Login CSRF": o app aceita `#access_token=…&refresh_token=…` de qualquer link e entra na conta de quem montou o link                         |
| AUD-021 | S2  | LGPD           | 0     | M    | Qualquer conta logada lê todos os trabalhadores (nome, bairro, coordenada, foto, bio, experiências) com uma consulta só                      |
| AUD-022 | S2  | segurança      | 0     | P    | Vaga oculta pela equipe e conta suspensa ainda aprovam, contratam e convidam                                                                 |
| AUD-023 | S2  | segurança      | 0     | M    | O token da conta Supabase guardado no CI alcança a produção, e as mitigações do X30 não cobrem o ataque que importa                          |
| AUD-024 | S2  | segurança      | 0     | P    | O site de teste público (GitHub Pages) tem captcha de teste e manda e-mail de verdade pelo remetente da produção, sem aviso de "ambiente de  |
| AUD-025 | S2  | UX             | 1     | M    | Cadastro perde tudo ao recarregar a página no passo do código do WhatsApp                                                                    |
| AUD-026 | S2  | bug            | 1     | P    | Campos numéricos da vaga apagam vírgula, ponto e sinal e mudam o valor sem avisar                                                            |
| AUD-027 | S2  | bug            | 1     | P    | Ação que deu certo no servidor aparece como erro quando a releitura seguinte falha; em "publicar vaga" o novo toque cria uma vaga repetida   |
| AUD-028 | S2  | UX             | 1     | P    | Cadastro do endereço: sem internet (ou provedor lento) o app diz "Não achamos essa rua", e a localização é salva em silêncio no centro da ci |
| AUD-029 | S2  | bug            | 1     | P    | Resposta que chega depois do "Sair" cai no store da conta seguinte (selo de notificações de outra conta, consulta marcada como pronta)       |
| AUD-030 | S2  | UX             | 1     | P    | Mural vazio diz "Nenhuma vaga com esse filtro" sem filtro; "Limpar filtros" não faz nada                                                     |
| AUD-031 | S2  | bug            | 1     | P    | "Bicos fechados" (`/historico`) abre a aba "Abertas"                                                                                         |
| AUD-032 | S2  | bug            | 1     | M    | Pagamento do impulso: três estados sem tela (risco de cobrança em dobro no cartão em análise)                                                |
| AUD-033 | S2  | produto        | 1     | M    | "Voltar para a vaga depois de entrar" só vale no login com e-mail e senha; Google, SMS e cadastro novo caem no mural                         |
| AUD-034 | S2  | bug            | 1     | P    | A CSP não tem `media-src`: vídeo do portfólio não toca nem aparece na prévia, e nenhuma etapa do CI exercita a CSP num navegador             |
| AUD-035 | S2  | bug            | 1     | P    | Com o relógio do celular errado, o app dobra cada consulta ou desloga a pessoa uma vez por hora                                              |
| AUD-036 | S2  | código         | 2     | M    | Erros inesperados do servidor viram "Não deu certo agora" sem rastro: nada é enviado ao Sentry e a causa original é jogada fora              |
| AUD-037 | S2  | bug            | 2     | P    | Captcha sem tratar `timeout-callback`/`unsupported-callback` do Turnstile: "Entrar" gira até recarregar                                      |
| AUD-038 | S2  | bug            | 2     | M    | Pagamento aprovado que não pode ser aplicado, ou que falha no webhook, não avisa ninguém da equipe                                           |
| AUD-039 | S2  | produto        | 2     | M    | Reembolso prometido não tem fila, nem estado final, nem tratamento de estorno ou chargeback (Mercado Pago)                                   |
| AUD-040 | S2  | processo       | 2     | M    | Em produção nada avisa ninguém quando algo quebra (e o staging também não): Sentry e monitor de fora desligados, alerta do cron sem destino  |
| AUD-041 | S2  | UX             | 3     | P    | Sem caminho para a Ajuda/suporte nas telas onde mais gente trava                                                                             |
| AUD-042 | S2  | acessibilidade | 3     | P    | A linha do candidato é uma `div` com clique, sem teclado nem papel                                                                           |
| AUD-043 | S2  | acessibilidade | 3     | P    | Sem foco visível em Checkbox, Radio/RadioCard, Switch, PhotoSlot, PhotoManager e carrossel                                                   |
| AUD-044 | S2  | acessibilidade | 3     | P    | O título da aba nunca muda e o foco volta ao início a cada troca de tela                                                                     |
| AUD-045 | S2  | produto        | 3     | M    | Denúncia de perfil, avaliação ou publicação não tem como tirar o conteúdo do ar                                                              |
| AUD-046 | S2  | produto        | 3     | M    | Quem souber o CPF/CNPJ de outra pessoa trava o cadastro dela e apaga o cadastro pendente dela; não há prova de posse nem contestação         |
| AUD-047 | S2  | produto        | 3     | P    | O selo "Verificada" e o nome da empresa não aparecem onde se decide (card, vaga, confirmar candidatura)                                      |
| AUD-048 | S2  | produto        | 3     | M    | "Sua vaga": candidatos ~1.150 px abaixo; a barra fixa oferece "Editar vaga" e "Excluir vaga"                                                 |
| AUD-049 | S2  | produto        | 3     | M    | Avisos de candidato novo, aprovação e bico novo só existem dentro do app                                                                     |
| AUD-050 | S2  | desempenho     | 4     | P    | `feed_jobs` não limita o texto da busca: poucos KB de palavras repetidas prendem o banco por segundos (custo cresce com palavras × vagas)    |
| AUD-051 | S2  | desempenho     | 4     | M    | Mural: a 1ª foto de cada cartão carrega de uma vez em 1600 px, e as duas versões (celular e computador) ficam montadas                       |
| AUD-052 | S2  | desempenho     | 4     | M    | `.in('…', [centenas de ids])` monta URLs de 8 a 19 KB: "Minhas vagas" de empresa movimentada pode falhar                                     |
| AUD-053 | S2  | processo       | 5     | M    | Nada segura um commit com CI vermelho: master sem proteção, staging e site de teste não esperam o CI, e o plano de produção liga o Cloudflar |
| AUD-054 | S2  | testes         | 5     | M    | Nenhuma Edge Function tem teste; a assinatura do webhook de pagamento e as 10 funções só são conferidas com chamadas sem login               |
| AUD-055 | S2  | processo       | 6     | M    | O roteiro de produção (IMPLANTACAO.md) parou na migration u12: 13 migrations ficam de fora, sem "desfazer", e há passos que não funcionam co |
| AUD-056 | S3  | segurança      | 0     | M    | Nenhum teto de arquivos por conta no Storage (plano Free: 1 GB)                                                                              |
| AUD-057 | S3  | LGPD           | 0     | P    | Status da verificação de identidade (`recusado`, `em_analise`) legível por qualquer conta logada                                             |
| AUD-058 | S3  | segurança      | 0     | P    | Bloquear uma conta não corta contato nem contratação já aprovada                                                                             |
| AUD-059 | S3  | segurança      | 0     | P    | Leituras sem checar vínculo: `worker_track_record`, `job_stats` e erro que revela candidatura                                                |
| AUD-060 | S3  | LGPD           | 0     | P    | O servidor aceita qualquer "versão" de termos e de consentimento                                                                             |
| AUD-061 | S3  | banco          | 0     | P    | `cpf_valid`, `cnpj_valid`, `document_valid_for`, `whatsapp_valid` executáveis por visitante                                                  |
| AUD-062 | S3  | segurança      | 0     | M    | Auditoria da equipe mutável e com lacunas                                                                                                    |
| AUD-063 | S3  | segurança      | 0     | P    | Papel admin × moderador não faz diferença                                                                                                    |
| AUD-064 | S3  | LGPD           | 0     | P    | Link público: IP guardado como sha256(ip/data) sem segredo, limite burlável por IPv6, uma escrita por visita anônima, política não cita      |
| AUD-065 | S3  | segurança      | 0     | P    | Produção roda Edge Functions de antes do L05: captcha passa sem segredo, CORS cai para "*", 2 funções nem existem                            |
| AUD-066 | S3  | segurança      | 0     | P    | Notificação por push: endpoint de inscrição é qualquer `https://…` (SSRF cego) e o clique abre URL absoluta                                  |
| AUD-067 | S3  | segurança      | 0     | P    | Entrar por celular (Firebase) abre a conta pelo WhatsApp digitado no cadastro, mesmo sem confirmação do número                               |
| AUD-068 | S3  | segurança      | 0     | P    | No servidor a senha só precisa de 8 caracteres de qualquer tipo; "letras e números" e a checagem de senha vazada não existem lá              |
| AUD-069 | S3  | LGPD           | 0     | P    | Pagamentos: a Política diz que guarda "por obrigação fiscal", mas excluir a conta apaga `boost_payments` na hora; o prazo está em branco     |
| AUD-070 | S3  | LGPD           | 0     | M    | Histórico sem prazo de apagamento: decisões da equipe (`staff_actions`), denúncias resolvidas, avisos e eventos de pagamento ficam para semp |
| AUD-071 | S3  | LGPD           | 0     | M    | Retirar o consentimento da selfie/documento não tem caminho no app nem ferramenta da equipe; a Política promete "a qualquer momento"         |
| AUD-072 | S3  | LGPD           | 0     | P    | O gatilho do app antigo continua copiando nome e e-mail de cada cadastro novo para `profiles`; as 7 tabelas antigas seguem guardadas sem uso |
| AUD-073 | S3  | LGPD           | 0     | M    | Transferência internacional sem base declarada: 6 operadores listados fora do Brasil (e pelo menos 4 não citados) e nenhuma prova de contrat |
| AUD-074 | S3  | LGPD           | 0     | P    | Relatórios de erro (Sentry): a Política diz "sem dados pessoais", mas o mapa interno admite IP; a retenção de 30 dias e a opção de não guard |
| AUD-075 | S3  | LGPD           | 0     | P    | Coleta que a Política não descreve ou descreve só em parte                                                                                   |
| AUD-076 | S3  | LGPD           | 0     | P    | "Apagamos na hora" não diz nada sobre cópias de segurança; e hoje o plano Free nem tem cópia                                                 |
| AUD-077 | S3  | LGPD           | 0     | P    | Depois que o trabalhador exclui a conta, o primeiro nome dele continua nos avisos da empresa (e vice-versa)                                  |
| AUD-078 | S3  | LGPD           | 0     | P    | A exportação devolve o CPF/CNPJ em claro sem pedir a senha de novo (a exclusão pede)                                                         |
| AUD-079 | S3  | LGPD           | 0     | P    | Todo membro da equipe (inclusive "moderador") enxerga a selfie e a foto do documento; a Política diz "equipe de verificação"                 |
| AUD-080 | S3  | LGPD           | 0     | P    | Os direitos do titular existem no texto, mas o app só tem "exportar" e "excluir": não mostra o canal do encarregado nem como corrigir CPF, p |
| AUD-081 | S3  | LGPD           | 0     | P    | Não há plano de resposta a incidente de segurança, mas a Política promete avisar a pessoa e a ANPD                                           |
| AUD-082 | S3  | LGPD           | 0     | P    | Dados pessoais dos sócios num repositório público                                                                                            |
| AUD-083 | S3  | UX             | 1     | P    | Busca no mural com texto longo sem espaços: o título "Nenhuma vaga para “…”" sai do cartão                                                   |
| AUD-084 | S3  | UX             | 1     | P    | `/entrar-celular` sem botão, mas abre por link e responde "Na demonstração, entre com e-mail e senha"                                        |
| AUD-085 | S3  | UX             | 1     | P    | Cadastro aceita "Maria 😀 Souza" e não limita o nome; o editar perfil limita em 80                                                           |
| AUD-086 | S3  | bug            | 1     | P    | Fotos da vaga aceitam qualquer arquivo e qualquer tamanho, e cortam em 6 sem avisar                                                          |
| AUD-087 | S3  | UX             | 1     | P    | Impulsionar vaga de outra empresa mostra um título e uma explicação que não combinam                                                         |
| AUD-088 | S3  | bug            | 1     | P    | "Trocar WhatsApp" manda o código sem conferir se o número já é de outra conta                                                                |
| AUD-089 | S3  | UX             | 1     | P    | Passo do código (WhatsApp e e-mail) abre sem foco no campo: o teclado não sobe sozinho                                                       |
| AUD-090 | S3  | bug            | 1     | P    | "Minhas candidaturas", "Candidatos" e "Minhas vagas" só abrem se uma rotina que escreve (`conclude_my_finished_jobs`) der certo antes        |
| AUD-091 | S3  | UX             | 1     | P    | Mensagem pronta do WhatsApp erra o tratamento: "Aqui é da Ana Souza" (pessoa) e "Fui contratado" para qualquer trabalhador                   |
| AUD-092 | S3  | processo       | 1     | P    | Textos legais mudaram em 21/10 sem mudar `version` nem `updatedAt` (continuam "2.0 / 15/10/2026")                                            |
| AUD-093 | S3  | UX             | 1     | P    | Aviso de sucesso "E-mail trocado. Use o novo para entrar." aparece como erro (tom vermelho)                                                  |
| AUD-094 | S3  | bug            | 1     | P    | Posts do portfólio feitos no mesmo dia aparecem do mais antigo para o mais novo (comparador de ordenação inconsistente)                      |
| AUD-095 | S3  | UX             | 1     | P    | Envio de fotos/vídeos: sem prazo nem cancelamento, e erros do bucket viram sempre "Não deu para enviar a foto agora"                         |
| AUD-096 | S3  | UX             | 1     | P    | `checkPassword`/`verifyOtp` não tratam limite de tentativas nem conta suspensa: caem em "Não deu certo agora"                                |
| AUD-097 | S3  | UX             | 1     | P    | Qualquer erro do Firebase com a palavra "captcha" vira "Esse jeito de entrar ainda não está ligado"; navegadores embutidos (WhatsApp/Instagr |
| AUD-098 | S3  | bug            | 1     | P    | "Ver outros bicos" numa vaga encerrada vai ao login e volta para a mesma vaga                                                                |
| AUD-099 | S3  | bug            | 1     | P    | Legenda em edição sobrevive ao fechar o visualizador e vai para outro post                                                                   |
| AUD-100 | S3  | bug            | 1     | P    | "Publicar trabalho": o erro anterior reaparece ao reabrir a janela                                                                           |
| AUD-101 | S3  | código         | 1     | P    | Contagem do "reenviar código": três cópias, relógios que nunca param, "0:60" no SMS                                                          |
| AUD-102 | S3  | bug            | 1     | P    | Trocar WhatsApp: com captcha ligado, "Reenviar código" falha (latente)                                                                       |
| AUD-103 | S3  | UX             | 1     | P    | Link de redefinir senha vencido só avisa depois que a pessoa digita                                                                          |
| AUD-104 | S3  | bug            | 1     | P    | "Desfazer" remoção de experiência apaga o que foi adicionado depois                                                                          |
| AUD-105 | S3  | UX             | 1     | P    | "Desbloquear": todos os botões giram juntos                                                                                                  |
| AUD-106 | S3  | UX             | 1     | M    | O formulário de publicar vaga se perde ao sair da tela ou recarregar, sem aviso                                                              |
| AUD-107 | S3  | bug            | 1     | P    | Busca do mural mostra só a primeira página (30), sem "Carregar mais"                                                                         |
| AUD-108 | S3  | bug            | 1     | P    | Recarregar "Vaga publicada" mostra "vaga não encontrada"                                                                                     |
| AUD-109 | S3  | UX             | 1     | P    | Candidato aprovado: "Desfazer aprovação" e "Cancelar" são quase iguais                                                                       |
| AUD-110 | S3  | UX             | 1     | P    | Digitar na busca troca a lista pelo esqueleto                                                                                                |
| AUD-111 | S3  | UX             | 1     | P    | "Todas · N" em Minhas vagas conta só as páginas carregadas                                                                                   |
| AUD-112 | S3  | UX             | 1     | P    | /admin: pequenos furos                                                                                                                       |
| AUD-113 | S3  | UX             | 1     | P    | O prazo de 30 dias da vaga sem data não é dito a quem publica                                                                                |
| AUD-114 | S3  | bug            | 1     | P    | O GPS do `CityPicker` pode trocar a cidade depois de a folha ser fechada; a lista usa `listbox`/`option` sem setas                           |
| AUD-115 | S3  | bug            | 1     | P    | Nenhum `img` tem `onError`; o track do carrossel tem `aria-roledescription` sem `role`                                                       |
| AUD-116 | S3  | UX             | 1     | P    | Número colado com "+55" ou "0" vira outro número e é recusado                                                                                |
| AUD-117 | S3  | bug            | 1     | P    | Denúncias: alvo livre e denúncia analisada reaberta pelo denunciante                                                                         |
| AUD-118 | S3  | bug            | 1     | P    | Aviso "Bico novo" mostra o valor com vírgula americana: R$ 1.500 sai "R$ 1,500"                                                              |
| AUD-119 | S3  | produto        | 1     | M    | CNPJ alfanumérico (Receita, desde julho/2026) é recusado no cadastro e na verificação                                                        |
| AUD-120 | S3  | produto        | 1     | P    | Todo cadastro novo nasce com "São Paulo, SP" e coordenadas de SP; na produção as 4 contas ainda têm                                          |
| AUD-121 | S3  | banco          | 1     | P    | Constraints `NOT VALID` do L11 nunca validadas                                                                                               |
| AUD-122 | S3  | bug            | 1     | P    | Limites de localização diferentes entre as funções: quem mora em Fernando de Noronha não consegue cadastrar o endereço; UF e cidade da empre |
| AUD-123 | S3  | produto        | 1     | M    | A busca do banco só acha o que está no título, bairro e cidade: os sinônimos são de construção e as vagas novas não têm ofício               |
| AUD-124 | S3  | banco          | 1     | ?    | `submit_identity` aceita caminhos de arquivo que não existem, sem limite de tamanho, e o trabalhador fica "em análise" sem ter mandado selfi |
| AUD-125 | S3  | produto        | 1     | P    | "Não vou poder ir" não tem janela: depois do dia do bico o faltoso troca "falta" por "desistência"                                           |
| AUD-126 | S3  | código         | 1     | M    | Mural no modo real: o app refiltra e reordena o que o servidor mandou com regras ligeiramente diferentes                                     |
| AUD-127 | S3  | bug            | 1     | P    | "Hoje", "vaga vencida" e "diária começou" usam a data do aparelho; o servidor usa Brasília                                                   |
| AUD-128 | S3  | bug            | 1     | P    | Favicon e ícone da tela inicial quebram em rotas com mais de um segmento (`/v/:id`, o link compartilhado)                                    |
| AUD-129 | S3  | LGPD           | 2     | P    | Fim de sessão por outro caminho que não o botão "Sair" deixa o aparelho recebendo notificações da conta antiga                               |
| AUD-130 | S3  | bug            | 2     | P    | Falha de rede ao chamar uma Edge Function (com o aparelho "online") não vira `offline`: a pessoa vê "Não deu certo agora"                    |
| AUD-131 | S3  | bug            | 2     | P    | Se o download do supabase-js falhar uma vez, `getSupabase()` guarda a promessa rejeitada e o app não se recupera sem recarregar              |
| AUD-132 | S3  | UX             | 2     | P    | Se salvar o tema falhar, o aviso sempre diz "Sem internet" (mesmo quando a internet está boa)                                                |
| AUD-133 | S3  | banco          | 2     | P    | Se a linha `storage_public_base` faltar, a conferência das fotos deixa passar tudo e a limpeza diária apaga todas as fotos                   |
| AUD-134 | S3  | banco          | 2     | P    | Ordem de travas inconsistente (vaga↔candidatura, pagamento↔vaga): deadlock possível                                                          |
| AUD-135 | S3  | banco          | 2     | P    | Limites diários (candidaturas 30/dia, convites 20/dia, denúncias 20/dia) não são atômicos                                                    |
| AUD-136 | S3  | desempenho     | 2     | M    | Publicar vaga notifica todos os alertas na mesma transação                                                                                   |
| AUD-137 | S3  | banco          | 2     | P    | Migrations "idempotentes" que reescrevem dados/permissões quando rodam de novo                                                               |
| AUD-138 | S3  | banco          | 2     | P    | A migration pendente que apaga o app antigo está desatualizada e quebraria `signup_taken('documento')` e o cron `bicos-limpar-cadastros`     |
| AUD-139 | S3  | processo       | 2     | P    | Alerta de cron não enviado ao Sentry conta como "já alertado" por 24 h e nunca é reenviado                                                   |
| AUD-140 | S3  | segurança      | 2     | P    | Login por CPF/CNPJ: a resposta demora 140 vezes mais quando o documento existe, e 5 pedidos travam o login por documento de qualquer pessoa  |
| AUD-141 | S3  | bug            | 2     | P    | Nenhuma chamada a provedor externo tem prazo máximo; o app também não corta a espera                                                         |
| AUD-142 | S3  | bug            | 2     | P    | O avisador de erros usa `crypto.randomUUID()` sem proteção: em navegador antigo ele próprio dá erro e nada chega ao Sentry                   |
| AUD-143 | S3  | processo       | 2     | M    | Sem versão mínima: o app aberto em segundo plano pode ficar semanas na versão antiga falando com RPCs novas                                  |
| AUD-144 | S3  | UX             | 3     | P    | Textos que contradizem o contexto                                                                                                            |
| AUD-145 | S3  | acessibilidade | 3     | P    | Sem `h1` em várias telas                                                                                                                     |
| AUD-146 | S3  | UX             | 3     | P    | Em 360 px o status mais importante é cortado                                                                                                 |
| AUD-147 | S3  | UX             | 3     | P    | Ao errar o formulário, o foco não vai para o primeiro erro e a mensagem do título fica escondida sob a barra fixa                            |
| AUD-148 | S3  | UX             | 3     | P    | No desktop o valor "R$ 150" quebra em duas linhas no cartão "Diária que você ofereceu"                                                       |
| AUD-149 | S3  | acessibilidade | 3     | P    | Alvos de toque pequenos nas telas de entrada e leitura                                                                                       |
| AUD-150 | S3  | acessibilidade | 3     | P    | Foco/nome acessível ausentes (checkbox, "não lida", selo, progresso)                                                                         |
| AUD-151 | S3  | acessibilidade | 3     | P    | Os dois campos de horário do passo 2 de publicar vaga não têm nome acessível                                                                 |
| AUD-152 | S3  | acessibilidade | 3     | P    | Escolhas visuais sem estado para leitor de tela                                                                                              |
| AUD-153 | S3  | acessibilidade | 3     | P    | `Button loading` perde o nome acessível, encolhe e fica desativado                                                                           |
| AUD-154 | S3  | acessibilidade | 3     | P    | `PhotoSlot` com foto escolhida tem campo de arquivo sem nome; remover do `PhotoManager` tem 28 px                                            |
| AUD-155 | S3  | acessibilidade | 3     | P    | `Rating showValue={false}` não tem texto equivalente                                                                                         |
| AUD-156 | S3  | acessibilidade | 3     | P    | Erro não ligado ao campo em `Select`, `CodeInput` e `AboutField`; o CEP aponta para um id que some                                           |
| AUD-157 | S3  | acessibilidade | 3     | P    | Contrastes abaixo de WCAG AA                                                                                                                 |
| AUD-158 | S3  | acessibilidade | 3     | P    | Toast some em 4 s, inclusive erro e "Desfazer", sem pausar                                                                                   |
| AUD-159 | S3  | acessibilidade | 3     | P    | `NotificationsPanel` não move nem devolve o foco; selo do sino fora do nome acessível; "Não lida" em `span` com `aria-label`                 |
| AUD-160 | S3  | acessibilidade | 3     | P    | `alertdialog` sem `aria-describedby`; erro do `SignOutDialog` entra no lugar da descrição, sem `role="alert"`                                |
| AUD-161 | S3  | acessibilidade | 3     | P    | `h3` fixo em `EmptyState`, `ErrorState` e `ReviewUnavailable`; `JobNotFound` é tela sem saída                                                |
| AUD-162 | S3  | acessibilidade | 3     | P    | Com "reduzir movimento" o ícone de carregando fica parado                                                                                    |
| AUD-163 | S3  | produto        | 3     | M    | Apagar a conta apaga também as denúncias, os bloqueios e o registro de suspensão: quem foi denunciado some e volta limpo com o mesmo CPF     |
| AUD-164 | S3  | UX             | 3     | P    | E-mail "Magic link" fala em excluir a conta, mas qualquer pessoa com a chave pública pode disparar para qualquer e-mail cadastrado           |
| AUD-165 | S3  | produto        | 3     | P    | Nenhuma tela do app avisa contra golpe (dinheiro/PIX antecipado, "taxa")                                                                     |
| AUD-166 | S3  | produto        | 3     | P    | Aprovar e Recusar candidato: dois ícones de 40×40 px, sem texto, lado a lado                                                                 |
| AUD-167 | S3  | produto        | 3     | P    | Vocabulário que ainda diverge na tela (lista com arquivo:linha em `termos.md` §2)                                                            |
| AUD-168 | S3  | UX             | 3     | P    | A cidade do mural só aparece dentro da folha "Filtros"                                                                                       |
| AUD-169 | S3  | acessibilidade | 3     | P    | Com fonte a 200 %, a barra de baixo vira "I…", "V…", "P…" e os títulos das vagas ficam com uma palavra                                       |
| AUD-170 | S3  | acessibilidade | 3     | P    | Todo botão de salvar vaga se chama só "Salvar vaga" (26 iguais no mural)                                                                     |
| AUD-171 | S3  | desempenho     | 4     | M    | Lista do IBGE (≈64 KB gz) no pacote principal e prefetch de todas as telas pesam na primeira visita                                          |
| AUD-172 | S3  | desempenho     | 4     | M    | A versão de produção leva dentro os dados de demonstração e a senha da conta de exemplo                                                      |
| AUD-173 | S3  | desempenho     | 4     | P    | O service worker baixa 0,88 MB de uma vez na primeira visita (heic2any, mapa, Firebase, tela da equipe, fontes pouco usadas)                 |
| AUD-174 | S3  | desempenho     | 4     | M    | O mural espera até 5 idas e voltas ao banco, uma depois da outra, antes de desenhar                                                          |
| AUD-175 | S3  | desempenho     | 4     | P    | PIX: um relógio de 1 s refaz a tela inteira e a consulta a cada 5 s não para com a aba escondida                                             |
| AUD-176 | S3  | desempenho     | 4     | M    | Vídeo de até 50 MB sobe sem compressão, sem prazo e sem como cancelar                                                                        |
| AUD-177 | S3  | testes         | 5     | M    | Testes SQL sem as regras mais importantes de autorização, Storage e pagamento                                                                |
| AUD-178 | S3  | testes         | 5     | P    | Testes que só passam em banco vazio e mexem no banco inteiro                                                                                 |
| AUD-179 | S3  | código         | 5     | P    | Pequenas folgas na validação: assinatura do webhook com `ts` não numérico, `APP_ORIGIN` aceita `https://*.com`                               |
| AUD-180 | S3  | processo       | 5     | P    | Os artefatos do E2E (relatório e rastros do Playwright) ficam em repositório público, sem retenção curta                                     |
| AUD-181 | S3  | LGPD           | 5     | P    | O staging acumula lixo de teste e dado de gente real, sem rotina de limpeza                                                                  |
| AUD-182 | S3  | testes         | 5     | ?    | O E2E nunca executa de verdade 5 das 10 Edge Functions, simula o Google com `createUser` e finge o CNPJ e o mapa; também não tem visitante n |
| AUD-183 | S3  | testes         | 5     | M    | O corpo demo deixa passar o que o banco recusa (candidatura, convite, presença, aviso, cadastro, avaliação)                                  |
| AUD-184 | S3  | acessibilidade | 5     | P    | Acessibilidade e desempenho no CI medem a demonstração, e duas telas varridas pelo axe são "Página não encontrada"                           |
| AUD-185 | S3  | processo       | 5     | P    | O `--mostrar` do configurar-auth.mjs não mostra o estado atual, mas o roteiro usa isso como "desfazer" do Auth                               |
| AUD-186 | S3  | processo       | 5     | M    | O "backup manual antes de qualquer mudança" do X30 é uma frase: sem script, sem teste de restauração e sem cópia da chave que decifra os CPF |
| AUD-187 | S3  | processo       | 5     | P    | Dependências e actions: 9 vulnerabilidades em ferramentas de desenvolvimento sem `npm audit` no CI, sem Dependabot, actions por tag, Node 22 |
| AUD-188 | S3  | processo       | 5     | P    | Scripts de deploy: a trava de produção do deploy.sh é uma variável de ambiente, publica o que está no disco e não confere que o build é o da |
| AUD-189 | S3  | testes         | 5     | M    | As telas só são abertas no build de demonstração (axe e rolagem); o modo real só é visto pelo E2E pós-merge, sem visitante, sem rede ruim e  |
| AUD-190 | S3  | testes         | 5     | P    | O job `e2e` do `web.yml` passa vazio e duplica o do `staging.yml`; LEIA.md, E2E.md e relatorio.ts descrevem o que não roda                   |
| AUD-191 | S3  | testes         | 5     | P    | O E2E deixa lixo e mexe em dados que não são dele no staging                                                                                 |
| AUD-192 | S3  | testes         | 5     | P    | Os testes Vitest não restauram globais/ambiente sozinhos: uma asserção que falha contamina os testes seguintes                               |
| AUD-193 | S3  | testes         | 5     | P    | Asserções frouxas, ramos condicionais e um arquivo com nome enganoso                                                                         |
| AUD-194 | S3  | testes         | 5     | P    | O harness dos testes SQL: `fails()` só confere o SQLSTATE e `run.mjs` sai com 0 sem `DATABASE_URL`                                           |
| AUD-195 | S3  | docs           | 5     | P    | Não existe alvo de navegadores: o build promete uma coisa e o código e o CSS exigem outra                                                    |
| AUD-196 | S3  | código         | 6     | P    | Higiene: duplicações e comentários/documentos desatualizados                                                                                 |
| AUD-197 | S3  | testes         | 6     | P    | `seguranca.sql` e a documentação afirmam proteção que não existe mais (endereço, nota, selo, impulso "não saem por select")                  |
| AUD-198 | S3  | docs           | 6     | P    | Documentos descrevem o banco de antes (staging "sem migrations", 48 arquivos, 42/54 RPCs)                                                    |
| AUD-199 | S3  | docs           | 6     | P    | Textos e comentários que ficaram para trás depois do U48/U53/U24 (inclui um "construtora" no aviso de suspensão)                             |
| AUD-200 | S3  | docs           | 6     | P    | Variáveis do Firebase não estão documentadas nos exemplos de ambiente                                                                        |
| AUD-201 | S3  | processo       | 6     | P    | O checklist de lançamento não tem dono nem prazo em nenhum item, e o estado "feito/falta" está desatualizado                                 |
| AUD-202 | S3  | docs           | 6     | P    | Documentos da migração antiga e relatórios velhos confundem: mandam rodar comandos que não existem e descrevem telas que saíram              |
| AUD-203 | M   | produto        | 7     | P    | Compartilhar vaga só oferece WhatsApp; sem "Copiar link"                                                                                     |
| AUD-204 | M   | produto        | 7     | M    | Link da vaga no WhatsApp mostra sempre a mesma pré-visualização                                                                              |
| AUD-205 | M   | produto        | 7     | P    | Cadastro: cada "Continuar" fecha o teclado                                                                                                   |
| AUD-206 | M   | produto        | 7     | P    | Valor pago não é conferido antes de confirmar o impulso                                                                                      |
| AUD-207 | M   | produto        | 7     | P    | `feed_jobs` não usa `blocked_between`; só o app filtra bloqueados                                                                            |
| AUD-208 | M   | processo       | 7     | P    | Roteiro de aplicação na produção: dados atuais não correm risco, mas há 9 colunas apagadas sem volta, 2 funções removidas e ordem rígida     |
| AUD-209 | M   | segurança      | 7     | P    | Folgas na CSP e nos cabeçalhos                                                                                                               |
| AUD-210 | M   | segurança      | 7     | P    | Não existe "Sair de todos os aparelhos" e a redefinição de senha só encerra a sessão deste aparelho                                          |
| AUD-211 | M   | produto        | 7     | M    | Política em linguagem jurídica para um público de celular simples                                                                            |
| AUD-212 | M   | testes         | 7     | P    | Melhoria: matriz de fusos e medição de cobertura no CI (agora)                                                                               |
| AUD-213 | M   | produto        | 7     | M    | Deixar ver bicos antes de criar a conta                                                                                                      |
| AUD-214 | M   | produto        | 7     | M    | Endereço completo só depois do primeiro bico                                                                                                 |
| AUD-215 | M   | produto        | 7     | M    | Linha do tempo da candidatura (padrão do pedido do iFood)                                                                                    |
| AUD-216 | M   | produto        | 7     | M    | "Chamar de novo" quem trabalhou bem                                                                                                          |
| AUD-217 | M   | produto        | 7     | P    | O alerta "Avisar quando aparecer bico novo" vira passo do cadastro e do mural vazio                                                          |
| AUD-218 | M   | UX             | 7     | M    | Card do mural mais denso e informativo                                                                                                       |
| AUD-219 | M   | produto        | 7     | P    | Candidatura em um toque com "Desfazer"                                                                                                       |
| AUD-220 | M   | produto        | Fora  | P    | Descrição livre da vaga vai ao link público sem filtro de contato                                                                            |
| AUD-221 | M   | produto        | Fora  | G    | Pagamento fora do app sem "recebi" e sem renda acumulada                                                                                     |
| AUD-222 | M   | produto        | Fora  | M    | Prova social ("Pagou no dia 12 de 14") no detalhe da vaga e no card                                                                          |

## 4.1 S0 crítico (1)

#### Área: LGPD

### AUD-001 — Excluir a conta não apaga a selfie e o documento na hora: a função só limpa 3 pastas; as fotos de identidade ficam para o cron (e só depois de 1 dia)

- Área: LGPD
- Severidade: S0 crítico — Excluir a conta não apaga selfie e documento, contra o que a Política promete e contra o direito de eliminação (LGPD art. 18, VI).
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/functions/excluir-conta/index.ts:18` (`const BUCKETS = ['avatars', 'portfolio', 'vagas']`), `web/supabase/migrations/20261014000400_x09_arquivos_orfaos.sql:33-70` (`identity_files`: `o.created_at < now() - interval '1 day'`), `web/src/services/legal.ts:155` ("Ao excluir a conta, apagamos na hora seus dados, arquivos…"), `web/docs/DECISOES.md` R04 ("os arquivos ficam sem uso e orphan_storage_objects os pega")
- Prova: `excluir-conta` roda `delete_my_account` (que apaga as linhas de `identity_submissions` por cascata, `anonymize_account`) e depois remove só `avatars`, `portfolio` e `vagas` da pasta `<uid>/`. O bucket `identidade` não aparece no código. Os objetos só saem pelo cron `bicos-limpar-arquivos` (04:40 UTC), e `orphan_storage_objects` só considera arquivos com mais de 1 dia. Com AUD-006 (cron sem efeito), a selfie e o documento de uma conta excluída permanecem indefinidamente. O mesmo vale para a exclusão feita pelo painel do Supabase (`on_auth_user_deleted`).
- Impacto: a pessoa pede para apagar tudo e a foto do rosto e do documento dela continuam guardadas, contra o que a Política promete e contra o art. 18, VI (eliminação) para dado sensível.
- Causa raiz: a lista de buckets da função foi escrita antes do bucket `identidade` (F07) e a decisão do R04 delegou o apagamento ao cron.
- Correção recomendada: incluir `identidade` em `BUCKETS` (a pasta `<uid>/` é a mesma). Para a exclusão pelo painel (sem passar pela função), contar com o cron depois que AUD-006 estiver resolvido, mas tirar a espera de 1 dia quando o dono do arquivo já não existe (`not exists (select 1 from auth.users where id::text = (storage.foldername(o.name))[1])`). Não apagar direto em `storage.objects`: o gatilho `protect_objects_delete` do Supabase só aceita a API do Storage.
- Critério de aceite: teste (Deno/Vitest com fake) em que `excluir-conta` remove a pasta `identidade/<uid>/`; em staging, subir selfie, excluir a conta e conferir `storage.objects` = 0 para o uid, sem esperar o cron.
- Dependências: nenhuma (código). Relacionado a AUD-006.
- Origem: D5-002 (D5)
- Revisão adversária: Cético confirmou (`excluir-conta/index.ts:18` ignora o bucket `identidade`; os 142 arquivos do staging são de usuários que não existem mais) e sugeriu S1 por não haver dado real; **mantido S0** porque é descumprimento claro e direto de um pedido de exclusão, latente até o 1º envio real.

## 4.2 S1 alto (6)

#### Área: LGPD

### AUD-002 — Rua, número, CEP e ponto exato de TODA vaga (inclusive casa/apartamento de pessoa física) saem por `select` direto para qualquer conta logada

- Área: LGPD
- Severidade: S1 alto — Endereço exato de toda vaga (inclusive residência de pessoa física) legível em massa por qualquer conta logada; decisão U53 sem freio.
- Esforço: M
- Confiança: confirmado (reproduzido no staging)
- Onde: `web/supabase/migrations/20261021000800_u53_endereco_publico.sql:10` (`grant select (cep, street, number, complement, lat, lon) on public.jobs to authenticated`); política `jobs` (`using (deleted_at is null and hidden_at is null …)`); `jobs.place_type` aceita `casa`/`apartamento` (`20261021000700_u52_dias_e_local.sql:22-24`)
- Prova: no staging, como uma trabalhadora de fora, `select street,number,lat,lon,cep from public.jobs where id='BC-5164'` devolveu 1 linha e `select id from public.jobs` devolveu 11 de 11 vagas visíveis, sem filtro e sem passar pelo app. `has_column_privilege('authenticated','public.jobs','street','select')` = true. Na produção (U53 ainda não aplicada) as mesmas colunas NÃO são legíveis (`cep,street,number,complement,lat,lon,area_geog` fora do `select`).
- Impacto: uma conta grátis (e-mail + senha, sem verificação de identidade) consegue baixar de uma vez a lista de endereços exatos de todas as vagas, inclusive de quem contrata um serviço em casa. Dá para montar um mapa de casas com data/horário em que a pessoa estará no local.
- Causa raiz: a decisão U53 ("qualquer pessoa vê onde é o bico") foi implementada como permissão de coluna na tabela inteira, sem limite de volume e sem distinguir local comercial de residência; depois do U48 o produto aceita pessoa física como contratante. A decisão está documentada (DECISOES U53), mas o desenho não tem freio: ID sequencial + coluna aberta = coleta em massa.
- Correção recomendada: voltar a ler endereço só por RPC (ex.: `get_job_addresses` ampliada) que devolve rua/número apenas depois da candidatura (ou para quem passou pelo mural), com limite por conta; até lá, mostrar bairro/ponto aproximado (`area_lat/area_lon` já existem) e liberar o exato quando `place_type` = comércio ou depois de a empresa aprovar. Alternativa mínima: manter o público, mas esconder rua/número/ponto exato quando `place_type in ('casa','apartamento','condominio')`.
- Critério de aceite: como conta de fora, `select street, number, lat, lon from jobs` falha (42501) ou volta nulo para vagas residenciais; o teste `seguranca.sql` passa a exercitar a coluna (hoje só testa `get_job_addresses`).
- Dependências: decisão do responsável (muda o U53 pedido por ele); texto da política de privacidade.
- Origem: D1-001 (D1)
- Revisão adversária: Cético: decisão do responsável (U53, `DECISOES.md:2257-2279`) com aviso na Política; sugeriu S2. **Mantido S1**: o risco residual (extração em massa por conta grátis; residência de pessoa física) não foi ponderado na decisão. Vai para a decisão nº 1 dos sócios.

### AUD-004 — Excluir a conta não apaga as avaliações que a pessoa escreveu

- Área: LGPD
- Severidade: S1 alto
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000500_u48_publico_geral.sql:79` (`anonymize_account` apaga `reviews` só pelo id do avaliado) e `:458` (`submit_review`: autor só em `author_label`); `web/docs/DECISOES.md:1833-1850` (U24) e a política dizem "apagamos as avaliações que você fez e recebeu"
- Prova: empresa executa `delete_my_account(true)`: a avaliação dela sobre o trabalhador continua (label=Empresa Tres, comment=otimo), nota 5.0/1; trabalhador exclui: a dele sobre a empresa continua (label=Worker Q., comment=bom), nota da empresa 4.0/1. (S1 e não S0: sobra nome de exibição + comentário, sem documento/contato.)
- Impacto: o nome e a opinião de quem pediu exclusão seguem visíveis para todas as contas; a promessa da política é falsa para metade das avaliações.
- Causa raiz: `reviews` não guarda o autor por id; a FK em cascata só leva as linhas do avaliado.
- Correção recomendada: coluna `author_account` (backfill por `application_id`), apagar por ela em `anonymize_account` e refazer as notas; ou anonimizar label + comentário e corrigir política/decisão.
- Critério de aceite: estender `tests/u24_exclusao_completa.sql` (0 avaliações escritas pela conta, nota refeita).
- Dependências: responsável reconcilia política × decisão
- Origem: D2-003 (D2); também reportado por: D3c-001, C3-002
- Revisão adversária: Cético: mantido (`submit_review` grava só o lado avaliado; `anonymize_account` e U24 prometem apagar 'as que fez').
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3c-001 (S2): Excluir a conta NÃO apaga as avaliações que a pessoa escreveu (só as que recebeu), apesar do U24, da política de privacidade e do teste verde — onde: `web/supabase/migrations/20261021000500_u48_publico_geral.sql:101-102` e `:138-139` (versão em uso de `anonymize_account`; mesma lógica em `20261020000300_u24_exclusao_completa.sql:36-37,73-74`); gravação das avaliações em `u48…sql:501-502` e `:510-511` (`submit_review`); `web/src/services/legal.ts:155`; fixture em `web/supabase/tests/u24_exclusao_completa.sql:20-24`
  - C3-002 (S2): "Conta excluída" contradiz a exclusão real — onde: `pages/shared/AccountDeleted.tsx:12-15`; contraste: `DeleteAccount.tsx:121-123`, `services/legal.ts:155`, migration `20261020000300_u24_exclusao_completa.sql`, `DECISOES.md` U24

### AUD-006 — A limpeza que apaga selfie/documento (30 dias), arquivos órfãos e sobras de exclusão não roda em nenhum ambiente, e o cron aparece como "sucesso"

- Área: LGPD
- Severidade: S1 alto — Promessa pública de apagar selfie/documento em 30 dias descumprida: a rotina não roda (descumprimento claro da LGPD, latente até o primeiro envio real). Ajustado na revisão adversária de S0 para S1: Cético: nenhum dado real hoje (0 arquivos de identidade na produção; 142 órfãos de teste no staging) e o passo do `CLAUDE.md`/IMPLANTACAO já pede o segredo da limpeza; é bloqueador antes da 1ª selfie. Rebaixado de S0 para S1; o S0 fica na exclusão (AUD-001).
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261014000400_x09_arquivos_orfaos.sql:73` (`call_storage_cleanup`: `if v_url is null or v_secret is null then return;`), `web/supabase/functions/limpar-arquivos/index.ts:12,29`, `web/supabase/migrations/20261016000300_lanc12_vigia_cron.sql:101-120` (`check_cron_failures` só olha status `failed`), `legal.ts:130,156` (promessa de 30 dias)
- Prova: staging (`setyxomsbfrkneqqfoam`), consultas só de contagem: `storage.objects` do bucket `identidade` = 142 arquivos, criados de 19/10 a 24/10/2026; `identity_submissions` = 0 linhas; `orphan_storage_objects(1000)` devolve os 142 de `identidade` (279 no total) — ou seja, todos já deviam ter sido apagados. `vault.secrets` do staging só tem `nivotech_documento_key` (sem `bicos_cleanup_url`/`bicos_cleanup_secret`). `cron.job_run_details` do job `bicos-limpar-arquivos`: 11 execuções `succeeded` (última 29/10 04:40), porque `call_storage_cleanup` sai em silêncio sem os segredos. Produção (`ppnxdajiihsjaojxokzh`): Vault tem os 2 segredos, mas `net._http_response` tem uma resposta 401 (função sem `CLEANUP_SECRET`) e 18 execuções `succeeded` do cron; `web/docs/SUPABASE.md:129` admite "a chamada diária é recusada (401) e nada é apagado". Produção ainda tem 0 arquivos em `identidade`.
- Impacto: a Política (seção 3 e 6) promete que selfie e foto do documento (dado biométrico sensível, art. 11) são apagadas 30 dias após a decisão. Hoje nada as apaga, e ninguém é avisado, porque o painel de cron mostra tudo verde.
- Causa raiz: o apagamento depende de 3 peças configuradas à mão (segredo no Vault, `CLEANUP_SECRET` na função, URL), e a falta de qualquer uma é tratada como "nada a fazer" (sem erro, sem alerta). O vigia de cron (L12) só detecta `failed`; um `succeeded` que não fez nada, ou um HTTP 401/429 no `pg_net`, passa batido.
- Correção recomendada: (1) configurar as 3 peças em produção e staging; (2) `call_storage_cleanup` deve levantar erro (ou gravar em `cron_alerts`) quando faltar segredo; (3) `check_cron_failures` deve também olhar `net._http_response` com status ≠ 2xx da última chamada; (4) um teste/consulta de saúde: "existe arquivo de `identidade` com mais de 31 dias sem linha em `identity_submissions` ou decidida há mais de 30 dias" = alerta; (5) apagar à mão os 142 arquivos de teste do staging.
- Critério de aceite: staging: `select count(*) from public.orphan_storage_objects(1000)` = 0 no dia seguinte à configuração; `storage.objects` de `identidade` sem arquivo órfão; ao remover o segredo de propósito, o cron passa a `failed` ou gera linha em `cron_alerts`.
- Dependências: ação do responsável (criar `CLEANUP_SECRET` na função; já documentado em SUPABASE.md:129). Relacionado a AUD-001.
- Origem: D5-001 (D5)

#### Área: segurança

### AUD-003 — Texto do endereço da vaga sem limite: uma empresa faz o mural pesar MB

- Área: segurança
- Severidade: S1 alto
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000700_u52_dias_e_local.sql:31` (`job_from_draft`: street/number/complement/neighborhood/city só com btrim); `web/supabase/migrations/20261022000300_u65_valor_minimo.sql:8` (`feed_jobs` devolve street/neighborhood); `jobs` sem CHECK de tamanho; URLs de foto só têm prefixo conferido (`check_job_photos_v2`)
- Prova: `publish_job` com street de 100.000 letras aceito (BC-5296); 3 vagas com street+neighborhood de 1.000.000 letras: `feed_jobs('Caxias do Sul','RS',…)` devolveu 15 itens, 6.020.384 bytes numa página; empresa com status padrão `pendente`.
- Impacto: qualquer conta de empresa nova deixa o mural da cidade baixando dezenas de MB por página (celular simples): a tela principal fica inutilizável.
- Causa raiz: a validação cobre título/descrição/requisitos e esqueceu o endereço.
- Correção recomendada: CHECK `char_length` (street ≤120, neighborhood/city ≤80, number ≤10, complement ≤60, URL de foto ≤300) NOT VALID + VALIDATE, e a mesma checagem em `job_from_draft` com BC422 (colunas editáveis: ver D1-003).
- Critério de aceite: `publish_job` com street de 121 letras → BC422; página do mural < 20 KB por vaga.
- Dependências: nenhuma (relacionado a D1-003)
- Origem: D2-001 (D2); também reportado por: D1-003, HUNT-005
- Revisão adversária: Cético: mantido.
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D1-003 (S3): Campos de texto e coordenadas gravados direto pela API sem limite; portfólio sem teto de linhas — onde: grants `update (name, city, neighborhood, lat, lon, photo_url, cover_url, bio, experiences)` em `workers` e `update (name, location, logo_url, cover_url, about)` em `companies`; `insert (worker_id, media_url, media_type, caption)` em `worker_posts` (`20261009000100_bicos_v2_schema.sql:286,293,304` e migrations posteriores); só gatilho `check_post_media_v2`
  - HUNT-005 (S2): Colunas liberadas por GRANT para escrita direta aceitam MBs e coordenada inválida em perfis (aspecto novo de AUD-003 / AUD-003) — onde: `supabase/migrations/20261009000100_bicos_v2_schema.sql:286-293` (grants); ausência de CHECK ou gatilho em `workers.city`, `workers.neighborhood`, `workers.lat`, `workers.lon` e `companies.location`

### AUD-005 — Todos os limites de taxa das Edge Functions usam o primeiro IP de `x-forwarded-for`, que o cliente pode escrever

- Área: segurança
- Severidade: S1 alto
- Esforço: P
- Confiança: provável (código + a própria decisão do projeto; o teste ao vivo com cabeçalho forjado não foi feito: o staging não é acessível pela rede e uma chamada via pg_net gravaria linhas)
- Onde: `web/supabase/functions/_shared/http.ts:63-66` (`clientIp`); usado por `entrar-com-documento/index.ts:35,44`, `verificar-cadastro/index.ts:55-65`, `codigo-whatsapp/index.ts:57,64`, `entrar-com-firebase/index.ts:56`; contraste: `web/supabase/migrations/20261016000200_lanc10_link_publico.sql:55-58` e `20261021000700_u52_dias_e_local.sql:390-393`; `web/docs/DECISOES.md` L10 (linha ~1394)
- Prova: `clientIp` faz `(req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()`. Quem fica na frente (Cloudflare) acrescenta o IP real ao FINAL de um `X-Forwarded-For` que o cliente já mandou; o primeiro item continua sendo o que o cliente escreveu. O próprio projeto sabe: no L10 a RPC `public_job_card` lê `cf-connecting-ip` primeiro e a migration comenta "cf-connecting-ip é posto pela Cloudflare … (o cliente não consegue forjar); os outros cabeçalhos só de reserva". Os logs de borda do Supabase listam `request.headers.cf_connecting_ip` e `x_real_ip` (staging, `function_edge_logs`), então o cabeçalho confiável chega à borda. No staging, `auth_attempts` guarda a chave `cadastro-ip:<ipv4>` (um IPv4 por linha), ou seja, o `x-forwarded-for` existe e é usado como chave.
- Impacto: quem quer varrer CPFs/e-mails em `verificar-cadastro` (30 por IP; captcha só após 12 por IP — X32), tentar senhas em `entrar-com-documento` (20 por IP), pedir códigos de WhatsApp em massa (`zap-ip`, 10 por hora) ou abusar do `entrar-com-firebase` (20 por IP) manda um `X-Forwarded-For` diferente a cada pedido e nunca bate no limite por IP nem vê o captcha do X32. Sobram só os limites por valor (10 por CPF/e-mail, 5 por documento, 3 por telefone), que não impedem varrer valores diferentes. Inversamente, um atacante pode gastar o limite de um IP alheio de propósito.
- Causa raiz: um helper escrito antes do L10 e nunca alinhado com a conclusão do L10; a RPC do banco usa a ordem certa, as funções não.
- Correção recomendada: em `clientIp`, ler primeiro `cf-connecting-ip`, depois `x-real-ip`, e só então o ÚLTIMO item de `x-forwarded-for` (nunca o primeiro). Teste unitário com os cabeçalhos forjados. Registrar na DECISOES.
- Critério de aceite: no staging, chamar `verificar-cadastro` 13 vezes com `X-Forwarded-For` diferente em cada chamada a partir da mesma máquina: a 13ª exige captcha e a 31ª devolve 429; as linhas de `auth_attempts` têm sempre o IP da borda.
- Dependências: nenhuma.
- Origem: D4-001 (D4)
- Revisão adversária: Cético: mantido (provável; staging sem logs para teste ao vivo). Dano principal: oráculo 'CPF já tem conta' em `verificar-cadastro`.

#### Área: bug

### AUD-007 — Link público da vaga e Ajuda quebram para quem não está logado (build de produção)

- Área: bug
- Severidade: S1 alto
- Esforço: P
- Confiança: confirmado
- Onde: `layouts/AppShell.tsx:93-94`; `App.tsx:176-184`; `routes.ts` (`isAuthFlow`, ~l.198-203; rotas `/v/:id`, `/ajuda`, `/completar-cadastro` com acesso `public`)
- Prova: `App.tsx` só pula o `AppShell` para rotas de `isAuthFlow`; `/v/…` e `/ajuda` não estão nessa lista. Para quem não é recrutador (visitante conta como "trabalhador"), `AppShell.tsx:93-94` faz `const worker = currentWorker(db); account = { name: worker.name … }`. Sem sessão, `currentWorker` lê `db.workers['jorge']`, id do seed de demonstração, que só existe no modo demo. Teste vitest isolado (`$SCRATCH/c3work/guest.test.tsx`, `IS_DEMO=false`): `role=trabalhador session=null worker=undefined -> Cannot read properties of undefined (reading 'name')`. Navegador: build real `$SCRATCH/dist-c2` (Supabase `x.supabase.co` interceptado, RPC `public_job_card` devolvendo uma vaga válida), visitante sem conta: `GET /v/k7m2q9x4tbn3` e `GET /ajuda` mostram "Essa tela não abriu — Algo deu errado do nosso lado…"; console `TypeError: Cannot read properties of undefined (reading 'name')`. Prints: `$SCRATCH/prints/C3/visitor-_v_k7m2q9x4tbn3.png` e `visitor-_ajuda.png`. Nenhum teste cobre isso: os unitários rodam em Node sem DOM (`vite.config.ts:166-167`) e nenhum `e2e/fluxos/*.spec.ts` abre `/v/` ou `/ajuda` sem sessão.
- Impacto: o link que a empresa manda no WhatsApp é a porta de entrada de novos trabalhadores e abre uma tela de erro para quem não tem conta. No modo demo funciona, por isso passou despercebido.
- Causa raiz: as telas públicas ficam dentro do casco do app logado, que assume que existe um perfil. O fallback "nunca undefined" de `selectors.ts` só vale no demo.
- Correção recomendada: em `Routes`, não usar `AppShell` quando `session === null` (ou pôr `/v/` e `/ajuda` em `isAuthFlow`); em `AppShell`, usar `worker?.name`; acrescentar e2e "visitante abre /v/<slug> e /ajuda" no modo real.
- Critério de aceite: build real com Supabase interceptado: `/v/<slug>` mostra título, valor e "Entrar para me candidatar"; `/ajuda` mostra as perguntas; sem erro no console.
- Dependências: nenhuma (relacionado a AUD-041 e AUD-204)
- Origem: C3-001 (C3)
- Revisão adversária: Cético: mantido e confirmado por leitura (`App.tsx:176-184`, `AppShell.tsx:93-94`).

## 4.3 S2 médio (48)

#### Área: segurança

### AUD-009 — Empresa sem verificação aprova todos e recebe o WhatsApp deles (coleta para golpe do falso emprego)

- Área: segurança
- Severidade: S2 médio — Ajustado na revisão adversária de S1 para S2: Cético: 'pendente publica normalmente' é decisão L10/Y24 e o WhatsApp após aprovação é o fluxo central; o que falta é teto de vagas/aprovações para conta não verificada. Rebaixado para S2.
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000700_u52_dias_e_local.sql:158` (`publish_job` só recusa `reprovada`; padrão da coluna `pendente`); `web/supabase/migrations/20261021000500_u48_publico_geral.sql:522` (`transition_application` aprovar) e `:207` (`get_contact`: basta `pre_selecionado`); `document_valid_for` aceita CPF para empresa
- Prova: empresa `pendente` publica por `publish_job`, aprova e `get_contact` devolve nome e telefone de 11 dígitos na hora; sem limite de aprovações/vagas (AUD-012).
- Impacto: um golpista publica vaga atraente, aprova quem se candidatar e junta números de telefone; o trabalhador não é consultado antes.
- Causa raiz: a verificação da empresa não é condição para liberar contato.
- Correção recomendada: só empresa verificada (ou conta com X dias + WhatsApp confirmado + sem denúncia) libera contato; teto diário de aprovações para contas novas; o trabalhador toca em "Compartilhar meu WhatsApp".
- Critério de aceite: empresa `pendente` → aprovar/`get_contact` falham.
- Dependências: ação do responsável (definir a regra)
- Origem: D2-002 (D2)

### AUD-010 — Selo "Verificada/Verificado" permanece depois de trocar o nome

- Área: segurança
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado
- Onde: grants `UPDATE(name)` em `companies` e `workers`; `web/supabase/migrations/20261011000500_y24_verificacao.sql:18` (`sync_company_verified` só olha `verification_status`); nenhum gatilho zera o selo
- Prova: empresa `verificada` faz `update companies set name='Banco Exemplo S.A.'` → `verified=true`; trabalhador `verificado` vira `Outro Nome Qualquer` → `verified=true`.
- Impacto: o selo (CNPJ conferido / selfie + documento) passa a atestar outro nome: dá para se passar por marca ou por outra pessoa.
- Causa raiz: o nome é editável direto e o selo não depende dele.
- Correção recomendada: gatilho BEFORE UPDATE OF name que volta `verification_status='pendente'` / `identity_status='nao_enviado'` quando `verified`.
- Critério de aceite: renomear empresa verificada → `verified=false`.
- Dependências: nenhuma
- Origem: D2-005 (D2)
- Revisão adversária: Cético: mantido e confirmado no staging (`UPDATE(name)` concedido; nenhum gatilho zera o selo).

### AUD-011 — Reputação fabricada em segundos com duas contas

- Área: segurança
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261010000100_z01_rpcs_candidatura.sql:33` (`job_started` = true sempre que `date_to_arrange`); `transition_application` `concluir`; `submit_review` (`…u48…sql:458`); `application_conclude` soma `jobs_done`
- Prova: empresa publica vaga "data a combinar"; trabalhador se candidata; aprovar → contratar → concluir na mesma transação; duas avaliações 5★ → trabalhador `jobs_done=1, rating 5.0`, empresa `5.0/1`.
- Impacto: quem controla duas contas (CPF e WhatsApp diferentes) fabrica diárias e notas máximas; o mural e os perfis usam isso como sinal de confiança.
- Causa raiz: `concluir` não exige que o dia combinado tenha chegado nem presença confirmada.
- Correção recomendada: `concluir` só depois do dia combinado (a combinar: data registrada ou ≥24 h após `contratado`); contar `jobs_done`/nota só com presença confirmada ou conclusão dos dois lados; alertar pares que só avaliam um ao outro.
- Critério de aceite: `concluir` logo após `contratar` em vaga "a combinar" → BC409.
- Dependências: AUD-009, AUD-012 (M1-H1 é outro assunto: conclusão automática em 32 dias)
- Origem: D2-006 (D2)
- Revisão adversária: Cético: mantido (`job_started` é verdadeiro para 'a combinar'; sem decisão sobre abuso com duas contas).

### AUD-012 — Nenhum limite de vagas por empresa; "urgente" grátis pela API

- Área: segurança
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000700_u52_dias_e_local.sql:158` (`publish_job` não conta) e `:31` (`job_from_draft` aceita `urgent`); `DECISOES.md` W08 não trata de quantidade
- Prova: 120 `publish_job` seguidos da mesma empresa `pendente`: 120 aceitas; vaga enviada com `urgent=true` sem pagar ficou `_rank=1` (normal `_rank=2`; impulsionada 0).
- Impacto: uma empresa cobre o mural da cidade (a ordem é por distância), gasta os 5 avisos/dia dos alertas e fura a fila sem pagar.
- Causa raiz: falta teto de vagas abertas/por dia; o campo `urgent` do payload é confiado.
- Correção recomendada: teto de abertas (ex.: 10 sem verificação) e por dia; ignorar `urgent` do payload.
- Critério de aceite: 11ª vaga aberta de empresa `pendente` → BC409; `urgent:true` não muda `_rank`.
- Dependências: o responsável define os tetos
- Origem: D2-007 (D2)
- Revisão adversária: Cético sugeriu S3 (urgente grátis é decisão, `DECISOES.md:439`; mitigado por ocultar/suspender). **Mantido S2**: é o mesmo vetor 'conta nova sem limites' e um spammer ocupa o mural inteiro de uma cidade do piloto.

### AUD-013 — "Empresa verificada" é concedida a qualquer pessoa que digite um CNPJ ativo qualquer

- Área: segurança
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (código e decisão documentada; a falha está na decisão)
- Onde: `web/supabase/functions/verificar-cnpj/index.ts:42-80`; `web/docs/DECISOES.md:771-783` (L10/Y24); `web/src/pages/shared/CompanyProfileScreen.tsx:140,288`, `web/src/pages/shared/PublicJob.tsx:157`
- Prova: a função pega o CNPJ que a própria conta digitou (`company_cnpj_for_check`), consulta a BrasilAPI e, se `descricao_situacao_cadastral === 'ATIVA'`, chama `set_company_verification(user.id, 'verificada')` (linhas 75-78). Nada liga quem se cadastrou àquele CNPJ: não compara o nome digitado com `razao_social`/`nome_fantasia` (a resposta é gravada em `cnpj_check` só para a fila da equipe, linhas 54-70), não compara telefone nem e-mail da Receita com os da conta, não exige código enviado ao contato do CNPJ. O nome exibido ao trabalhador é o digitado. CNPJs de empresas conhecidas são públicos, e U10 só impede repetir um CNPJ de conta já confirmada (o dono real fica sem conseguir cadastrar o seu).
- Impacto: um golpista cria a conta "Empresa X" com o CNPJ de uma empresa de verdade, recebe na hora o selo verde "Verificada" e o aviso "Empresa verificada", e publica bicos falsos (cobrar taxa, pedir documentos). O trabalhador de celular simples confia no selo.
- Causa raiz: a "verificação" confirma que o CNPJ existe, não que a pessoa é a empresa; a decisão aceitou isso para não segurar o mural (DECISOES:781).
- Correção recomendada: (a) no mínimo, trocar o texto do selo automático para "CNPJ ativo na Receita" e reservar "Verificada" para a conferência da equipe; (b) cruzar `razao_social`/`nome_fantasia` com o nome digitado e o `ddd_telefone_1`/e-mail da Receita com o WhatsApp/e-mail da conta, e só verificar automaticamente se bater; (c) alternativa mais forte: código de confirmação enviado ao telefone/e-mail que a Receita tem para o CNPJ.
- Critério de aceite: teste da função com BrasilAPI simulada devolvendo ATIVA para um CNPJ de outro nome → status continua `pendente` e a conta entra na fila `/admin`.
- Dependências: decisão do responsável sobre o significado do selo.
- Origem: D4-005 (D4)
- Revisão adversária: Cético: mantido (a decisão L10 é defeituosa: o selo afirma mais do que a checagem prova).

### AUD-020 — "Login CSRF": o app aceita `#access_token=…&refresh_token=…` de qualquer link e entra na conta de quem montou o link

- Área: segurança
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (leitura do código; o ataque não foi executado)
- Onde: `src/services/remote/session.ts:355-381` (chamada de `setSession` na linha 373); `src/services/supabase.ts:44` (`flowType: 'implicit'`, `detectSessionInUrl: false`)
- Prova: `handleAuthRedirect` lê o fragmento da URL e, se existirem `access_token` e `refresh_token`, chama `client.auth.setSession(...)`. Não há nenhuma prova de que o link foi pedido por este navegador (nonce, estado ou PKCE). O atacante cria uma conta própria, copia os dois tokens da sessão dele e envia `https://<site>/#access_token=A&refresh_token=R&type=signup` por WhatsApp. Ao abrir, a vítima passa a usar a conta do atacante sem aviso; o toast diz "E-mail confirmado. Bem-vindo à Bicos!".
- Impacto: quase todos os dados que a vítima digitar vão para a conta do atacante (endereço de casa, WhatsApp, candidaturas; selfie e documento ficam sob a conta do atacante numa pasta que a equipe vê). A vítima, um trabalhador de celular simples, não percebe que está em outra conta.
- Causa raiz: o fluxo implícito aceita tokens do fragmento sem vínculo com um pedido feito neste navegador.
- Correção recomendada: passar para `flowType: 'pkce'` e trocar o `code` do link (`exchangeCodeForSession`); ou, mais barato, guardar um marcador com validade (ex.: 1 h) em `localStorage` quando o app pede cadastro, "esqueci a senha" ou troca de e-mail, e só aceitar `setSession` do fragmento se o marcador existir; ao entrar por link, mostrar "Você entrou como <e-mail>".
- Critério de aceite: teste em que um fragmento com tokens válidos, sem marcador, é ignorado e leva a `/login`; o link legítimo de "Esqueci a senha" pedido neste aparelho continua funcionando.
- Dependências: nenhuma
- Origem: HUNT-003 (HUNTER)

### AUD-022 — Vaga oculta pela equipe e conta suspensa ainda aprovam, contratam e convidam

- Área: segurança
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido no staging, transação desfeita)
- Onde: `transition_application` (staging `pg_get_functiondef`; fonte `web/supabase/migrations/20261021000500_u48_publico_geral.sql`) — ramos `aprovar`/`contratar`/`recusar`/`concluir`: só conferem `v_job.company_id = my_company_id()`, `deleted_at`/`closed` e vagas livres; `invite_worker` (20261013000300_f13_convite.sql) usa `job_is_open` e `own_job_for_update`, que não olham `accounts.suspended_at`. Gatilhos de suspensão só existem em INSERT de `jobs` e de `applications` (`refuse_suspended_job`, `refuse_suspended_application`).
- Prova: transação com 3 contas de teste (DO + `raise exception` para desfazer tudo): (1) `update jobs set hidden_at = now()` (o que `admin_hide_job` faz) e, como a empresa, `transition_application(job, w2, 'aprovar')` → **PERMITIDO**, w2 ficou `pre_selecionado` (e `get_contact` abre o WhatsApp dos dois); (2) `update accounts set suspended_at = now()` na empresa (o que `admin_suspend_account` marca; o token ainda válido) e, como ela, `aprovar`, `contratar` e `invite_worker` → os três **PERMITIDOS**. `get_contact` com conta suspensa responde BC404 (R03), então o número não vaza, mas o estado muda e o trabalhador é avisado "Você foi pré-selecionado… O WhatsApp está liberado". `DECISOES.md` (L06, linha ~1259): ocultar vaga "sai do mural, do link público e das candidaturas novas; a dona e quem já se candidatou continuam vendo" — não diz que a dona segue decidindo candidatos.
- Impacto: uma vaga derrubada pela equipe por golpe/perigo ainda pode escolher e contratar quem já tinha se candidatado (e mandar a pessoa ir ao local); uma empresa recém-suspensa ainda age por até a vida do token de acesso (padrão 1 h).
- Causa raiz: a trava da ocultação/suspensão foi posta na entrada (publicar, candidatar), não nas decisões sobre candidaturas já existentes.
- Correção recomendada: em `transition_application` (ações `aprovar`, `contratar`, `desfazer_aprovacao`; e `undo_reject`) recusar com BC409 se `v_job.hidden_at is not null` ou a conta da empresa estiver suspensa; em `invite_worker` e `update_job` recusar se a conta estiver suspensa (a vaga oculta já é recusada por `job_is_open` no convite). Manter `recusar`, `cancelar_contratacao`, `desistir` liberados (sair do compromisso deve ser sempre possível). Escrever o teste SQL junto.
- Critério de aceite: teste SQL (novo, em `web/supabase/tests/`) que oculta a vaga/suspende a empresa e confirma BC409 em `aprovar`, `contratar`, `invite_worker`, sem quebrar `r03_suspensao_completa.sql`.
- Dependências: nenhuma.
- Origem: M1-001 (M1); também reportado por: D1-005
- Revisão adversária: Cético: mantido (no staging só `get_contact` menciona suspensão; a janela é a vida do token).
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D1-005 (S3): Conta suspensa continua gravando até o token de acesso vencer — onde: só estas funções consultam `suspended_at`: `refuse_suspended_application` e `refuse_suspended_job` (gatilhos de insert), `get_contact`, `account_history` e as `admin_*` (company_queue, suspend, unsuspend); `web/supabase/migrations/20261021000500_u48_publico_geral.sql:34-45` (a suspensão grava `auth.users.banned_until` e apaga `auth.sessions`)

### AUD-023 — O token da conta Supabase guardado no CI alcança a produção, e as mitigações do X30 não cobrem o ataque que importa

- Área: segurança
- Severidade: S2 médio
- Esforço: M
- Confiança: provável
- Onde: `.github/workflows/staging.yml:65,135` (SUPABASE_ACCESS_TOKEN); `.github/workflows/staging-fotos.yml:28`; `web/docs/DECISOES.md:2496-2501` (X30); `web/docs/STAGING.md:20`; `web/docs/CHECKLIST-LANCAMENTO.md:20`
- Prova: o token é "pessoal" (CHECKLIST:20). Staging e produção estão na MESMA organização: STAGING.md:20 diz `cdbmayszwthxqckwozjg` e `get_project` da produção devolve o mesmo `organization_id`. Logo o token enxerga os dois projetos (banco, segredos de função, Auth, chaves service_role). Mitigações do X30: (1) `::add-mask::` existe (staging.yml:165, staging-fotos.yml:39) mas só evita vazamento acidental; (2) staging-fotos é só `workflow_dispatch`, porém quem tem escrita pode editar o workflow numa branch nova (um `on: push` novo roda com os segredos); (3) "rotacionar periodicamente": `grep -rniE 'rotacion|rotate|rotaç'` em CHECKLIST, IMPLANTACAO, SUPABASE e STAGING = 0 ocorrências. Nenhum job usa `environment:` com revisor/restrição de branch; as 5 branches estão `protected:false`; repositório público com 2º colaborador com escrita. A trava `CONFIRMO_PRODUCAO` (configurar-auth.mjs:25, publicar-funcoes.sh:11) é checada pelo próprio script do repositório.
- Impacto: quem rodar código num workflow (conta comprometida ou colaborador) leva o token e controla também a produção.
- Causa raiz: um token de conta serve a dois projetos; o controle de uso é só convenção.
- Correção recomendada: (a) tirar o staging da organização da produção (usuário Supabase membro só de uma organização "staging" e token dele no CI); (b) `environment: staging` restrito à branch master, com os segredos nele; (c) item "rotacionar token" no checklist com dono e data.
- Critério de aceite: `GET https://api.supabase.com/v1/projects` com o token do CI não lista `ppnxdajiihsjaojxokzh`; branch nova com workflow que lê o segredo recebe vazio; rotação aparece no checklist com data.
- Dependências: ação do responsável. Revisa a decisão X30 (a decisão é que não fecha o risco).
- Origem: O1-001 (O1)
- Revisão adversária: Cético: mantido (workflow novo em outra branch roda com o segredo; rotação nunca executada; mesma organização).

### AUD-024 — O site de teste público (GitHub Pages) tem captcha de teste e manda e-mail de verdade pelo remetente da produção, sem aviso de "ambiente de teste" e sem noindex

- Área: segurança
- Severidade: S2 médio
- Esforço: P
- Confiança: provável (staging inacessível daqui; a cadeia está no repositório)
- Onde: `.github/workflows/site.yml:32-36,60`; `staging.yml:93-97,108,112-114`; `web/scripts/configurar-auth.mjs:46-57`; `web/scripts/staging/conferir-funcoes.sh:52`; `web/docs/STAGING.md:73`; `web/public/robots.txt`
- Prova: site.yml publica em `https://nivotechdev.github.io/Constru-o-Civil/` o app em modo REAL apontando ao staging (não é a demonstração; a trava site.yml:60 funciona) com a chave anon no JS e `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (teste, sempre passa). O staging recebe `TURNSTILE_SECRET` de teste (staging.yml:93-97,108): aceita qualquer token. conferir-funcoes.sh:52 exige cadastro aberto. configurar-auth.mjs:46-57: com `BREVO_SMTP_USER` envia pela Brevo com `SMTP_SENDER` ou, por padrão, `nao-responda@nivotech.com.br`, "o mesmo da produção" (STAGING.md:73). `robots.txt` = "Allow: /"; `grep` em `web/src` não acha faixa de ambiente de teste. Consulta read-only no staging: 13 contas, todas dos últimos 30 dias, 12 com @gmail.com.
- Impacto: qualquer pessoa/robô cadastra e-mails de terceiros no site de teste; os e-mails saem do domínio da Bicos (reputação do remetente da produção e cota diária da mesma conta Brevo). Quem achar o site no Google pode cadastrar CPF/WhatsApp reais num ambiente com texto legal em rascunho.
- Causa raiz: staging desenhado "igual à produção" ganhou um site público sem repensar captcha, remetente e identificação.
- Correção recomendada: remetente próprio do staging (ou sem SMTP); `<meta robots noindex>` e `Disallow: /` quando `VITE_SENTRY_ENVIRONMENT=staging`; faixa fixa "AMBIENTE DE TESTE — não use dados reais"; captcha real de staging ou lista de e-mails permitidos.
- Critério de aceite: o site mostra a faixa; `robots.txt` do Pages devolve `Disallow: /`; remetente do e-mail de cadastro no staging ≠ produção; token de captcha inválido é recusado no staging.
- Dependências: nenhuma (ação do responsável só para a chave Turnstile de staging)
- Origem: O1-002 (O1)
- Revisão adversária: Cético: mantido (cadeia lida no repositório; staging não acessível).

#### Área: bug

### AUD-026 — Campos numéricos da vaga apagam vírgula, ponto e sinal e mudam o valor sem avisar

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/CreateJob.tsx:66-68` (`digits()`), `:287` (valor), `:303` (diárias), `:375` (pessoas); limites em `jobForm.ts:78-80`
- Prova: em `/criar-vaga`, passo 2, `#create-job-valor`: digitar `45,50` fica `4550` (prévia "R$ 4.550 por diária") e é aceito; `50,00` vira `5000` (aceito, "R$ 5.000"); `150,50` vira `15050` e dá "Confira o valor: a diária vai até R$ 5.000" (o usuário nunca digitou 5.000); `150.00` vira `15000`. Em diárias: `1.5` vira `15`, `-1` vira `1`. Script `out/B2/f3b.cjs`; print `prints/B2/f3-passo2-m.png`.
- Impacto: quem cola ou digita "120,00" é barrado por uma mensagem que não bate com o que escreveu; quem digita "50,00" publica sem querer uma diária de R$ 5.000 (só a prévia mostra). Dinheiro errado numa vaga que trabalhadores vão ler.
- Causa raiz: o campo remove tudo que não é dígito (`replace(/\D/g, '')`) e não trata centavos nem avisa quando descarta algo.
- Correção recomendada: ao detectar `,` ou `.` seguido de 1–2 dígitos, ou arredondar para a parte inteira (150,50 -> 150) ou recusar com "Use só o valor em reais, sem centavos"; mostrar a prévia "R$ valor por diária" logo abaixo do campo; diárias/pessoas aceitarem só dígitos sem transformar `1.5` em 15.
- Critério de aceite: teste de unidade de `digits`/campo com `45,50`, `150.00`, `1.5`, `-1` e print do passo 2 com a mensagem nova.
- Dependências: nenhuma
- Origem: B2-001 (B2)
- Revisão adversária: Cético: mantido (`digits()` tira vírgula e ponto: '50,00' vira R$ 5.000).

### AUD-027 — Ação que deu certo no servidor aparece como erro quando a releitura seguinte falha; em "publicar vaga" o novo toque cria uma vaga repetida

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido com o falso Supabase do projeto)
- Onde: `web/src/services/remote/jobs.ts:25-31` (`publishJob`: RPC e depois `await loadJob(id)`), `:33-38` (`updateJob`); `web/src/services/remote/applications.ts:10-16` (`transition`, usada por aprovar/recusar/contratar/cancelar/concluir/falta/desistir/desfazer), `:24-34` (`submitApplication`, `withdrawApplication`), `:42-46`, `:54-58`; `web/src/services/remote/actions.ts:77-94` (`submitReview`), `:130-134` (`payWithCard`: `loadJob` depois da cobrança aprovada); `web/src/services/invites.ts:88-94` (`answerInvite`). Tela: `web/src/pages/recruiter/CreateJob.tsx:200-211` (o `catch` mostra `publishError` e reabilita o botão).
- Prova: `$SCRATCH/out/C1/repro/falha-parcial.test.ts` (rodar dentro de `web/`: `npx vitest run --config $SCRATCH/out/C1/repro/vitest.config.ts`). O RPC responde certo e, em seguida, as leituras caem (`TypeError: Failed to fetch`). Saída: `1st publish -> offline: Sem internet. Confira sua conexão e tente de novo. | 2nd publish -> ok BC-2 | publish_job RPC calls = 2` (duas vagas criadas) e `1st approve -> offline: Sem internet… | server status now = pre_selecionado | retry -> conflito: Essa candidatura mudou de situação. Atualize a tela e confira.` O `publish_job` do banco não tem trava de repetição (`20261021000700_u52_dias_e_local.sql:158-190`, só confere empresa/perfil/reprovada). Já existe o jeito certo no mesmo arquivo: `deleteJob` faz `await loadJob(jobId).catch(() => undefined)` (`remote/jobs.ts:51`), mas nenhuma das outras ações faz.
- Impacto: com internet ruim (o público do app), a empresa vê "Sem internet" depois de a vaga já estar no mural; toca em Publicar de novo e a vaga sai repetida (candidatos divididos, mural poluído). Nas decisões, a empresa vê erro numa aprovação que valeu e, ao tentar de novo, recebe "A candidatura mudou de situação", sem saber o que aconteceu. Na cobrança do cartão aprovada, a tela diz erro (o banco impede a segunda cobrança: `begin_boost_payment` recusa vaga já impulsionada, então não há cobrança dupla, só susto).
- Causa raiz: o "resultado" da ação e a "atualização da tela" são a mesma promessa; a releitura (`loadJob`: 4 a 7 chamadas) é tratada como parte da ação.
- Correção recomendada: separar os dois: depois do RPC, `await refresh().catch(() => markStale(jobId))` (ou só `catch` e um aviso discreto "Feito. Atualize a tela"), mantendo o erro do RPC como está. Em `publishJob` devolver o id mesmo se a releitura falhar (a tela de "vaga publicada" já recarrega a vaga). Opcional: chave de idempotência em `publish_job` (hash título+endereço+empresa em 2 min).
- Critério de aceite: o teste de reprodução passa a mostrar `1st publish -> ok BC-1` e `publish_job RPC calls = 1` quando só a releitura falha; um teste novo por função (`transition`, `submitApplication`, `submitReview`).
- Dependências: nenhuma. Relacionado (não repete): AUD-029 (respostas atrasadas) e AUD-130 (erro de rede em Edge Function).
- Origem: C1-001 (C1)
- Revisão adversária: Cético: mantido (`await loadJob` sem catch depois do RPC; `publish_job` sem trava de repetição).

### AUD-029 — Resposta que chega depois do "Sair" cai no store da conta seguinte (selo de notificações de outra conta, consulta marcada como pronta)

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido com o falso Supabase do projeto)
- Onde: web/src/services/queries.ts:52-80 e :104-110; web/src/services/remote/merge.ts:42-44 (`apply`); web/src/services/store.ts:150-153 (`clearSessionData`); web/src/services/remote/session.ts:338-347 (`leaveSession`) e :309 (`runQuery('notifications', …)`); mesmo padrão em todos os `load*` de remote/data.ts e nas ações de remote/profiles.ts (`session()` capturado antes do `await`)
- Prova: teste em `$SCRATCH/out/C2/repro-respostas-tardias.test.ts` (rodar com `npx vitest run --config …/repro-vitest.config.ts` dentro de `web/`): A entra (o login dispara `loadNotifications` em segundo plano, tabela lenta 80 ms), A sai logo em seguida. Saída: `AFTER LOGOUT: session= null notifications in store= 3 unreadTotal= 3 query state= ready`. Depois B (empresa, sem avisos) entra no mesmo aparelho: `B session= u-obra bell badge for B= 3 B notices listed= 0`. Ou seja, o número "3" do sino de B vem da conta A, e como `runQuery` acha a chave 'notifications' já "ready" (< 20 s, queries.ts:57) ela nem recarrega para B.
  - Prova 2 (pior caso, o próprio "Sair"): `repro-sair-durante-checagem.test.ts`. Quem volta ao app abre pela conta guardada no aparelho (`enterCachedSession`) e o servidor é conferido em segundo plano (`enterSession`, session.ts:523). Se a pessoa toca em "Sair" nesses poucos segundos, o `loadSession` em voo termina depois e faz `setSessionAccount(account.id)` (session.ts:304) e `saveCache` (:284/:302). Saída: `right after Sair: session= null cache= false` e `900 ms later: session= u-ana cache saved again= true`. A conta reaparece logada sem token do Auth, até uma requisição falhar e aparecer "Sua sessão terminou".
- Impacto: quem sai da conta com uma tela ainda carregando (comum em internet ruim) deixa dados no store; a próxima pessoa no mesmo aparelho vê contagem de avisos errada e pode ver outras fatias (vagas salvas `savedJobIds`, candidaturas) até a próxima leitura. As listas de avisos são filtradas pelo id da sessão, por isso o texto não vazou neste teste, mas o número vazou. O mesmo vale para o login que termina depois de o usuário já ter saído: `loadSession` regrava conta/perfil e o cache `bicos.conta` (session.ts:279-304) depois do `leaveSession`.
- Causa raiz: `clearQueries()`/`clearSessionData()` só zeram o estado; as requisições em voo não são canceladas nem têm "geração" para serem descartadas quando terminam. `apply()` não confere de qual sessão veio o resultado.
- Correção recomendada: um contador `sessionEpoch` incrementado em `leaveSession`/`setSessionAccount`; cada loader captura o valor antes do `await` e `apply`/`runQuery` descartam o resultado se mudou; `runQuery` guarda `inFlight` por geração e `.finally` não apaga a entrada de outra geração.
- Critério de aceite: o teste de reprodução passa a mostrar `notifications in store= 0` e `query state= loading` (ou ausente) após o logout, e `bell badge for B= 0`.
- Dependências: nenhuma.
- Origem: C2-005 (C2)
- Revisão adversária: Cético: mantido por leitura (`queries.ts`, `merge.ts` aplicam resposta sem checar a sessão); reprodução está no anexo do agente.

### AUD-031 — "Bicos fechados" (`/historico`) abre a aba "Abertas"

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/History.tsx:6` (passa `tab:'encerradas'`); `MyJobs.tsx:30-35,49-51` (só conhece `todas|abertas|cheias` e cai em `'abertas'`); `layouts/accountMenu.ts:22`; `RateWorker.tsx:22`
- Prova: a aba Encerradas do L07 (`DECISOES.md:763`) foi removida e a rota ficou; `RateWorker` manda para o mesmo lugar depois de avaliar.
- Impacto: a empresa que quer rever os bicos que já fez cai nos que estão abertos; depois de avaliar um trabalhador, não vê o resultado.
- Causa raiz: aba removida sem ajustar quem aponta para ela.
- Correção recomendada: `tab:'todas'`, ou recriar a aba filtrando por `jobOutcome`.
- Critério de aceite: `/historico` mostra as vagas encerradas.
- Dependências: nenhuma
- Origem: C4-002 (C4)
- Revisão adversária: Cético: mantido (contorno: tocar em 'Todas').

### AUD-032 — Pagamento do impulso: três estados sem tela (risco de cobrança em dobro no cartão em análise)

- Área: bug
- Severidade: S2 médio
- Esforço: M
- Confiança: provável
- Onde: `pages/recruiter/BoostPayment.tsx:188-242`; `services/remote/actions.ts` (`payWithCard`); `supabase/functions/criar-cobranca/index.ts` (fim); `webhook-pagamento`; `pages/recruiter/Payments.tsx:96-103`; `BoostPayment.tsx:63`
- Prova: (1) cartão que o Mercado Pago deixa em análise (`in_process`) fica `aguardando`, mas a tela desenha o formulário de novo; a empresa toca outra vez e é cobrada em dobro (os dois destaques somam em `confirm_boost_payment`). (2) PIX `recusado` ou `cancelado` cai em `PixWaiting` ("Aguardando… muda sozinha") com a leitura periódica já parada; só `expirado` é tratado. (3) `ui.paymentId` mora em memória; depois de recarregar, "Ver pagamento" mostra "Gerar código PIX" em vez do código já gerado.
- Impacto: cobrança duplicada, pagamento "aguardando" para sempre e código perdido ao recarregar: dinheiro e confiança.
- Causa raiz: a tela só conhece os estados feliz e `expirado`.
- Correção recomendada: tela "pagamento em análise" que esconde o formulário, "gerar novo código" para qualquer status que não vale mais, e `paymentId` vindo de `db.boostPayments`.
- Critério de aceite: teste de tela com status `in_process`, `recusado`, `cancelado` e recarga.
- Dependências: ligar `FEATURES.payments` é ação do responsável; corrigir antes
- Origem: C4-004 (C4)
- Revisão adversária: Cético: mantido; bloqueia a ligação do Mercado Pago, não o lançamento.

### AUD-034 — A CSP não tem `media-src`: vídeo do portfólio não toca nem aparece na prévia, e nenhuma etapa do CI exercita a CSP num navegador

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido no Chromium com o cabeçalho copiado de `_headers`)
- Onde: `web/public/_headers:8` (sem `media-src`; cai em `default-src 'self'`); consumidores: `web/src/pages/shared/PostViewer.tsx:74`, `web/src/pages/shared/WorkerPosts.tsx:130,240` (`<video src=…>`), `web/src/services/remote/storage.ts:20-22,68-89` (envia mp4/mov/webm ao bucket `portfolio`, até 50 MB); `web/src/__tests__/headers.test.ts` (confere só `connect-src`, `script-src`, `img-src`, `frame-src`)
- Prova: script `$SCRATCH/o1work/d4/csp-media.mjs` (e `csp-blob.mjs`): servidor local com o `Content-Security-Policy` lido de `_headers` e uma página com `<video src="https://abcdefgh.supabase.co/storage/v1/object/public/portfolio/u/x.mp4">` e um `<video>` com `blob:` criado por `URL.createObjectURL`. Saída do Chromium: `Loading media from 'https://abcdefgh.supabase.co/storage/v1/object/public/portfolio/u/x.mp4' violates the following Content Security Policy directive: "default-src 'self'". Note that 'media-src' was not explicitly set…` e o mesmo para `blob:http://127.0.0.1:…`. O teste do repositório não pega porque nunca lista `media-src`; o E2E e o site de teste (GitHub Pages, `site.yml`) não aplicam `_headers` (só o Cloudflare Pages lê o arquivo), então a CSP nunca rodou diante de um fluxo real.
- Impacto: na produção, o trabalhador que publica um vídeo no portfólio vê a prévia em branco e, depois de publicar, o vídeo não toca para ninguém. Como a CSP também nunca foi vista funcionando com Firebase (janela do Google, reCAPTCHA do SMS), Turnstile e o cartão do Mercado Pago, outras quebras no mesmo molde são possíveis no primeiro deploy real.
- Causa raiz: a lista de diretivas foi escrita à mão a partir dos endereços que o código chama; `<video>` carrega por `media-src`, que ninguém listou; o teste só cobre quatro diretivas.
- Correção recomendada: acrescentar `media-src 'self' blob: https://*.supabase.co`; estender o teste para `media-src` (e `font-src`, `worker-src`); passar a rodar um smoke de navegador (Playwright) contra uma build servida COM os cabeçalhos de `_headers` (um servidor de 15 linhas, como o do script) e falhar se houver `Refused to …`/violação de CSP no console em login, mural, vaga, portfólio, Google e cartão.
- Critério de aceite: `csp-media.mjs` sem nenhuma linha "violates"; o smoke no CI passa sem violação nas telas listadas.
- Dependências: nenhuma.
- Origem: D4-004 (D4)
- Revisão adversária: Cético: mantido por leitura (`_headers:8` sem `media-src`); o D4 reproduziu o bloqueio no Chromium.

### AUD-035 — Com o relógio do celular errado, o app dobra cada consulta ou desloga a pessoa uma vez por hora

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado com o `supabase-js 2.117.2` do projeto e servidor falso; provável no app real
- Onde: `src/services/supabase.ts:44` (`autoRefreshToken:true` sem compensação); `src/services/remote/client.ts:62-72` (`/JWT expired/` leva a `onSessionEnded`); `src/services/remote/session.ts:454-467`
- Prova: `skew.mjs`, relógio adiantado, token de 1 h: +0 h → 0 renovações em 10 consultas; +2 h → 10 renovações; +24 h → 10 renovações. `skew2.mjs`, relógio atrasado, 3 h depois do login: 0 h e −1 h: `REFRESH → DATA 200`; −2,5 h e −5 h: `DATA 401 JWT expired` (`PGRST301`), sem renovar. No app, esse código chama `sessionEnded()`, que faz `signOut` e vai para `/login` com "Sua sessão terminou".
- Impacto: celular com hora errada, com hora automática desligada, bateria zerada ou chip em outro fuso. Adiantado: cada tela espera um pedido extra de renovação. Atrasado: a pessoa é deslogada depois de ~1 h de uso, em loop, sem saber a causa.
- Causa raiz: o `supabase-js` decide "venceu?" com o relógio do aparelho. O app não tenta renovar uma vez antes de encerrar a sessão.
- Correção recomendada: em `request()`, ao receber `PGRST301`/`JWT expired`, chamar `auth.refreshSession()` e repetir uma vez; só depois `onSessionEnded()`. Opcional: comparar o cabeçalho `Date` com `Date.now()` e avisar "O relógio do seu celular está errado".
- Critério de aceite: `skew2.mjs` com −5 mostra `401 → REFRESH → 200` (teste Vitest com o Supabase falso e relógio deslocado).
- Dependências: nenhuma
- Origem: Q1-002 (Q1)
- Revisão adversária: Cético: mantido por leitura; reprodução com `supabase-js` 2.117.2 está nos anexos do Q1.

### AUD-037 — Captcha sem tratar `timeout-callback`/`unsupported-callback` do Turnstile: "Entrar" gira até recarregar

- Área: bug
- Severidade: S2 médio
- Esforço: P
- Confiança: provável
- Onde: `components/Captcha.tsx:59-67,82-91`; `pages/shared/Login.tsx:183`
- Prova: `getToken()` pode nunca resolver; o botão fica girando.
- Impacto: quando o Turnstile for ligado, uma falha dele trava o login (spinner eterno).
- Causa raiz: callbacks de falha ausentes.
- Correção recomendada: tratar os dois callbacks e rejeitar `getToken()` com erro amigável e prazo.
- Critério de aceite: teste com o widget simulando timeout mostra erro e libera o botão.
- Dependências: ação do responsável (ligar Turnstile) torna o problema real
- Origem: C5-004 (C5)
- Revisão adversária: Cético: mantido (sem `timeout-callback`/`unsupported-callback`; captcha é obrigatório na produção).

### AUD-038 — Pagamento aprovado que não pode ser aplicado, ou que falha no webhook, não avisa ninguém da equipe

- Área: bug
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (código e catálogo)
- Onde: `web/supabase/functions/webhook-pagamento/index.ts:43-46,55-62`; RPC `confirm_boost_payment` (staging: ramo `reembolso_pendente`); `web/docs/DECISOES.md:312-314`; `web/supabase/functions/criar-cobranca/index.ts:91-99`
- Prova: no webhook, `const { error } = await admin.rpc('confirm_boost_payment', …); result = error ? \`erro:${error.message}\` : 'confirmado'` e a função responde 200 (`json({ ok: true, result })`, linha 62). O Mercado Pago só reenvia em resposta não-2xx, então o aviso de um PIX pago que falhou (banco fora do ar, vaga apagada, erro de transação) nunca é reprocessado; a linha de `payment_webhook_events`fica para sempre com`result = 'erro:…'` e a deduplicação (`23505`, linha 36) bloqueia qualquer reenvio manual. Não há `reportError`/Sentry nesse ramo. Quando a vaga já fechou, `confirm_boost_payment`grava`status = 'reembolso_pendente'`e só notifica a empresa ("Vamos devolver o valor"); nenhuma RPC`admin_*`nem tela de`/admin`lê`boost_payments` (`grep boost_payments`nas migrations não encontra o back-office), e a devolução é "pelo painel do Mercado Pago" (DECISOES:312-314), sem fila nem alerta para os sócios. Em`criar-cobranca`o resultado de`attach_boost_charge`(linha 91) e de`confirm_boost_payment`(linha 99) também é ignorado. Pagamentos`refunded`/`charged_back`caem em`result = mp.status` (linha 53): o destaque continua ligado.
- Impacto: uma empresa que pagou o PIX pode ficar sem o destaque e sem devolução, e ninguém saberá até ela reclamar; os sócios não têm lista de "devolver".
- Causa raiz: o fluxo foi desenhado para o caminho feliz; o "reembolso manual" ficou sem fila e a falha do webhook é registrada só na própria tabela.
- Correção recomendada: (1) webhook: em erro de `confirm_boost_payment` chamar `reportError` e responder 500 apagando a linha de dedupe (o MP reenvia); (2) card em `/admin` (ou alerta no Sentry/e-mail) para `boost_payments.status = 'reembolso_pendente'` e para `payment_webhook_events.result like 'erro:%'`; (3) tratar `refunded`/`charged_back` encerrando o destaque; (4) verificar o `error` de `attach_boost_charge`.
- Critério de aceite: teste da função com `confirm_boost_payment` forçado a falhar devolve 5xx e não deixa a linha de dedupe; um pagamento em `reembolso_pendente` aparece na fila da equipe e gera alerta em até 1 hora.
- Dependências: Mercado Pago ligado é "ação do responsável"; o conserto pode ir antes.
- Origem: D4-003 (D4); também reportado por: HUNT-002
- Revisão adversária: Cético: mantido; bloqueia a ligação de pagamentos.
- Ocorrências adicionais (mesmo problema, outros lugares):
  - HUNT-002 (S2): O webhook de pagamento responde 200 mesmo quando aplicar o pagamento falha: o Mercado Pago não reenvia e o PIX pago vira "expirado" (aspecto novo de AUD-038) — onde: `supabase/functions/webhook-pagamento/index.ts:30-33,44-45,57-58`; `supabase/functions/criar-cobranca/index.ts:91-99`; cron `bicos-vencer-pix` → `expire_pix_payments()`

#### Área: LGPD

### AUD-008 — Vídeos do portfólio sobem sem remover metadados (GPS do aparelho) para um bucket público

- Área: LGPD
- Severidade: S2 médio
- Esforço: M
- Confiança: provável (código provado; não testei um vídeo real com GPS)
- Onde: web/src/services/remote/storage.ts:76-86 e :91-102; web/src/pages/shared/WorkerPosts.tsx:221 (`accept="image/*,video/*"`); web/src/utils/image.ts:34-60; migration 20261010000700_z12_fotos.sql:103-104 (bucket `portfolio` aceita mp4/quicktime/webm, público)
- Prova: em `uploadMedia` o bloco de compressão roda só `if (!isVideo)`; para vídeo o `blob` original vai direto ao `xhr.send(blob)`. Celulares gravam a localização no contêiner do vídeo (iPhone: `com.apple.quicktime.location.ISO6709`; Android: átomo `©xyz`) quando a câmera tem localização ligada. A URL pública (`getPublicUrl`) é mostrada no perfil. Nas fotos o EXIF cai porque `compressImage` redesenha no canvas, mas veja C2-003.
- Impacto: um vídeo de trabalho feito em casa ou no local de um cliente pode entregar a posição exata a qualquer pessoa com o link, contra a política ("Localização do aparelho: só se você tocar em Usar minha localização").
- Causa raiz: a limpeza de metadados só existe para imagem.
- Correção recomendada: desligar vídeo no lançamento (só foto) ou remuxar/limpar no servidor (função que reescreve o mp4 sem os átomos `udta/©xyz/meta`); alternativa mínima: aviso na tela "vídeos podem levar a localização de onde foram gravados".
- Critério de aceite: subir um .mp4/.mov de teste com átomo de GPS e conferir (`exiftool`/`ffprobe`) que o arquivo publicado não tem coordenadas.
- Dependências: nenhuma.
- Origem: C2-002 (C2); também reportado por: C2-003
- Revisão adversária: Cético: mantido (vídeo sobe sem recompressão para bucket público; GPS real não testado).
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C2-003 (S3): `compressImage` devolve o arquivo original (com EXIF/GPS) quando o reencode não fica menor ou a imagem não decodifica — onde: web/src/utils/image.ts:40-60 (`return out.size < blob.size ? out : blob`, `catch { return blob }`, `blob.type === 'image/gif'`); web/src/services/remote/storage.ts:78-84

### AUD-014 — O mapa envia a casa do trabalhador (coordenada de rua, 6 casas) e o IP a servidores públicos de terceiros (OSRM e OpenStreetMap), coisa que a Política nega e não lista

- Área: LGPD
- Severidade: S2 médio — Ajustado na revisão adversária de S1 para S2: Cético: U54 admite que a casa salva vai ao OSRM; a falha é de transparência (`legal.ts:119,147`). Rebaixado para S2 (correção por texto ou tirando a rota).
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/components/JobMap.tsx:47-55` (`origin = home`, `drivingRoute(origin, job…)`), `web/src/pages/worker/JobDetail.tsx:274` (`home={role === 'trabalhador' ? workerHome(db) : null}`), `web/src/services/selectors.ts:33-40` (`workerHome` usa primeiro a linha de `addresses`, 6 casas), `web/src/services/route.ts:10-11,41-43` (`router.project-osrm.org`, `routing.openstreetmap.de`), `web/public/_headers` (CSP libera `tile.openstreetmap.org`, `router.project-osrm.org`, `routing.openstreetmap.de`), `web/supabase/migrations/20261021000600_u51_endereco.sql` (`addresses.lat/lon` com 6 casas, `save_address`), `web/src/services/legal.ts:119,147`
- Prova: ao abrir o detalhe de uma vaga, o navegador do trabalhador faz `GET https://router.project-osrm.org/route/v1/driving/<lon_casa>,<lat_casa>;<lon_vaga>,<lat_vaga>` (o comentário do U54 diz "só duas coordenadas, sem nome nem conta", mas o ponto de origem é o endereço salvo da pessoa, rotulado "da sua casa" na tela, e a requisição leva o IP do aparelho). A Política (seção 2, linha 119) diz do endereço: "Fica só com você: no perfil aparece só a cidade, e as empresas veem só um ponto aproximado"; e (seção 5, linha 147) só cita OpenStreetMap "Nominatim e Photon" para achar endereço. Não cita os mapas (`tile.openstreetmap.org`, que recebe o IP e a região vista) nem o cálculo de rota (OSRM público, mantido na Alemanha pela comunidade OSM/FOSSGIS).
- Impacto: a cada vaga aberta, a localização da casa de cada trabalhador e o IP dele chegam a operadores que a pessoa nunca foi avisada que existem. Para quem confia no "fica só com você", é quebra de transparência (art. 6, VI; art. 9, art. 7).
- Causa raiz: serviços gratuitos de mapa/rota chamados direto do navegador; a Política foi escrita a partir de `docs/LGPD.md`, que não tem tiles nem rota.
- Correção recomendada: (a) declarar na Política os provedores de mapa e de rota, com a finalidade e o dado enviado (coordenada de origem e destino, IP), e a base legal; (b) reduzir o dado: arredondar a origem para 2 casas (≈1 km) antes de chamar a rota, ou calcular a rota por uma função própria no servidor (sem IP do usuário), ou só mostrar a linha reta; (c) considerar mapa próprio/pago com contrato (OSRM público é "demo" e sem garantia).
- Critério de aceite: teste de `route.ts` mostrando que a coordenada enviada tem no máximo 2 casas decimais (ou que a chamada sai pelo servidor); Política lista tiles e rota; `headers.test.ts` continua verde.
- Dependências: decisão do produto (ação do responsável) sobre o provedor de rota/mapa.
- Origem: D5-003 (D5); também reportado por: C2-001
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C2-001 (S2): A casa do trabalhador (coordenadas do endereço) vai para servidores OSRM de terceiros, e a política de privacidade não diz isso — onde: web/src/services/route.ts:9-49; web/src/pages/worker/JobDetail.tsx:271-275 (`home={workerHome(db)}`); web/src/components/JobMap.tsx:44-54; web/src/services/legal.ts:119 e :147; web/public/_headers (connect-src)

### AUD-015 — Não existe guarda dos registros de acesso por 6 meses (Marco Civil, art. 15); a Política deixa o prazo em branco

- Área: LGPD
- Severidade: S2 médio — Ajustado na revisão adversária de S1 para S2: Cético: pendência já registrada (`LGPD.md:66-68`; checklist pede ao advogado); é Marco Civil, não LGPD. Rebaixado para S2.
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:157` (`{{PRAZO_REGISTROS_ACESSO}}`), `web/docs/LGPD.md:35,66-68` (achado 4), `web/supabase/migrations/20261014000700_x22_limpeza_tentativas.sql` e `20261016000200_lanc10_link_publico.sql:93` (`purge_auth_attempts`: apaga `auth_attempts` com 1 dia)
- Prova: o único registro próprio de IP é `auth_attempts` (chave com IP, 1 dia) e `public_link_hits` (hash do IP, 1 dia). O Supabase Free guarda os logs por cerca de 1 dia (LGPD.md:35, 66). Não há tabela, dreno de logs ou rotina que preserve IP + data/hora + porta de cada acesso por 6 meses. O texto da Política cita o Marco Civil art. 15 como fundamento ("Para cumprir a lei (art. 7º, II): registros … de acesso") sem que exista o registro.
- Impacto: a empresa afirma que guarda e não guarda: descumpre o dever legal de provedor de aplicações (se a NivoTech se enquadra: pessoa jurídica, atividade econômica organizada) e não consegue atender uma ordem judicial pedindo o IP de quem publicou algo.
- Causa raiz: decisão adiada para o advogado/sócios (LGPD.md achado 4); o produto não tem tabela de logs.
- Correção recomendada: decidir com o advogado se o art. 15 se aplica; se sim, gravar o login/ações relevantes (IP, data e hora, versão do app) numa tabela própria com retenção de 6 meses e acesso restrito (ou plano com dreno de logs), declarar o prazo na Política; se não, tirar a promessa do texto.
- Critério de aceite: Política com o prazo preenchido e coerente com o que o banco guarda; consulta mostrando registros com 6 meses de idade e expurgo depois.
- Dependências: ação do responsável (advogado e plano de hospedagem).
- Origem: D5-004 (D5)

### AUD-016 — Política e Termos publicados com 10 campos em branco (controlador, encarregado, prazos, base da transferência) e sem revisão jurídica; o build de produção barra, mas o conteúdo exigido pela LGPD não existe ainda

- Área: LGPD
- Severidade: S2 médio — Ajustado na revisão adversária de S1 para S2: Cético: a trava de build é o mecanismo pretendido e os campos estão no checklist. Ajustado para S2: continua bloqueador de lançamento e está visível no site de teste.
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:22` (`LEGAL_REVIEWED = false`), campos `{{RAZAO_SOCIAL}}` `{{CNPJ}}` `{{ENDERECO}}` `{{DPO_NOME}}` `{{DPO_EMAIL}}` (3 usos) `{{CIDADE_FORO}}` `{{PRAZO_PAGAMENTOS}}` `{{PRAZO_REGISTROS_ACESSO}}` `{{PRAZO_AUDITORIA}}` `{{BASE_TRANSFERENCIA_INTERNACIONAL}}`; `web/build/env.ts:99-122`; `web/vite.config.ts:42-45`; `web/docs/CHECKLIST-LANCAMENTO.md:46,139-140`
- Prova: `legalProblems()` junta os `{{…}}` encontrados nos textos e os registra como erro **não escapável** em modo `production`; a variável `BICOS_PILOTO_SEM_REVISAO_JURIDICA=1` só dispensa a falta de revisão, nunca os campos em branco (`escapable: false`, `web/build/env.ts:105`). O CI tem passo que exige a falha (`.github/workflows/web.yml:58-70`). Então o piloto fechado também **não sobe** enquanto os 10 campos distintos não forem preenchidos. Está certo como trava; o achado é o que falta no conteúdo: sem controlador, encarregado e canal (art. 9, I e art. 41 §1), sem prazo de guarda (art. 9, II) e sem base da transferência internacional (art. 33) o texto não cumpre a LGPD, e o aviso "Rascunho para revisão jurídica" aparece nos builds de teste.
- Impacto: nenhum usuário real pode ser aceito legalmente antes disso; o site de teste (GitHub Pages, que usa `npm run build:staging`, `.github/workflows/site.yml:58`) mostra os campos `{{...}}` crus a quem abrir a Política.
- Causa raiz: faltam decisões e dados da empresa (razão social, CNPJ, encarregado, prazos fiscais) e o parecer do advogado.
- Correção recomendada: o responsável envia os 10 dados; o advogado revisa; só então `LEGAL_REVIEWED = true` e `LEGAL_WRITE=1 npx vitest run legal`. Enquanto isso, o site de teste deve avisar que não é para dados reais. Lista de prazos sugeridos para decidir: pagamentos (fiscal, 5 anos, ver AUD-069), registros de acesso (6 meses, AUD-015), auditoria da equipe (AUD-070).
- Critério de aceite: `grep -c "{{" web/src/services/legal.ts` = 0; build de produção passa; advogado assinou.
- Dependências: ação do responsável (dados da empresa, advogado). AUD-015, AUD-069, AUD-070, AUD-074.
- Origem: D5-005 (D5); também reportado por: B1-003
- Ocorrências adicionais (mesmo problema, outros lugares):
  - B1-003 (S3): `/privacidade` estoura a largura em 360 px; marcadores `{{…}}` aparecem ao público — onde: `pages/shared/LegalScreen.tsx`; `services/legal.ts:148` (`{{BASE_TRANSFERENCIA_INTERNACIONAL}}` não quebra linha)

### AUD-017 — Firebase/Google (login por Google e por celular) não é citado como operador e o usuário nunca é apagado de lá; reCAPTCHA, Turnstile e SDK do Mercado Pago contradizem "sem rastreadores de terceiros"

- Área: LGPD
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (código); retenção do lado do Google não verificável daqui
- Onde: `web/src/services/legal.ts:147` (operadores: "Google (login, se você escolher; EUA)" e "Twilio (código por WhatsApp ou SMS)"), `legal.ts:177` ("Não usamos cookies de publicidade nem rastreadores de terceiros"), `web/supabase/functions/entrar-com-firebase/index.ts`, `web/supabase/functions/excluir-conta/index.ts` (nenhuma chamada ao Firebase), `web/src/services/remote/firebase.ts:162,198` (só `signOut` local), `web/public/_headers` (CSP libera `apis.google.com`, `www.google.com`, `www.gstatic.com`, `recaptcha.google.com`, `identitytoolkit.googleapis.com`, `sdk.mercadopago.com`, `http2.mlstatic.com`, `challenges.cloudflare.com`), `web/src/components/Captcha.tsx`, `web/src/components/MercadoPagoCardForm.tsx`
- Prova: `grep -rniE "deleteUser|accounts:delete" web/supabase/functions web/src` não encontra nada: ao excluir a conta da Bicos, o registro da pessoa no projeto Firebase `bicoapp-6cc68` (e-mail, nome e foto do Google; ou telefone, no login por SMS) continua lá. `grep -i firebase` em `legal.ts` e em `docs/LGPD.md` = vazio: a Política só fala em "Google (login)", e o código do SMS do login por celular (U28) sai pelo Firebase/Google, não pelo Twilio que a Política cita para "código por WhatsApp ou SMS". O reCAPTCHA invisível do login por celular, o Turnstile (cadastro/login) e o SDK do Mercado Pago (tela de pagamento com cartão) carregam scripts de terceiros que gravam identificadores no aparelho; a seção 9 afirma o contrário em termos absolutos.
- Impacto: a pessoa exclui a conta "por completo" e o telefone/e-mail dela ficam num serviço do Google que a Política não descreve; e o aviso de privacidade diz que não há terceiros de rastreio quando há.
- Causa raiz: o U28 (Firebase) entrou depois da Política 2.0 e nunca foi refletido nela; a exclusão foi desenhada só para Supabase.
- Correção recomendada: (1) incluir Firebase Authentication/Google (finalidade, dado, país) e reCAPTCHA na lista de operadores; trocar o texto da seção 9 por "só usamos o necessário para o funcionamento e a segurança (captcha, pagamento), sem publicidade"; (2) na `excluir-conta`, chamar a API Admin do Identity Toolkit (`accounts:delete`) para o uid do Firebase (localizável pelo e-mail/telefone; ou guardar o `uid` em `accounts`) com conta de serviço, ou usar a opção de apagar usuários do console e documentar o prazo; (3) conferir no console do Firebase que Analytics está desligado.
- Critério de aceite: Política cita Firebase e reCAPTCHA; teste de `excluir-conta` com fake do Firebase mostrando a chamada de exclusão; staging: criar usuário Google/celular de teste, excluir a conta e ver o usuário sumir do Firebase.
- Dependências: ação do responsável (credencial de serviço do Firebase; revisão do advogado). AUD-074.
- Origem: D5-006 (D5)
- Revisão adversária: Cético: mantido (`legal.ts` não cita Firebase/reCAPTCHA; sem `deleteUser` no Firebase).

### AUD-018 — "Exportar meus dados" não traz tudo o que a Bicos guarda sobre a pessoa, mas a tela e a Política dizem que traz

- Área: LGPD
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000600_u51_endereco.sql:205` (versão atual de `export_my_data`), `web/src/pages/shared/Privacy.tsx` ("baixar uma cópia de tudo o que a Bicos guarda sobre você"), `web/src/services/legal.ts:163`
- Prova: a função (lida em `pg_get_functiondef` no staging) devolve conta (sem `whatsapp_verified_at`, `suspended_at`), endereço, perfil, vagas, candidaturas com histórico, avaliações (as duas direções), vagas salvas, portfólio, notificações, pagamentos (sem `pix_code`), aceites e metadados da verificação de identidade. **Não** traz: `blocks` (quem a pessoa bloqueou), `reports` (denúncias que ela fez), `job_alerts` (alerta de vaga, com coordenadas e raio), `job_invites`, `push_subscriptions` (endpoint e `user_agent` do aparelho), `notification_prefs`, `account_prefs` (tema), `company_members`, `application_attempts`, o motivo de suspensão (`accounts.suspended_reason`), as decisões da equipe sobre ela (`staff_actions`) e as próprias fotos da selfie/documento (só datas). Dois nomes enganam: a chave `avaliacoes_recebidas` também traz as avaliações que a pessoa escreveu. Na produção a função ainda é a versão anterior (sem aceites, sem endereço).
- Impacto: a pessoa recebe um arquivo que parece completo e não é; descumpre o art. 18, II (acesso) e o art. 19, §3º, e a tela afirma o contrário.
- Causa raiz: a função foi montada tabela a tabela e cada tabela nova (U51 `addresses`, `job_alerts`, `blocks`, tema) não entrou; não há teste que compare as tabelas com `account_id`/`worker_id`/`company_id` com o que a exportação cobre.
- Correção recomendada: incluir as tabelas que faltam (sem expor dado de terceiros: de `blocks` só o id e a data; de `reports` só as que a pessoa fez); renomear `avaliacoes_recebidas` para `avaliacoes`; trocar o texto da tela para "seus dados" se algo ficar de fora de propósito (ex.: denúncias contra você) e dizer o motivo; teste SQL que percorre `information_schema` (colunas `worker_id`, `company_id`, `account_id`, `user_id`, `reporter_id`, `blocker_id`) e falha se uma tabela nova não estiver coberta ou numa lista de exceções.
- Critério de aceite: teste SQL novo `export_cobre_todas_as_tabelas` verde; o JSON de uma conta de teste tem as chaves novas.
- Dependências: nenhuma.
- Origem: D5-007 (D5); também reportado por: C3-013
- Revisão adversária: Cético: mantido (`export_my_data` não traz `job_alerts`, `blocks`, `push_subscriptions` etc.).
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C3-013 (S3): Exportar dados: depois de exportar, o botão some — onde: `pages/shared/Privacy.tsx:40-60`

### AUD-019 — O "hash do documento" é SHA-256 sem segredo: com um vazamento do banco ou de backup, os CPFs saem em minutos (e a máscara mostra 6 dos 9 dígitos); a Política diz "CPF e CNPJ ficam cifrados"

- Área: LGPD
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (código); a reversão em si é cálculo, não foi executada
- Onde: `web/supabase/migrations/20261009000200_bicos_v2_rules.sql:140` (`document_hash` = `digest(digits, 'sha256')`, `IMMUTABLE`, sem sal nem chave), `mask_document` (CPF `***.NNN.NNN-**`), `web/supabase/functions/entrar-com-documento/index.ts:45` (`'doc:' + sha256Hex(documento)` gravado em `auth_attempts.key`), `verificar-cadastro/index.ts:67`, `web/src/services/legal.ts:114,170`
- Prova: `select pg_get_functiondef('public.document_hash'::regproc)` no staging mostra `encode(extensions.digest(regexp_replace(...), 'sha256'), 'hex')`. Um CPF tem 9 dígitos livres (≈10^9 combinações) — uma placa de vídeo comum calcula isso em segundos. Quem tem a coluna `accounts.document_hash` (dono do banco, service_role, cópia de segurança, `pg_dump`) recupera todos os CPFs sem precisar da chave do Vault, o que anula a cifra de `document_cipher`. A coluna `accounts.document` guarda `***.123.456-**`, ou seja, 6 dígitos em claro, e reduz a busca a ~1000 tentativas por conta. Os grants por coluna impedem o `select` do app (conferido: `document_hash` e `document_cipher` não estão nos grants de `authenticated`), então o risco é de vazamento do banco/backup/service_role, não de IDOR.
- Impacto: a promessa "CPF e CNPJ ficam cifrados" vale só para quem não olha o hash; um incidente com o banco expõe todos os CPFs dos trabalhadores.
- Causa raiz: o hash foi desenhado só para busca (login por documento), sem pensar em força bruta sobre um espaço pequeno.
- Correção recomendada: trocar por HMAC-SHA256 com uma chave do Vault (`nivotech_documento_pepper`, diferente da de cifra), recalculando os hashes a partir de `document_cipher` numa migration; usar o mesmo HMAC nas chaves de limite (`doc:`); reduzir a máscara do CPF para os 2 últimos dígitos ou nenhum. Alternativa: manter o SHA-256 e declarar o risco ao advogado.
- Critério de aceite: teste SQL mostrando que `document_hash('123.456.789-09')` muda com a chave e que o login por documento continua funcionando; `accounts.document` sem 6 dígitos.
- Dependências: migração em produção só com "pode" (ação do responsável).
- Origem: D5-008 (D5)
- Revisão adversária: Cético: mantido (SHA-256 sem sal; só vira exposição com vazamento de banco/backup).

### AUD-021 — Qualquer conta logada lê todos os trabalhadores (nome, bairro, coordenada, foto, bio, experiências) com uma consulta só

- Área: LGPD
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `supabase/migrations/20261009000200_bicos_v2_rules.sql:37` (política `using (true)` em `workers`); GRANT de SELECT por coluna em `workers`; `src/services/remote/merge.ts:24` (`WORKER_COLUMNS`)
- Prova: no staging, simulei uma conta de empresa (`set local role authenticated` com `sub` de uma conta `recrutador`). Resultado: `workers visiveis=231/231 companies visiveis=34/34`. As colunas legíveis de `workers` incluem `name, city, neighborhood, lat, lon, photo_url, cover_url, bio, experiences, facts, identity_status, jobs_done, rating`. Basta `GET /rest/v1/workers?select=…` com paginação.
- Impacto: cadastrar uma "empresa" é grátis e sem prova de posse (AUD-013, AUD-009). Quem cadastra consegue baixar a lista inteira de trabalhadores com nome, bairro (coordenada de ≈1 km) e foto: contra minimização da LGPD, e as pessoas são vulneráveis a golpe de falso emprego.
- Causa raiz: leitura pública para quem está logado, sem vínculo entre as partes.
- Correção recomendada: trocar a política: o próprio trabalhador, e empresas só quando houver vínculo (candidatura, convite, avaliação); o perfil público passa por uma RPC `get_worker_profile(id)` que confere o vínculo e devolve só os campos necessários, sem coordenada; revisar a rota `/trabalhador/:id` e o fluxo de convidar.
- Critério de aceite: teste SQL em que uma empresa sem vínculo vê 0 trabalhadores e a empresa com candidatura vê só o candidato.
- Dependências: decisão dos sócios (perfil visível a quem está logado é uma regra de produto: "os dois lados veem o perfil do outro")
- Origem: HUNT-004 (HUNTER)

#### Área: produto

### AUD-033 — "Voltar para a vaga depois de entrar" só vale no login com e-mail e senha; Google, SMS e cadastro novo caem no mural

- Área: produto
- Severidade: S2 médio
- Esforço: M
- Confiança: provável (código; não reproduzido ponta a ponta)
- Onde: `pages/shared/PublicJob.tsx:57-60,105` (grava `RETURN_TO_KEY` também para "Criar minha conta"); `pages/shared/Login.tsx:93-104` (único leitor) e `:247`; `services/guards.ts:26` (`guest` → `homeFor` = `/mural`); `pages/shared/CompleteProfile.tsx:122` (`navigate('/mural')`); `services/store.ts:140-145` (`setSessionAccount` zera `ui` ao trocar de conta)
- Prova: `grep -rn RETURN_TO_KEY web/src` → um consumidor. Cadastro: `/verificar-email` → `/completar-perfil` → `/mural`; Google/SMS entram por rotas `guest`, o guarda manda a `/mural`; a chave ainda seria apagada ao iniciar sessão.
- Impacto: quem recebeu o link de uma vaga, cria conta (ou entra pelo Google) e chega ao mural sem a vaga que o trouxe: perde-se a entrada que a empresa divulga.
- Causa raiz: destino guardado em estado de tela em memória, lido por uma só tela.
- Correção recomendada: guardar o destino (validado como rota do app) em `sessionStorage` e consumi-lo em `homeFor`/fim do onboarding.
- Critério de aceite: e2e modo real `/v/<slug>` → cadastro/Google/SMS → termina em `/vaga/<id>`.
- Dependências: AUD-007
- Origem: C6-002 (C6)
- Revisão adversária: Cético: mantido (`RETURN_TO_KEY` só é lido em `Login.tsx:93`).

### AUD-039 — Reembolso prometido não tem fila, nem estado final, nem tratamento de estorno ou chargeback (Mercado Pago)

- Área: produto
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `supabase/functions/webhook-pagamento/index.ts:43-53`; `supabase/functions/_shared/mercadopago.ts:21-22`; `supabase/migrations/20261010000200_z02_pagamentos.sql:12-16,165-176`; `src/pages/recruiter/Payments.tsx:25,89`
- Prova: o webhook só trata `approved` e `rejected`/`cancelled`. Qualquer outro status, inclusive `refunded` e `charged_back` (que o tipo `MpPayment` declara), cai em `else result = mp.status` e nada muda no banco. Staging: o enum `payment_status` é `aguardando, confirmado, recusado, expirado, cancelado, reembolso_pendente`; não existe estado "reembolsado" ou "estornado". Das 13 funções `admin_*` (lanc06), nenhuma lista nem resolve pagamento; não há fila no `/admin`. `confirm_boost_payment` devolve cedo para `reembolso_pendente`, então o pagamento nunca sai desse estado. A notificação diz "Vamos devolver o valor" e a tela diz "Reembolso em análise".
- Impacto: a empresa pagou, a vaga não pôde ser impulsionada e ninguém da equipe vê isso. Se ela contestar no cartão (chargeback) ou o Mercado Pago estornar, o impulso continua ativo e a receita do funil continua contando: problema de consumidor e de caixa.
- Causa raiz: o ciclo de vida do pagamento termina em "aprovado"; reembolso é só uma promessa em texto.
- Correção recomendada: adicionar os estados `reembolsado` e `estornado`; fazer o webhook tratar `refunded`/`charged_back` (marcar o pagamento e, no chargeback, encerrar `boost_ends_at`); criar `admin_payment_queue()` e `admin_mark_refunded(id, motivo)` no `/admin`, com `staff_log`; avisar a empresa quando o reembolso for feito.
- Critério de aceite: teste SQL que marca um pagamento `refunded` e checa que `boost_ends_at` encerra e o funil descontou; a fila lista os `reembolso_pendente`; um teste do webhook com `status=refunded` muda o estado.
- Dependências: ligar `FEATURES.payments` é ação do responsável
- Origem: HUNT-001 (HUNTER)

### AUD-045 — Denúncia de perfil, avaliação ou publicação não tem como tirar o conteúdo do ar

- Área: produto
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (política no catálogo do staging + código das funções)
- Onde: `web/supabase/migrations/20261015000100_lanc06_backoffice.sql:462-495` (`admin_resolve_report`: só `arquivar`, `ocultar_vaga` e `suspender_conta`); `20261021000500_u48_publico_geral.sql:20-75` (`admin_suspend_account` só esconde as vagas e cancela bicos); políticas `workers`, `reviews`, `worker_posts` = `using (true)` para `authenticated`; `report_target` aceita `vaga | perfil | avaliacao | post`
- Prova: no staging, `pg_policies`: `workers` "Perfis de trabalhador visíveis para quem está logado" `qual=true`; `reviews` "Avaliações são públicas…" `true`; `worker_posts` "Portfólio visível…" `true`. Nenhuma tem teste de `suspended_at`/`hidden`. Como trabalhadora suspensa (staging, transação revertida) `select id from workers` continuou devolvendo todos os perfis, e `update workers set name=…` e `insert into worker_posts` seguiram funcionando.
- Impacto: se alguém denunciar uma foto, legenda, bio ou avaliação ofensiva, a equipe só consegue arquivar a denúncia ou suspender a conta; a conta suspensa continua com perfil, publicações e avaliações visíveis para todos. Só o SQL Editor tira o conteúdo do ar.
- Causa raiz: o painel foi desenhado em torno da vaga (único conteúdo com `hidden_at`); perfil, avaliação e post ficaram sem coluna/política de ocultação.
- Correção recomendada: `hidden_at` em `worker_posts` e `reviews` e uma flag em `workers`/`companies`; políticas de leitura que ignoram o oculto (exceto para a equipe e o dono); ação `ocultar_conteudo` em `admin_resolve_report`; `admin_suspend_account` deve esconder o perfil público.
- Critério de aceite: teste SQL: após `admin_resolve_report(…, 'ocultar_conteudo')` ou suspensão, outro usuário logado não lê o perfil/post/avaliação (0 linhas).
- Dependências: decisão do responsável sobre o que a moderação precisa poder fazer.
- Origem: D1-004 (D1)
- Revisão adversária: Cético B: mantido, com ressalva: a suspensão tira o login e as sessões, então 'suspensa continuou editando' só vale enquanto o JWT vive (até 1 h). O ponto que vale é a falta de ocultar item por item.

### AUD-046 — Quem souber o CPF/CNPJ de outra pessoa trava o cadastro dela e apaga o cadastro pendente dela; não há prova de posse nem contestação

- Área: produto
- Severidade: S2 médio
- Esforço: M
- Confiança: provável
- Onde: `migrations/20261010000300_z07_documento_login.sql:84-111` (`claim_document_for`); `migrations/20261011000300_y16_y17_documento.sql:10-63` (só dígito verificador); `migrations/20261012000800_l13_conta_google.sql:35-42`; teste `tests/z07_documento.sql:34-45`
- Prova: a definição final no staging faz `raise 'Documento já cadastrado.'` se a conta tem e-mail confirmado e `delete from auth.users` se está pendente. O teste z07:35 prova o bloqueio do 2º cadastro. `grep -i "contest|disputa"` em DECISOES e CHECKLIST: nada.
- Impacto: um golpista ou concorrente cadastra o CPF/CNPJ alheio com e-mail descartável e o dono real fica sem conta.
- Causa raiz: o documento vale como identidade sem nenhuma prova de posse.
- Correção recomendada: função da equipe para liberar documento + canal "esse CPF é meu"; só tratar o documento como ocupado com alguma prova (CNPJ ativo, identidade aprovada); registrar em DECISOES.
- Critério de aceite: teste SQL de contestação liberada pela equipe.
- Dependências: decisão dos sócios
- Origem: D3a-001 (D3a); também reportado por: D3c-004
- Revisão adversária: Cético B: mantido (`claim_document_for` recusa se o dono tem e-mail confirmado e apaga o cadastro pendente; sem prova de posse nem contestação; DECISOES Z07 não discute o risco).
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3c-004 (S2): WhatsApp único sem prova de posse: dá para "reservar" o número de outra pessoa e derrubar o cadastro dela em andamento — onde: `web/supabase/migrations/20261020000100_u10_dados_unicos.sql:38-54` (`claim_whatsapp_for`: recusa número de conta confirmada, **apaga** `auth.users` do cadastro não confirmado que tem o número), `:77` (índice único `accounts_whatsapp_key`), `:98-99` (`create_account_for` chama a regra), `:157` (`change_whatsapp`); `20261022000200_u63_um_nome_so.sql:50-52` (`create_my_account` só confere o formato com `whatsapp_valid`, `^[1-9][1-9]9[0-9]{8}$`)

### AUD-047 — O selo "Verificada" e o nome da empresa não aparecem onde se decide (card, vaga, confirmar candidatura)

- Área: produto
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado
- Onde: `components/JobTile.tsx:73-79,113-161` (nome só no `aria-label`); `pages/worker/JobDetail.tsx:212-228` (nome e nota, sem selo); `ConfirmApplication.tsx:70-95`; selo só em `PublicJob.tsx:157` e no perfil da empresa
- Prova: print 10 (card sem nome de empresa), 20b ("Casa de Festas Cangaíba ★ 4,3 (6) Ver perfil", sem selo), 22; o link público sem conta (print 91) mostra "Verificada" e a vaga dentro da conta não. `rg verified|Verificad` nesses três arquivos: nada.
- Impacto: a verificação de CNPJ, principal sinal de confiança do produto, não ajuda na decisão: quem navega não vê, quem recebe o link por WhatsApp vê.
- Causa raiz: telas refeitas (U58–U61) sem o selo, embora `company.verified` chegue.
- Correção recomendada: selo com texto ao lado do nome da empresa na vaga e na confirmação; nome da empresa numa linha cinza no card (+ selo quando houver).
- Critério de aceite: prints com e sem o selo.
- Dependências: ver AUD-009 e AUD-013 (regra de fundo do selo)
- Origem: P1-003 (P1)
- Revisão adversária: Cético B: mantido, com correção: o nome da empresa aparece em `JobDetail.tsx:218` e `ConfirmApplication.tsx:73`; falta o **selo** nessas telas, e o card não tem nome nem selo.

### AUD-048 — "Sua vaga": candidatos ~1.150 px abaixo; a barra fixa oferece "Editar vaga" e "Excluir vaga"

- Área: produto
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `pages/recruiter/JobManage.tsx:213-357` (ordem: fotos, selo, título, valor, vagas preenchidas, impulsionar, "Onde e como", candidatos); barra `:359-362`
- Prova: print 81 (1ª tela: "Escolher fotos", "3 aguardando análise", valor); print 84 (candidatos só depois de rolar); primeiro "Aprovar candidato" em y=1.218 px (tela de 800).
- Impacto: quem tem pressa para fechar o bico rola duas telas; a ação fixa à mão é apagar a vaga; demora de resposta afasta o trabalhador.
- Causa raiz: tela montada como "ficha da vaga"; candidatos ficaram no fim.
- Correção recomendada: com pendentes, lista logo sob o título (ou abas "Candidatos | Detalhes"); barra "Ver candidatos (3)"; "Excluir vaga" para dentro de "Editar vaga".
- Critério de aceite: 1º candidato visível na 1ª tela de 360×800.
- Dependências: nenhuma
- Origem: P1-004 (P1)
- Revisão adversária: Cético B: mantido, com correção: a barra fixa tem 'Editar vaga' como botão principal e 'Excluir vaga' é link pequeno com confirmação; fica a ordem da tela (candidatos 1.150 px abaixo).

### AUD-049 — Avisos de candidato novo, aprovação e bico novo só existem dentro do app

- Área: produto
- Severidade: S2 médio
- Esforço: M
- Confiança: provável (decisão L12; não testável na demonstração)
- Onde: `web/docs/DECISOES.md:1409-1425` (push desligado no lançamento), `CHECKLIST-LANCAMENTO.md:125`, `services/features.ts:36`; promessas em `pages/recruiter/JobPublished.tsx:27`, `pages/worker/ApplicationSent.tsx:158`, `pages/worker/feed/FeedSheets.tsx:141-148`
- Prova: só há Edge Function de push (`enviar-push`), sem chave VAPID; nenhuma de e-mail/WhatsApp para avisos. Sem abrir o app ninguém sabe que foi aprovado ou que alguém se candidatou, mas a tela diz "Avisamos quando…".
- Impacto: o laço candidatura → resposta → WhatsApp depende de as duas pessoas abrirem o app; no piloto a 1ª candidatura sem resposta mata a confiança.
- Causa raiz: push adiado para "depois do piloto", sem alternativa.
- Correção recomendada: e-mail (Brevo já previsto) nos 3 eventos (candidato novo, aprovado, resumo diário do alerta) ou push no piloto; enquanto isso trocar "Avisamos" por "Você vê aqui no app".
- Critério de aceite: e-mail/push recebido nos 3 eventos no staging.
- Dependências: ação do responsável (canal, conta, VAPID)
- Origem: P1-006 (P1)
- Revisão adversária: Cético B: decisão documentada (push adiado, L12; e-mail adiado, `DECISOES.md:859`) e o 'Avisamos' vale dentro do app. **Mantido S2** como risco de produto do piloto (a candidatura sem resposta mata a confiança); decisão nº 8 dos sócios.

#### Área: UX

### AUD-025 — Cadastro perde tudo ao recarregar a página no passo do código do WhatsApp

- Área: UX
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `pages/shared/Signup.tsx`; `services/auth.ts` (rascunho `pendingSignUp` só em memória; DECISOES Y22 cobre "sair do fluxo", não o descarte da aba)
- Prova: `$SCRATCH/out/B1/signup5.cjs`, `signup_run5.txt`: preencher nome, CPF, e-mail, `reload` → volta ao passo 1 vazio.
- Impacto: ler o código no WhatsApp tira o navegador da tela; um celular simples descarta a aba e a pessoa recomeça o cadastro do zero.
- Causa raiz: rascunho do cadastro só em memória.
- Correção recomendada: guardar nome, lado e passo (nunca a senha) em `sessionStorage`.
- Critério de aceite: e2e com `reload` no passo do código volta ao mesmo passo.
- Dependências: nenhuma
- Origem: B1-001 (B1)
- Revisão adversária: Cético sugeriu S3 (o passo do código do WhatsApp está desligado no lançamento). **Mantido S2**: o rascunho do cadastro só em memória se perde ao recarregar em qualquer passo, e o fluxo exige sair do app para o e-mail.

### AUD-028 — Cadastro do endereço: sem internet (ou provedor lento) o app diz "Não achamos essa rua", e a localização é salva em silêncio no centro da cidade

- Área: UX
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido: `$SCRATCH/out/C1/repro/endereco.test.ts`)
- Onde: `web/src/services/remote/address.ts:224-259` (`streetsOnline`: o `catch` do ViaCEP só relança se a pessoa abortou; o do Photon devolve `{ body: null }`) → `web/src/services/address.ts:385-390` (`findCep`) → `:329-338` (`resolveAddress` responde `errors.street`); `remote/address.ts:334-388` (`geocodeOnline`: Nominatim e Photon caem em `catch` vazio e devolvem o centro da cidade com `precision: 'cidade'`). Telas: `pages/shared/CompleteProfile.tsx:105` (cadastro), `hooks/useAddressEditor.ts:40` (editar perfil), `pages/recruiter/CreateJob.tsx:131` (vaga).
- Prova: com `fetch` rejeitando (`TypeError: Failed to fetch`) e sem CEP digitado: `resolveAddress({city:'Caxias do Sul, RS', street:'Rua Sinimbu', neighborhood:'Centro'})` → `{"ok":false,"errors":{"street":"Não achamos essa rua em Caxias do Sul. Escolha a rua na lista ou digite o CEP."}}`. Com o CEP digitado, o mesmo cenário dá o erro certo (`THROWS offline: Não deu para buscar o CEP agora. Confira a internet…`), então o contrato "só lança erro quando os provedores não respondem" (comentário em `address.ts:301`) vale só para o CEP. `getJson` aborta em 7 s (`remote/address.ts:73`), então internet lenta cai no mesmo caminho. O `precision` nunca é mostrado nem usado na tela (`grep precision src/pages src/components` → nada), então a pessoa não sabe que a casa foi salva no centro.
- Impacto: no passo "Seu endereço" do cadastro, quem está com sinal fraco lê que a rua não existe, corrige o que estava certo e desiste ou digita um CEP errado. Quando só o mapa cai, o endereço é salvo no centro da cidade e todas as distâncias "a 300 m" do mural saem erradas sem aviso (a promessa do U51 é a distância de verdade).
- Causa raiz: `streetsOnline`/`geocodeOnline` tratam "provedor não respondeu" como "nada encontrado"; falta distinguir lista vazia de falha (o CEP já faz isso com `reached`).
- Correção recomendada: em `streetsOnline` lançar `offline` quando ViaCEP e Photon falham ao mesmo tempo (e não vir de aborto); em `resolveAddress` deixar esse erro subir; em `geocodeOnline` devolver também `degraded: true` e, no cadastro, avisar "Não deu para marcar a casa no mapa; vamos usar o centro da cidade" ou tentar de novo.
- Critério de aceite: o teste `endereco.test.ts` passa a mostrar `THROWS offline` (sem CEP) e um teste novo cobre `precision: 'cidade'` por falha com aviso.
- Dependências: nenhuma.
- Origem: C1-002 (C1); também reportado por: C1-003
- Revisão adversária: Cético: mantido (queda do ViaCEP/Photon vira lista vazia).
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C1-003 (S3): Falha HTTP de um provedor de CEP/mapa vira resposta definitiva: "CEP não encontrado" ou sugestões vazias pela sessão inteira — onde: `web/src/services/remote/address.ts:129-173` (`lookupCepOnline`: ViaCEP com status 5xx entra em `reached = true` e `!body` devolve `null`); `:85-94` (`cached`: só esquece a promessa que _rejeita_) com `:253-255` e `:291-293` (`cached(url, () => getJson(...))` não lança em status != 200: `getJson` devolve `{status, body:null}`).

### AUD-030 — Mural vazio diz "Nenhuma vaga com esse filtro" sem filtro; "Limpar filtros" não faz nada

- Área: UX
- Severidade: S2 médio
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/FeedParts.tsx:54-75` (`NoJobsState`; chamado em `MobileFeed.tsx:85` e `DesktopFeed.tsx:34`)
- Prova: na cidade do perfil a função devolve sempre o texto de filtro, porque não recebe `chips`. A produção tem 0 vagas, então é o que o primeiro usuário vê (a empresa também vê o mural).
- Impacto: o primeiro trabalhador (e a primeira empresa) a abrir o app vê uma mensagem errada, que manda limpar um filtro que não existe.
- Causa raiz: `NoJobsState` não distingue "sem vagas" de "sem vagas com esse filtro".
- Correção recomendada: passar `chips.length`; sem filtro, mostrar "Ainda não tem bico em {cidade}" e, para a empresa, "Publicar vaga".
- Critério de aceite: teste: 0 vagas e sem filtro não contém a palavra "filtro".
- Dependências: nenhuma
- Origem: C4-001 (C4); também reportado por: P1-001
- Revisão adversária: Cético sugeriu S3 (texto errado em estado vazio). **Mantido S2**: é a primeira tela que cada trabalhador e empresa do piloto vê (a produção tem 0 vagas).
- Ocorrências adicionais (mesmo problema, outros lugares):
  - P1-001 (S2): Mural vazio na cidade da pessoa diz "Nenhuma vaga com esse filtro" sem filtro nenhum — onde: `pages/worker/feed/FeedParts.tsx:54-75` (`NoJobsState`)

### AUD-041 — Sem caminho para a Ajuda/suporte nas telas onde mais gente trava

- Área: UX
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Login.tsx`, `Signup.tsx`, `VerifyEmail.tsx`, `CompleteProfile.tsx`, `Splash.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx` (nenhuma tem link); `Help.tsx:1-2` afirma que "the login screen links here too"
- Prova: `grep "'/ajuda'" web/src` acha só `accountMenu.ts:18,25`, `Settings.tsx:122` e `recruiter/Payments.tsx:94`, todas dentro do app logado. `git log -S"navigate('/ajuda')" -- Login.tsx` não retorna nada: o link nunca existiu. Com AUD-007, a Ajuda também não abre hoje para visitante.
- Impacto: e-mail com código que não chega, senha esquecida e "Não deu para criar a conta com esse CPF" não oferecem "Falar com o suporte". A pessoa só pode desistir.
- Causa raiz: o suporte só existe dentro do app logado.
- Correção recomendada: link discreto "Preciso de ajuda" (WhatsApp do suporte via `whatsappUrl(SUPPORT_WHATSAPP)`) no rodapé do Login, no cabeçalho do VerifyEmail e na mensagem de CPF recusado; corrigir o comentário de `Help.tsx`.
- Critério de aceite: de `/login`, `/cadastro/*` e `/verificar-email` há toque visível para o suporte.
- Dependências: AUD-007
- Origem: C3-003 (C3)
- Revisão adversária: Cético B: mantido (nenhuma tela de entrada linka `/ajuda`; o comentário de `Help.tsx:1-2` é falso).

#### Área: processo

### AUD-040 — Em produção nada avisa ninguém quando algo quebra (e o staging também não): Sentry e monitor de fora desligados, alerta do cron sem destino

- Área: processo
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (configuração documentada)
- Onde: `CLAUDE.md:127-128,156-158`; `web/docs/SUPABASE.md:137-150`; `.github/workflows/site.yml:37-38`; `staging.yml:177`; `web/docs/ADVISORS.md:15`
- Prova: CLAUDE.md:127 faltam no Vault `bicos_sentry_dsn` e `bicos_heartbeat_url`; :157-158 "Desligado: … Sentry …". SUPABASE.md:139 "sem os dois itens abaixo ele só registra o alerta em cron_alerts (ninguém é avisado)". No staging o DSN é `https://publica@sentry.invalid/1` (site.yml:38) e `…e2e@sentry.invalid/1` (staging.yml:177): erros do site de teste também não vão a lugar nenhum. SUPABASE.md:142-148 são "ação do responsável" sem data e não são bloqueadores no checklist (AUD-201). Sem monitor de disponibilidade do site nem da API; `funnel_daily` só pelo SQL Editor; o plano Free pausa por inatividade (X30) e o único alarme previsto é o heartbeat não configurado. (Defeitos do alerta em si: AUD-139; limpeza que não roda: AUD-006.)
- Impacto: o primeiro sinal de falha em produção será um usuário reclamando no WhatsApp do suporte.
- Causa raiz: observabilidade foi construída no código (L05, L12) e deixada "para ligar depois" sem dono nem data.
- Correção recomendada: tornar Sentry (front e funções) e `bicos_heartbeat_url` bloqueadores do lançamento, com e-mail dos sócios; monitor de disponibilidade grátis no domínio e no `/auth/v1/health`; Sentry real no staging.
- Critério de aceite: `select * from cron_health()` e um erro forçado (IMPLANTACAO:138-141) chegam por e-mail em < 1 h.
- Dependências: ação do responsável; AUD-139
- Origem: O1-011 (O1)
- Revisão adversária: Cético: o Sentry e o heartbeat são 'ação do responsável' documentada; resíduo: faltam como bloqueadores explícitos no checklist (mantido S2 por isso).

### AUD-053 — Nada segura um commit com CI vermelho: master sem proteção, staging e site de teste não esperam o CI, e o plano de produção liga o Cloudflare Pages ao master

- Área: processo
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (execuções) / provável (plano de produção, não executado)
- Onde: `.github/workflows/web.yml:8-18`; `staging.yml:10-14`; `site.yml:8-12`; `web/docs/CHECKLIST-LANCAMENTO.md:83`; `web/docs/IMPLANTACAO.md:98-104`; `CLAUDE.md:37-42`; `web/scripts/deploy.sh:23-24`
- Prova: os 3 workflows disparam em paralelo no mesmo push, sem `needs`/`workflow_run`. Commit 1f202ee (24/10, 17:43:40): web run 40117427286 = cancelled; staging run 40117427320 = success (migrations, funções, E2E); site run 40117427366 = success (Pages no ar). web.yml:16-18 tem `cancel-in-progress:true`: runs 148, 150, 151 (commits 1f202ee, 0cd502e, 4d9ea34) foram cancelados e nunca validaram aqueles commits. As 5 branches estão `protected:false`; CLAUDE.md:37-39 manda push direto no master, sem PR. CHECKLIST:83 manda criar o Cloudflare Pages "Connect to Git … branch de produção master" e IMPLANTACAO:98 repete "a partir do master": Pages com Git publica a cada push sem consultar o Actions — contradiz CLAUDE.md:40-42 ("master não mexe na produção; produção só com pode"). `deploy.sh` roda só typecheck e `vite build` (sem lint nem testes).
- Impacto: um erro enviado ao master pode ir ao staging e ao site de teste antes de o CI ficar verde — e, se o plano do checklist for seguido, direto ao site de verdade sem o "pode" prometido.
- Causa raiz: CI e deploys são workflows independentes; a regra "só com pode" vive só em texto.
- Correção recomendada: proteger o master exigindo os checks `checks` e `sql`; staging e site via `workflow_run` (sucesso) ou `needs`; no Cloudflare Pages usar Direct Upload (`deploy.sh producao`) ou branch `producao` com merge manual, nunca o master; `deploy.sh producao` rodar lint+testes e conferir árvore limpa.
- Critério de aceite: push com teste quebrado não dispara migration, função nem Pages; o runbook diz qual gatilho publica.
- Dependências: O1-008
- Origem: O1-003 (O1); também reportado por: O1-008
- Revisão adversária: Cético B: mantido com escopo menor: os runs cancelados são esperados (`cancel-in-progress`) e push direto no master é a regra do CLAUDE.md; o que importa é o plano ligar o Cloudflare Pages por Git ao `master`, que publicaria a cada push.
- Ocorrências adicionais (mesmo problema, outros lugares):
  - O1-008 (S3): Seis commits (X30–X32, correção do VAPID, limpeza) estão numa branch lateral: staging e site de teste não têm a correção do X31, e a regra "tudo no master" não foi seguida — onde: `CLAUDE.md:37-42`; `.github/workflows/staging.yml:12`; branches do GitHub

### AUD-055 — O roteiro de produção (IMPLANTACAO.md) parou na migration u12: 13 migrations ficam de fora, sem "desfazer", e há passos que não funcionam como escritos

- Área: processo
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `web/docs/IMPLANTACAO.md:28,35-40,47-48,51-64,69-72,98-106`; `web/supabase/APLICAR.md:52,464-470,618-632`; `web/scripts/staging/publicar-funcoes.sh:2,17-18`; `web/.env.example`; `web/build/env.ts`; `CLAUDE.md:156`
- Prova: IMPLANTACAO:47-48 "#39 a #50" e :28 "falta exatamente … lanc06 … u12". O APLICAR.md vai até a #63: ficam de fora u24, u30, u32, u37, u49, u48, u51, u52, u53, u62, u63, u65, u67 (13). A conferência final do passo 4 ("igual aos arquivos") não fecharia. A tabela "Desfazer" (:51-64) não tem linha para as destrutivas: u32 (apaga 4 colunas do trabalhador), u63 (apaga `companies.contact_name`), u62 (apaga linhas de `addresses`), u24 (troca `anonymize_account`); o APLICAR.md as marca destrutivas. IMPLANTACAO:69 "Republicar as 8 funções"; publicar-funcoes.sh:2 publica 10; a tabela de conferência do passo 5 não tem `verificar-cadastro` nem `entrar-com-firebase`. Passo 3 não cita `FIREBASE_PROJECT_ID` e passo 7 não cita `VITE_FIREBASE_*`; `.env.example` e `build/env.ts` também não (grep = 0): o build de produção não exige e sairia SEM login do Google sem erro, enquanto CLAUDE.md:156 afirma que o Google está "Ligado". O roteiro não diz com que ferramenta aplicar migrations: aplicar-banco.sh recusa produção; APLICAR.md:52 diz `supabase db push`; APLICAR-TUDO.sql no SQL Editor não grava `schema_migrations`, e o conferir-migrations.sh do fim do passo 4 falharia. `git grep IMPLANTACAO` só acha workflows, checklist, LIMPEZA e conferir-funcoes.sh — não é citado no CLAUDE.md nem nos READMEs.
- Impacto: seguir o roteiro à risca deixaria a produção com metade das migrations, sem saber desfazer as destrutivas, sem login do Google e sem registro de histórico.
- Causa raiz: escrito no R09 (17/10) e não atualizado nas 18 migrations seguintes.
- Correção recomendada: regenerar o passo 4 a partir do APLICAR.md; "Desfazer/backup obrigatório" nas destrutivas; uma única ferramenta (ex.: `supabase db push` depois do `repair`); completar Firebase e lista de 10 funções; citar o arquivo no CLAUDE.md §8.
- Critério de aceite: teste/CI que compara os #n do APLICAR.md com o IMPLANTACAO.md e falha se divergir; CLAUDE.md aponta para o roteiro.
- Dependências: AUD-198 (números), AUD-138 (trava de backup da migration destrutiva)
- Origem: O1-006 (O1)
- Revisão adversária: Cético B: mantido (IMPLANTACAO manda '#39 a #50', o APLICAR.md vai até a #63; '8 funções' em vez de 10; sem variáveis do Firebase).

#### Área: acessibilidade

### AUD-042 — A linha do candidato é uma `div` com clique, sem teclado nem papel

- Área: acessibilidade
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado
- Onde: `components/CandidateRow.tsx:47-53`; `pages/recruiter/JobManage.tsx:306`
- Prova: é uma `div` com `onClick`, sem `tabIndex`, `role` nem tecla; em `JobManage.tsx:306` esse clique é o único caminho para o perfil do candidato.
- Impacto: quem usa teclado ou leitor de tela não consegue abrir o perfil de um candidato, que é o passo central da empresa.
- Causa raiz: elemento clicável não semântico.
- Correção recomendada: nome do trabalhador como botão, como o `JobTile` já faz (X05).
- Critério de aceite: Tab chega ao candidato e Enter abre o perfil; axe sem violação.
- Dependências: nenhuma
- Origem: C5-001 (C5)
- Revisão adversária: Cético B: mantido (`CandidateRow.tsx:45-53` é `div onClick`; é o único caminho ao perfil na vaga aberta).

### AUD-043 — Sem foco visível em Checkbox, Radio/RadioCard, Switch, PhotoSlot, PhotoManager e carrossel

- Área: acessibilidade
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado
- Onde: `components/Checkbox.tsx`, `Radio.tsx`, `Switch.tsx`, `PhotoSlot.tsx`, `PhotoManager.tsx`, `PhotoCarousel.tsx:198-201`, `JobTile.tsx`, `JobMap.tsx:82`, `WhatsAppButton.tsx`
- Prova: `outline-none` com `tabindex=0` no carrossel; o foco é quase invisível no título do `JobTile`, no botão do `JobMap` e no `WhatsAppButton` (`ring-brand-100` = 1,27:1; WhatsApp = 1,21:1). Nenhum `peer-focus` existe no projeto.
- Impacto: quem navega por teclado não sabe onde está; falha WCAG 2.4.7 / 1.4.11.
- Causa raiz: controles customizados escondem o input nativo sem reproduzir o foco.
- Correção recomendada: `peer-focus-visible:outline` no desenho do controle, anel `brand-500`.
- Critério de aceite: foco visível com contraste ≥ 3:1 em todos esses controles (teste Playwright com Tab).
- Dependências: nenhuma (relacionado a AUD-150)
- Origem: C5-002 (C5)
- Revisão adversária: Cético B: mantido (`input.sr-only` sem `peer-focus`; `PhotoCarousel` com `outline-none` e `tabIndex=0`).

### AUD-044 — O título da aba nunca muda e o foco volta ao início a cada troca de tela

- Área: acessibilidade
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `App.tsx:181` (`<AppShell key={seq}>` remonta barra e tela a cada navegação), `App.tsx:74` (`scrollTo`), `web/index.html:6`; `grep -rn "document.title" web/src` não acha atribuição alguma
- Prova: `title.mjs` (build demo + Chromium): `/login`, `/mural`, `/minhas-candidaturas` → sempre `title=Bicos — bicos e diárias perto de você`; após focar a aba "Vagas" e Enter, `document.activeElement` = `BODY`. Só o toast tem `aria-live` (`ToastHost.tsx:11`).
- Impacto: leitor de tela/teclado não percebe a troca de tela e perde o ponto; o histórico mostra o mesmo nome em tudo (WCAG 2.4.2 nível A, 2.4.3).
- Causa raiz: roteador próprio sem título por rota nem gestão de foco; a barra é recriada de propósito (`App.tsx:179`).
- Correção recomendada: `title` em `RouteDef`; ao navegar definir `document.title` e focar `<main tabIndex={-1}>`/`<h1>` (ou região `aria-live`).
- Critério de aceite: Playwright navega 3 telas: títulos distintos e `activeElement` dentro de `<main>`.
- Dependências: nenhuma
- Origem: C6-001 (C6); também reportado por: B1-002
- Revisão adversária: Cético B: mantido, limítrofe com S3 (WCAG 2.4.2 nível A; impacto prático moderado para o público).
- Ocorrências adicionais (mesmo problema, outros lugares):
  - B1-002 (S3): Título do documento igual em todas as telas — onde: `web/index.html:6`; `grep document.title web/src` vazio

#### Área: desempenho

### AUD-050 — `feed_jobs` não limita o texto da busca: poucos KB de palavras repetidas prendem o banco por segundos (custo cresce com palavras × vagas)

- Área: desempenho
- Severidade: S2 médio
- Esforço: P
- Confiança: confirmado (custo medido no staging); a extrapolação para o volume do mural é estimativa
- Onde: `web/supabase/migrations/20261021000400_u49_busca_vagas.sql:22,29-34,64-72` (mesmo corpo em u52:299-351, u53:20-72, u65:17-71); chamada do app `web/src/services/remote/data.ts:193` (`p_search: q.search.trim() || null`)
- Prova: no staging (11 vagas em Caxias do Sul), `explain (analyze, timing off) select count(*) from feed_jobs('Caxias do Sul','RS',-29.17,-51.18, p_search => …)`: 1 palavra = 58 ms; 1000 palavras iguais (8 KB) = 223 ms; 20000 palavras (180 KB) = **3,7 s**, sempre para as mesmas 11 vagas. A função não corta `p_search` (só `btrim` + `fold_text`) nem deduplica `words`; para cada vaga e **para cada palavra** ela recalcula `fold_text(concat_ws(título, bairro, cidade, UF, sinônimos do ofício))` (linhas 67-70), porque a subconsulta correlacionada roda por elemento de `unnest(o.words)`. Custo medido ≈ 16 µs por par (palavra, vaga). Com 5.000 vagas abertas na área da busca (`p_all_cities` varre todas), 500 palavras (4 KB) já passam de 40 s de CPU; o `statement_timeout` do papel `authenticated` é 8 s (`pg_roles.rolconfig`), então cada pedido gasta 8 s de um banco do plano Free antes de cair.
- Impacto: qualquer conta logada consegue deixar o mural lento ou fora do ar para todo mundo com algumas chamadas paralelas; nem o campo de busca do app tem limite (`web/src/pages/worker/feed/FeedParts.tsx:118`, sem `maxLength`), e a RPC também pode ser chamada direto pela API.
- Causa raiz: a regra "cada palavra precisa estar na vaga" foi escrita como `not exists (… unnest(words) …)` com o texto da vaga calculado dentro do laço, e sem teto de tamanho.
- Correção recomendada: no começo da função, `left(p_search, 60)` e no máximo 6 palavras distintas (`select distinct … limit 6`); calcular o texto dobrado da vaga uma vez por linha (coluna calculada num CTE/`lateral`) e comparar as palavras contra ele; opcional: índice `pg_trgm` na coluna dobrada quando o volume pedir.
- Critério de aceite: o mesmo `explain analyze` com 20000 palavras fica abaixo de 100 ms (texto cortado), e um teste SQL em `u49_busca_vagas.sql` chama a busca com 5000 palavras e confere que responde igual à busca com as 6 primeiras.
- Dependências: nenhuma.
- Origem: D3c-003 (D3c); também reportado por: D2-009
- Revisão adversária: Cético B: mantido; reproduzido por ele no staging (1 palavra: 51 ms; 'caxias ' ×5.000 = 35 KB: 1.773 ms para as mesmas 11 vagas); `statement_timeout` de 8 s limita o pior caso.
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D2-009 (S3): Entrada inválida vira erro SQL cru e há parâmetros sem teto — onde: `job_from_draft` (casts), `save_job_alert` (`…y28_alerta_bico.sql:28`), `feed_jobs` (`p_radius_km*1000`, `p_search`), `job_stats`

### AUD-051 — Mural: a 1ª foto de cada cartão carrega de uma vez em 1600 px, e as duas versões (celular e computador) ficam montadas

- Área: desempenho
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado (DOM); provável (peso em rede: a demonstração não tem fotos)
- Onde: `src/components/PhotoCarousel.tsx:209-216` (`loading={i===0?'eager':'lazy'}`, sem `width/height`/`sizes`); `src/utils/image.ts:8` (`MAX_SIDE=1600`, ~250 KB); `src/pages/worker/feed/Feed.tsx:94-95` (`<MobileFeed/>` e `<DesktopFeed/>` juntos); `src/components/JobTile.tsx:69` (`useDb()` no cartão); nenhuma URL `render/image` em `src/`
- Prova: `dom.cjs` no mural logado: 2 `.tile-grid`, 52 cartões no DOM (26 visíveis), 1.598 nós, tanto a 360 px quanto a 1280 px. Um cartão de ~165 px (330 px a 2×) recebe o arquivo de 1600 px, cerca de 23× os pixels necessários. `eager` na foto de capa de todos os cartões baixa as 30 fotos da página, inclusive as fora da tela.
- Impacto: um mural de 30 vagas com foto puxa da ordem de 7 MB antes do primeiro scroll, no 3G. A cada notificação o React reconcilia 52 cartões.
- Causa raiz: a mesma foto de 1600 px serve de capa e de detalhe, o Supabase Free não redimensiona e o CSS esconde a árvore que não vale.
- Correção recomendada: (a) `loading="lazy"` e `decoding="async"` em todas as fotos de cartão; (b) gerar no envio uma miniatura de ~480 px; (c) renderizar só o layout ativo, com `matchMedia(770px)`.
- Critério de aceite: com 30 vagas com foto, a rede do mural até o primeiro scroll é ≤ 1,5 MB, e `.tile-grid` aparece 1 vez.
- Dependências: nenhuma
- Origem: Q1-003 (Q1)
- Revisão adversária: Cético B: mantido (1ª foto `eager` em todo cartão; as duas árvores montadas; peso de rede 'provável').

### AUD-052 — `.in('…', [centenas de ids])` monta URLs de 8 a 19 KB: "Minhas vagas" de empresa movimentada pode falhar

- Área: desempenho
- Severidade: S2 médio
- Esforço: M
- Confiança: provável (tamanho medido; o limite do gateway não foi testado)
- Onde: `src/services/remote/data.ts:74-86` (`eventsOf`), `:46-60` (`companiesById`, `workersById`, `jobsById`), `:402-408` (`putCompanyJobs`: todas as candidaturas das vagas abertas + 30 encerradas, sem limite), `:117-125`
- Prova: `urllen.mjs` monta a URL real do `supabase-js` para `application_events`: 100 candidaturas → 3,9 KB; 215 → 8,3 KB; 300 → 11,5 KB; 500 → 19,2 KB; 1000 → 38 KB. Gateways HTTP costumam limitar a linha de requisição entre 8 e 16 KB.
- Impacto: a empresa que publica todo dia chega a centenas de candidaturas e a tela "Minhas vagas" ou o histórico passam a dar erro. Hoje há 0 vagas, então ninguém vê.
- Causa raiz: leituras sem limite (`select('*').in('job_id',ids)`) alimentam consultas por lista de ids na URL. Só `loadFeed` e as listas "Carregar mais" têm página.
- Correção recomendada: dividir os ids em lotes de ≤ 50, ou trazer eventos e trabalhadores por RPC (POST); paginar `putCompanyJobs` de 30 em 30.
- Critério de aceite: com o Supabase falso, 600 candidaturas não geram URL > 4 KB.
- Dependências: nenhuma
- Origem: Q1-004 (Q1)
- Revisão adversária: Cético B: mantido (dívida de escala sem efeito hoje: 0 vagas).

#### Área: código

### AUD-036 — Erros inesperados do servidor viram "Não deu certo agora" sem rastro: nada é enviado ao Sentry e a causa original é jogada fora

- Área: código
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: web/src/services/remote/client.ts:66-79 (`toServiceError` termina em `serviceError('falha_demo')`), :88-107 (`request`), :138-161 (`invokeFunction`); web/src/services/errors.ts:20-29 (`ServiceError` não tem `cause`); web/src/services/monitoring.ts:143-163; `grep -rn reportError web/src` → só `ErrorBoundary.tsx:57`
- Prova: um erro PostgREST/RPC fora dos mapas (ex.: `PGRST202` função inexistente depois de migration atrasada, `42703` coluna que não existe, `P0001` sem BCxxx, 500 de Edge Function) cai em `serviceError('falha_demo')`: a tela mostra a mensagem genérica, e o código/mensagem original some (o objeto não guarda `cause`). `reportError` só é chamado pelo `ErrorBoundary` (erro de renderização) e pelos ouvintes globais (`unhandledrejection`), mas as telas capturam a promessa e mostram o erro, então ela nunca vira "não tratada". Resultado: uma RPC quebrada para todos os usuários não gera nenhum evento.
- Impacto: um bug de servidor ou de versão (front novo × banco antigo, justamente o risco do histórico de migrations divergente) aparece para o usuário como "tente de novo" e a equipe só descobre por reclamação.
- Causa raiz: o contrato de erros foi desenhado para a mensagem na tela, não para diagnóstico.
- Correção recomendada: em `toServiceError`, ao cair no ramo desconhecido (e em `invokeFunction` para 5xx), chamar `reportError` com um erro novo que leve só `code`, `status` e nome da RPC/tabela (sem corpo nem dados), e guardar `cause` no `ServiceError`. Limitar por chave para não gastar as 20 vagas de `monitoring.ts:149`.
- Critério de aceite: teste com falso Supabase devolvendo `{code:'PGRST202'}` espera uma chamada de `reportError` com `rpc` e `PGRST202`, sem dado pessoal.
- Dependências: Sentry ligado (ação do responsável: `VITE_SENTRY_DSN`; hoje desligado em produção).
- Origem: C2-006 (C2)
- Revisão adversária: Cético: mantido (erro inesperado vira 'Não deu certo agora' sem rastro; hoje nem há Sentry).

#### Área: testes

### AUD-054 — Nenhuma Edge Function tem teste; a assinatura do webhook de pagamento e as 10 funções só são conferidas com chamadas sem login

- Área: testes
- Severidade: S2 médio
- Esforço: M
- Confiança: confirmado
- Onde: `web/supabase/functions/*/index.ts` (10 funções, 1.279 linhas com `_shared/`); `web/supabase/functions/_shared/mercadopago.ts:60-83` (`validSignature`); `web/scripts/staging/conferir-funcoes.sh:27-37`; `web/e2e/fluxos/08-cadastro-google.spec.ts:1-5,57-66`; `web/e2e/local/servidor.mjs:11`
- Prova: - `grep -rn "supabase/functions" web/src/__tests__` acha só 3 helpers: `_shared/confirm.ts`, `_shared/origin.ts` (+ leitura de texto dos `index.ts` em `edgeOrigin.test.ts:33-55`) e `_shared/firebase.ts`. Nenhum `index.ts` é importado por teste; não há `*.test.*` nem `deno.json` em `functions/`. O CI só roda `deno check` (tipos).
  - `_shared/mercadopago.ts` (HMAC `x-signature`, janela de 15 min, comparação em tempo constante), `captcha.ts`, `http.ts` (`requestUser`, `rpcError`) e `monitoring.ts` não têm nenhum teste, embora `validSignature` seja uma função pura (precisa só de `Deno.env`, que um teste Vitest pode simular).
  - `conferir-funcoes.sh` (único teste automático das funções publicadas, roda no `staging.yml` › `funcoes`) chama cada função com corpo `{}` e só aceita recusas: `webhook-pagamento "503|401"`, `criar-cobranca "401|503"`, `codigo-whatsapp "401|404|503"`, `enviar-push`/`limpar-arquivos "401"`. Nenhum caminho feliz, nenhuma assinatura válida, nenhuma idempotência.
  - O E2E também não as exercita: o fluxo 8 diz no cabeçalho que "a janela do Google não abre em robô" e cria o usuário direto com `admin.createUser` (`08-…spec.ts:57-66`): `entrar-com-firebase` nunca roda de verdade (só o ping `{aquecer:true}` do script). `servidor.mjs` do E2E local só sobe 3 funções (`entrar-com-documento`, `excluir-conta`, `verificar-cnpj`). `codigo-whatsapp`, `criar-cobranca`, `webhook-pagamento`, `enviar-push`, `limpar-arquivos` só levam a chamada de recusa do script de fumaça.
- Impacto: quando os pagamentos, o código por WhatsApp e o push forem ligados (hoje desligados), o dinheiro e o login passam por código que nunca foi executado por um teste; uma regressão na assinatura pode aceitar aviso falso (cobrança "paga" sem pagar) ou recusar todos os avisos verdadeiros (empresa paga e a vaga não sobe) sem o CI perceber.
- Causa raiz: as funções foram escritas para o Deno e o projeto só tem o runner Vitest/Node; a checagem de fumaça foi pensada para "a função está no ar", não para "faz o certo".
- Correção recomendada: (1) `deno test` no CI (já há `setup-deno`) com testes de `validSignature` (assinatura certa, errada, `ts` velho, `ts` em ms, sem segredo), `captcha`, `requestUser`; (2) um teste por handler com `Request` simulado e cliente administrativo falso, começando por `webhook-pagamento` (idempotente, valor errado, pagamento de outra empresa), `criar-cobranca`, `excluir-conta`; (3) no E2E, `entrar-com-firebase` com um ID token de teste assinado pelo emulador do Firebase ou, no mínimo, o ramo `sem-conta` pelo `fetch`.
- Critério de aceite: `deno test supabase/functions` verde no CI; pelo menos 5 casos de `validSignature`; cada `index.ts` com um teste de recusa e um de sucesso.
- Dependências: nenhuma (relacionado a AUD-177, que lista o lado SQL dos pagamentos)
- Origem: O2-002 (O2)
- Revisão adversária: Cético B: mantido (nenhuma função tem teste; `validSignature` do webhook sem teste); vira S1 quando os pagamentos forem ligados.

## 4.4 S3 baixo

Veja `web/docs/AUDITORIA-ACHADOS-S3.md` (147 achados, mesmo formato, mesmos IDs).

## 5. Melhorias e potenciais (M)

### 5.1 Melhorias agora (ganho para o negócio no piloto) (17)

### AUD-203 — Compartilhar vaga só oferece WhatsApp; sem "Copiar link"

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado
- Onde: `utils/share.ts` (`navigator.share` ou `wa.me`)
- Prova: leitura e uso no demo.
- Impacto: o link público `/v/…` é a porta de entrada; no desktop e em celulares sem Web Share não há alternativa.
- Causa raiz: um único canal.
- Correção recomendada: botão "Copiar link".
- Critério de aceite: botão copia o link `/v/<slug>`.
- Dependências: AUD-007
- Origem: B1-012 (B1); também reportado por: C4-016, P1-016
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C4-016 (M): (melhoria agora) Botão "Compartilhar no WhatsApp" na vaga publicada — onde: `pages/recruiter/JobPublished.tsx:39-56`
  - P1-016 (M): (melhoria agora) "Divulgar no WhatsApp" na tela "Vaga publicada" — onde: `pages/recruiter/JobPublished.tsx:40-55`; só há ícone sem texto em `JobManage.tsx:216-224`

### AUD-204 — Link da vaga no WhatsApp mostra sempre a mesma pré-visualização

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: M
- Confiança: provável
- Onde: `web/index.html:33-45` (og:* fixos, `og:url`=`__SITE_URL__/`); `pages/shared/PublicJob.tsx` (sem `<title>` dinâmico); `web/public/` (sem pré-renderização)
- Prova: o raspador do WhatsApp não executa JavaScript, então todo `/v/<código>` entrega o mesmo `index.html`.
- Impacto: o link que a empresa compartilha não mostra a vaga na prévia, o que reduz cliques; é a principal forma de divulgação do produto.
- Causa raiz: app só no cliente, sem renderização por rota.
- Correção recomendada: Pages Function ou Worker em `/v/*` que consulta `public_job_card` e devolve o HTML com `og:title/description` da vaga, sem endereço.
- Critério de aceite: `curl -A WhatsApp /v/<slug>` traz `og:title` com a vaga.
- Dependências: AUD-007 e a decisão de hospedagem
- Origem: C3-017 (C3); também reportado por: Q1-016
- Ocorrências adicionais (mesmo problema, outros lugares):
  - Q1-016 (M): (melhoria agora) A prévia do link no WhatsApp é a mesma para toda vaga — onde: `web/index.html:30-46` (`og:*` fixos); sem função de borda (`web/functions` não existe)

### AUD-205 — Cadastro: cada "Continuar" fecha o teclado

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: provável (código; não medido em aparelho)
- Onde: `pages/shared/Signup.tsx:285-295,595-612` (`key={field.id}`); `hooks/useTextField.ts:7-11,28-33`
- Prova: o `autoFocus` vale uma vez por documento; o código foca o próximo campo só quando o avanço veio por Enter (`advancedByEnter`). No toque o campo é remontado e o teclado fecha, o que dá cerca de 5 toques extras.
- Impacto: cadastro mais lento e cansativo no celular; é o funil de entrada.
- Causa raiz: foco só no avanço por Enter.
- Correção recomendada: focar o novo campo também no toque; medir em aparelho.
- Critério de aceite: o teclado fica aberto entre os passos do cadastro.
- Dependências: nenhuma
- Origem: C3-018 (C3)

### AUD-206 — Valor pago não é conferido antes de confirmar o impulso

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: provável
- Onde: `web/supabase/functions/webhook-pagamento/index.ts:43-45` (confirma por `status==='approved'` + `external_reference`); `confirm_boost_payment(p_payment_id)` sem valor
- Prova: leitura do código.
- Impacto: hoje a cobrança nasce no servidor com o valor do plano; qualquer falha futura libera impulso por valor menor.
- Causa raiz: o valor pago não é comparado ao esperado.
- Correção recomendada: `confirm_boost_payment(p_payment_id, p_amount_cents, p_provider_payment_id)` com BC409 se não bater, antes de ligar o Mercado Pago.
- Critério de aceite: valor menor → BC409 e pagamento segue `aguardando`.
- Dependências: nenhuma
- Origem: D2-016 (D2)

### AUD-207 — `feed_jobs` não usa `blocked_between`; só o app filtra bloqueados

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261016000400_lanc13_mural_volume.sql:24-89`
- Prova: leitura da função.
- Impacto: outro cliente (ou o link) vê vagas de quem bloqueou.
- Causa raiz: filtro só no front.
- Correção recomendada: acrescentar o filtro no servidor.
- Critério de aceite: teste SQL: conta bloqueada não vê a vaga no `feed_jobs`.
- Dependências: nenhuma
- Origem: D3b-013 (D3b)

### AUD-208 — Roteiro de aplicação na produção: dados atuais não correm risco, mas há 9 colunas apagadas sem volta, 2 funções removidas e ordem rígida

- Área: processo
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado (contagens na produção e no staging)
- Onde: `u06` (`drop function close_job`), `u12` (`drop column workers.oficio_id, specialties, companies.tipo_obra`), `u32` (`availability, years_experience, desired_pay, travel_km`), `u63` (`companies.contact_name`), `u65` (`drop function feed_jobs(12 args)`), `u62` (`delete from addresses` de empresas), `u10` (zera WhatsApp repetido), `u37` (limpeza de logins Google sem conta)
- Prova: produção (`ppnxdajiihsjaojxokzh`, só `count(*)` e catálogo): última migration aplicada `20261012033541`; faltam as 25 do repositório. Contagens: `jobs` 0, `reviews` 0, `reports` 0, `job_alerts` 0, `accounts` 4, `workers` 1, `companies` 3; trabalhadores com ofício/especialidades preenchidos 0, com os 4 campos do U33 preenchidos 0, `bio` > 500 caracteres 0, empresas com `tipo_obra` ou `contact_name` 0; WhatsApp repetido 0; empresas "Construtora (conta excluída)" 0; contas sem e-mail confirmado 0. Pré-requisitos presentes: gatilho `touch_job_v2` em `jobs` e `area_lat` gerada (o bloco do U51 depende dos dois). Staging: as 67 versões e os corpos finais conferem com o repositório (consulta de assinatura em 12 funções e objetos: `feed_jobs` com 13 argumentos, gatilho `jobs_area_point`, índice `accounts_whatsapp_key`, `account_prefs` no Realtime, `close_job` ausente).
- Impacto: aplicar em ordem hoje não perde dado nenhum. O risco está no processo: a produção está no plano Free sem backup diário, nenhuma migration tem volta, e o `U24` muda a exclusão de conta para apagar tudo (irreversível) assim que for aplicado.
- Causa raiz: n/a (registro).
- Correção recomendada: antes do "pode": (1) `pg_dump` manual; (2) aplicar em ordem `lanc06 … r04, u01 … u67` (os `u*` usam funções de `lanc06`, `lanc07`, `r03`, `r04`) e só depois publicar as Edge Functions `verificar-cadastro` (precisa de `signup_taken`, U10) e `entrar-com-firebase`; (3) repetir as contagens acima logo antes (se alguém criar dados reais entre hoje e lá, `u10`, `u12`, `u32` e `u63` passam a apagar ou zerar dado de verdade); (4) publicar o app novo junto com o U06/U65 (o app antigo ainda chama `close_job`); (5) rodar `supabase/tests/*.sql` na produção (cada teste termina em `rollback`) e o advisor de segurança depois.
- Critério de aceite: lista acima executada e registrada em `CHECKLIST-LANCAMENTO.md`.
- Dependências: "ação do responsável" (o "pode" e o backup).
- Origem: D3c-009 (D3c)

### AUD-209 — Folgas na CSP e nos cabeçalhos

- Área: segurança
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado
- Onde: `web/public/_headers:8`
- Prova: (1) `connect-src`/`img-src` aceitam `https://*.supabase.co` e `wss://*.supabase.co`: um script injetado enviaria dados para o projeto Supabase de qualquer pessoa; o ideal é o domínio do projeto (a build já conhece `VITE_SUPABASE_URL`; o staging usa outro). (2) `style-src 'unsafe-inline'` (estilos em atributo do React/Tailwind; aceitável, mas o teste só garante script). (3) `frame-src https://*.mercadopago.com https://*.mercadolibre.com https://*.firebaseapp.com`: curingas amplos; o `authDomain` do Firebase pode ser um domínio próprio, que a CSP bloquearia (o teste fixa `bicoapp-6cc68.firebaseapp.com`). (4) sem `report-to`/`report-uri`: violações em produção ficam invisíveis. (5) `Permissions-Policy` bloqueia `payment=()`, mas a Payment Request API não é usada; ok. (6) `Strict-Transport-Security` sem `preload` (decisão válida enquanto o domínio não estiver confirmado).
- Impacto: pouco hoje; reduz o estrago de um XSS futuro e dá visibilidade.
- Causa raiz: um único arquivo estático serve staging e produção.
- Correção recomendada: gerar `_headers` na build com o host do Supabase da própria build; adicionar `report-to` para o Sentry; manter o teste que confere cada diretiva (inclui o AUD-034).
- Critério de aceite: a CSP da build de produção só tem o host do projeto; uma violação deliberada aparece no Sentry.
- Dependências: AUD-034.
- Origem: D4-014 (D4)

### AUD-210 — Não existe "Sair de todos os aparelhos" e a redefinição de senha só encerra a sessão deste aparelho

- Área: segurança
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado (código); o efeito no Auth sobre outras sessões após trocar a senha não foi testado
- Onde: `web/src/services/remote/auth.ts:112` e `web/src/services/remote/session.ts:435,461,514` (todo `signOut({ scope: 'local' })`); `resetPassword` (`auth.ts:376-392`) e `changePassword` (`auth.ts:431-436`)
- Prova: `grep -rn "scope" web/src/services/remote/` só mostra `'local'`; não há `'global'` nem tela que ofereça isso.
- Impacto: quem perde o celular, entrou numa lan house ou teve a senha descoberta não tem como derrubar a sessão aberta em outro aparelho; ela dura até o refresh token ser revogado.
- Causa raiz: o encerramento foi pensado só para o aparelho atual.
- Correção recomendada: botão "Sair de todos os aparelhos" em Configurações (`signOut({ scope: 'global' })`) e chamar o mesmo ao terminar `resetPassword`; confirmar no staging se `updateUser({password})` já revoga as outras sessões.
- Critério de aceite: com duas sessões da mesma conta, "Sair de todos" faz a segunda receber 401 na próxima renovação.
- Dependências: nenhuma.

  ## Referências cruzadas (achados de outros agentes que cobrem pontos da minha frente)
  - Excluir conta não apaga `identidade/` e a limpeza (`limpar-arquivos`) não roda: **AUD-001 e AUD-006**. Prova minha, a somar: `excluir-conta/index.ts:18` lista só `avatars`, `portfolio`, `vagas`; `query_logs` da produção em 24 h tem 1 chamada, `limpar-arquivos` → 401 (cron das 04:40, sem `CLEANUP_SECRET`).
  - Limpeza apaga tudo se `app_config.storage_public_base` estiver errado, sem freio de proporção: **AUD-133** (a RPC `orphan_storage_objects` e a função `limpar-arquivos` não têm trava; minha correção sugerida: abortar e alertar se os "órfãos" passarem de ~20% dos objetos).
  - Conta suspensa ainda grava até o token vencer: **AUD-022 / AUD-022**. Confirmei que `admin_suspend_account` põe `banned_until` +100 anos e apaga `auth.sessions` (login e renovação recusados).
  - Hash SHA-256 do documento sem segredo: **AUD-019** (também vale para as chaves `doc:` de `auth_attempts`).
  - Coordenadas da casa para o OSRM: **AUD-014 / AUD-014** (na CSP, `router.project-osrm.org` e `routing.openstreetmap.de` estão liberados em `connect-src`, coerente com o código).
  - Falha de rede em Edge Function vira "Não deu certo agora": **AUD-130 / AUD-130** (o lado do navegador do meu AUD-141).

- Origem: D4-015 (D4)

### AUD-211 — Política em linguagem jurídica para um público de celular simples

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:134-141` ("legítimo interesse, art. 7º, IX", "art. 11, I"), seção 5 (lista longa de operadores numa só linha)
- Prova: CLAUDE.md §1: "Texto curto, direto… sem jargão. Isso pesa mais que estética". A política tem 10 seções e cita artigos de lei no meio do texto.
- Impacto: baixo risco legal, mas consentimento e transparência valem só se a pessoa entende (art. 9, §1º); o ganho é menos pedido ao suporte e mais confiança no cadastro.
- Causa raiz: —
- Correção recomendada: no topo da política, um quadro de 6 linhas ("O que guardamos / por quê / quem vê / por quanto tempo / como apagar / com quem falar") e os artigos de lei para o fim, em "Bases legais". O advogado revê junto com AUD-016.
- Critério de aceite: o quadro existe nos dois lugares (`legal.ts` e `/legal/*.md`); teste de legibilidade manual com 3 pessoas.
- Dependências: AUD-016.
- Origem: D5-021 (D5)

### AUD-212 — Melhoria: matriz de fusos e medição de cobertura no CI (agora)

- Área: testes
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml` (job `checks`, passo `npm test`)
- Prova: o CI roda `npm test` uma vez, em UTC; o AUD-127 só aparece com `TZ=Asia/Tokyo` ou entre 21h e 24h no Brasil. Não há `--coverage` no CI (medi numa cópia: `@vitest/coverage-v8@3.2.7`, 12 s).
  - Impacto/ganho: pega o erro de data antes do usuário (o app guarda "o dia" no fuso do aparelho, e a empresa e o trabalhador podem estar em fusos diferentes ou o celular com o fuso errado); mostra para onde vão os próximos testes.
- Impacto: —
- Causa raiz: —
- Correção recomendada: `strategy.matrix.tz: [UTC, America/Sao_Paulo, Asia/Tokyo]` no passo `npm test`, mais `vitest run --coverage` com piso por pasta (services 80%).
- Critério de aceite: passo `npm test` rodando nos três fusos.
- Dependências: AUD-127
- Origem: O2-011 (O2)

### AUD-213 — Deixar ver bicos antes de criar a conta

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: M
- Confiança: confirmado
- Onde: `pages/shared/Splash.tsx:4-25`; `/v/:id` só abre com link
- Prova: print 00 (só "Bicos e diárias perto de você. Sem taxa para o trabalhador.", "Entrar" em destaque e "Criar minha conta" apagado, para quem é novo); 14 toques, 11 campos e código de e-mail antes do 1º bico (`caminho.md`).
- Impacto: ganho: conversão do cadastro; vitrine para vender à empresa no piloto (o iFood mostra a lista antes do login).
- Causa raiz: tudo exige conta.
- Correção recomendada: "Ver bicos perto de mim" (cidade em 1 pergunta) com lista pública só bairro/cidade (regra do `public_job_card`); "Criar minha conta" vira o principal.
- Critério de aceite: visitante vê a lista pública sem conta.
- Dependências: AUD-007, AUD-002 (decidir o que é público)
- Origem: P1-013 (P1)

### AUD-214 — Endereço completo só depois do primeiro bico

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: M
- Confiança: confirmado (prints 57–59)
- Onde: `pages/shared/CompleteProfile.tsx:207-236` (CEP, cidade, rua, bairro obrigatórios)
- Prova: após o código do e-mail, 4 campos e 3 toques de sugestão antes de ver qualquer vaga.
- Impacto: ganho: menos abandono no último passo; conta sem endereço já usa a cidade do perfil (U51).
- Causa raiz: endereço obrigatório no cadastro.
- Correção recomendada: pedir o endereço ao tocar na distância ou na 1ª candidatura.
- Critério de aceite: cadastro sem endereço chega ao mural.
- Dependências: decisão dos sócios
- Origem: P1-014 (P1)

### AUD-215 — Linha do tempo da candidatura (padrão do pedido do iFood)

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: M
- Confiança: confirmado
- Onde: `pages/worker/ApplicationStatusCard.tsx:9-31`; `utils/applicationStatus.ts:388-390` (`enviada` e `em_analise` iguais: "Em análise")
- Prova: prints 20 e 24: texto "Enviada hoje, 14h16 / Pré-selecionado desde…", sem passos nem "falta a empresa responder".
- Impacto: ganho: menos "e aí?" no suporte e motivo para voltar ao app.
- Causa raiz: status sem progresso visual.
- Correção recomendada: passos Enviada → Vista → Aprovada → Concluída com hora.
- Critério de aceite: card mostra os passos.
- Dependências: nenhuma
- Origem: P1-015 (P1)

### AUD-216 — "Chamar de novo" quem trabalhou bem

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: M
- Confiança: confirmado
- Onde: `pages/recruiter/JobClosed.tsx` (resumo); `pages/shared/WorkerProfileScreen.tsx:200` (único "Convidar para uma vaga"); `MyJobs.tsx:221-229` ("Publicar de novo" só como ícone ↻ 36–40 px)
- Prova: print 100 (resumo de vaga encerrada): a equipe mostra nome e "Avaliar", sem link para o perfil; `rg -i "favorit|recontrat|chamar de novo"`: nada; não achou outro caminho até o perfil de um trabalhador de vaga já encerrada.
- Impacto: ganho: 2ª vaga em menos de 1 minuto ("Quem já trabalhou com você: Ana, João — chamar") e retorno da empresa e do trabalhador que foi bem.
- Causa raiz: sem recontratação.
- Correção recomendada: bloco "Quem já trabalhou com você" na criação de vaga e no resumo da vaga encerrada.
- Critério de aceite: da vaga encerrada chega-se ao convite em 2 toques.
- Dependências: nenhuma
- Origem: P1-017 (P1)

### AUD-217 — O alerta "Avisar quando aparecer bico novo" vira passo do cadastro e do mural vazio

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado (print 12)
- Onde: `pages/worker/feed/FeedSheets.tsx:115-163` (último item da folha Filtros)
- Prova: só aparece rolando a folha; em nenhum outro lugar. Sem push só chega ao sino (AUD-049).
- Impacto: ganho: único gancho de "voltar amanhã" já pronto; no piloto, com mural vazio, mantém o trabalhador inscrito.
- Causa raiz: recurso escondido.
- Correção recomendada: oferecer o alerta no mural vazio e no fim do cadastro.
- Critério de aceite: mural vazio mostra o botão do alerta.
- Dependências: AUD-030, AUD-049
- Origem: P1-018 (P1)

### AUD-218 — Card do mural mais denso e informativo

- Área: UX
- Severidade: M melhoria (agora)
- Esforço: M
- Confiança: confirmado (print 10)
- Onde: `components/JobTile.tsx:87-112`, grade de 2 colunas
- Prova: 2 bicos por tela a 360×800; a capa ilustrada ocupa ~60 % do card; títulos cortados ("Garçom para almoço e…").
- Impacto: ganho: comparar 4–6 bicos por rolagem; some a necessidade de abrir a vaga para saber quem contrata.
- Causa raiz: card de capa grande.
- Correção recomendada: capa 16:9 quando só há ilustração; nome da empresa no card.
- Critério de aceite: ≥ 4 bicos por tela em 360×800.
- Dependências: AUD-047
- Origem: P1-019 (P1)

### AUD-219 — Candidatura em um toque com "Desfazer"

- Área: produto
- Severidade: M melhoria (agora)
- Esforço: P
- Confiança: confirmado (prints 20b–23)
- Onde: `pages/worker/JobDetail.tsx:123` → `ConfirmApplication.tsx:104-111` → `ApplicationSent.tsx`
- Prova: 3 toques e 3 telas do card à candidatura; a tela do meio repete título, valor e data.
- Impacto: ganho: um passo a menos no momento de maior valor (padrão WhatsApp/Nubank: ação direta + Desfazer; cancelar já existe, `JobDetail.tsx:474-488`).
- Causa raiz: confirmação em tela separada.
- Correção recomendada: candidatar com um toque e "Desfazer" por alguns segundos.
- Critério de aceite: candidatura do detalhe em 1 toque.
- Dependências: AUD-027
- Origem: P1-020 (P1)

### 5.2 Potenciais futuros (3)

### AUD-220 — Descrição livre da vaga vai ao link público sem filtro de contato

- Área: produto
- Severidade: M melhoria (futuro)
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/PublicJob.tsx:160-171`; `supabase/migrations/20261016000200_lanc10_link_publico.sql:77`
- Prova: a tela diz "O contato aparece para quem a empresa aprovar", mas `public_job_card` devolve `description` inteira e nada valida telefone no texto.
- Impacto: uma empresa pode colocar o telefone na descrição e contornar a regra do WhatsApp só após aprovação (e o aplicativo perde a mediação).
- Causa raiz: descrição livre sem filtro.
- Correção recomendada: aviso ao escrever a descrição ("não coloque telefone aqui").
- Critério de aceite: aviso visível no campo de descrição.
- Dependências: decisão dos sócios
- Origem: C3-019 (C3)

### AUD-221 — Pagamento fora do app sem "recebi" e sem renda acumulada

- Área: produto
- Severidade: M melhoria (futuro)
- Esforço: G
- Confiança: confirmado
- Onde: `pages/worker/JobDetail.tsx:219`, `Selected.tsx:94-97`, `components/ReviewForm.tsx` (etiqueta "Pagou no dia")
- Prova: o perfil do trabalhador mostra só "23 bicos realizados" (print 31); não há "Recebi"/"Paguei".
- Impacto: ganho: "você fez R$ X este mês" (motivo para voltar) e medição de calote (dado para confiança e para um futuro pagamento garantido).
- Causa raiz: o dinheiro não passa pelo app.
- Correção recomendada: botão "Recebi" / "Paguei" depois da diária e resumo de renda.
- Critério de aceite: renda do mês visível no perfil.
- Dependências: decisão de negócio
- Origem: P1-021 (P1)

### AUD-222 — Prova social ("Pagou no dia 12 de 14") no detalhe da vaga e no card

- Área: produto
- Severidade: M melhoria (futuro)
- Esforço: M
- Confiança: confirmado
- Onde: `components/JobTile.tsx`, `pages/shared/CompanyProfileScreen.tsx`; `COMPANY_TAGS` em `services/reviews.ts`
- Prova: a etiqueta "Pagou no dia" é coletada, mas só aparece nas avaliações do perfil.
- Impacto: ganho: a informação que o trabalhador mais quer antes de ir (padrão nota + nº de avaliações do iFood/Uber).
- Causa raiz: dado coletado e não exibido onde se decide.
- Correção recomendada: mostrar "Pagou no dia: X de Y" no detalhe da vaga e no card.
- Critério de aceite: indicador visível no detalhe.
- Dependências: nenhuma
- Origem: P1-022 (P1)

## 6. O que está bom e deve ser preservado

Itens que estão certos e que a rodada de correção **não pode estragar** (cada bloco vem do agente indicado; os testes e provas citados estão em `web/docs/auditoria/por-agente/`).

### C1 — serviços (conta, vagas, candidaturas, auth)

- `applicationMachine.ts` é a única tabela de transições; `transition()` lança `conflito` com texto simples e `autoRejected` é recalculado a cada transição (nenhuma ação deixa o marcador preso). O lado TypeScript bate com o banco (M1, `maquina.md`).
- `remote/client.ts` + `request()` traduzem todo erro para `ServiceError` com os códigos `BC401/404/409/422`; `remote/applications.ts`, `remote/jobs.ts` e `remote/actions.ts` nunca deixam passar mensagem técnica do PostgREST para a tela (o `message` só vem das RPCs, escritas em português).
- `toggleSavedJob` real: insert simples, aceita `23505` como "já salva" e desfaz o estado otimista no erro (`remote/jobs.ts:55-74`); `deleteJob` já isola a releitura com `.catch` (modelo para AUD-027).
- `signOut` real nunca falha por rede (`remote/auth.ts:107-114`: `scope: 'local'` com `catch` e `leaveSession()`), inclusive depois de `excluir-conta`.
- `contacts.ts`: o número só sai por `get_contact`, a chave do cache inclui conta + candidatura + situação e é limpa no `leaveSession` (`remote/session.ts:343`).
- `remote/address.ts`: toda entrada do usuário vai para a URL com `encodeURIComponent` e o CEP só entra depois de reduzido a 8 dígitos; a política de privacidade já lista BrasilAPI, ViaCEP e OpenStreetMap (`legal.ts:147`). O cache por URL e o `unlessAborted` evitam pedidos repetidos a cada letra.
- `admin.ts` + `remote/admin.ts`: nenhuma regra no navegador (tudo `admin_*` com `staff_guard`); os nove rótulos de `ACTION_LABELS` batem com os `staff_log(...)` do SQL; no demo todas as funções lançam `nao_autorizado`.
- `busy.ts`: todo bloqueio tem prazo (`maxMs`) e `end()` é idempotente; `startBusy` publica o estado de forma síncrona (`isBusy()` vê o segundo toque).

### C2 — serviços (store, sessão, Storage, Sentry)

- `build/env.ts` + `vite.config.ts`: build de produção falha com variável faltando e com `{{…}}`/`LEGAL_REVIEWED=false` nos textos legais (só `BICOS_PILOTO_SEM_REVISAO_JURIDICA=1` libera o rascunho, nunca os campos em branco). Em `--mode e2e` só avisa (conferi: build gerado com 2 avisos).
- `leaveSession` limpa cache da conta, Realtime, store, cache de contatos, consultas, paginação e histórico; `clearSessionData` zera também o `ui` (nada digitado vaza para o próximo). Só falta a defesa contra respostas atrasadas (AUD-029).
- `enterSession` com leitura única por usuário (X20) e `enterNewAccountSession` (U40); `request()` converte "permission denied sem login" em fim de sessão (R08).
- O service worker só guarda fotos públicas (`runtimeCaching` em vite.config.ts); nenhum dado de API/Auth fica no cache do navegador após trocar de conta.
- `monitoring.ts`: ordem das regras (token antes dos números), limite de 20 eventos, nomes de arquivo sem query, `extra`/`tags`/`value` todos passam por `scrubText`; sem SDK, sem breadcrumbs, sem URL completa, sem usuário.
- Upload: caminho `<uid>/<tempo>-<aleatório>.<ext>`, `x-upsert: false`, limite de tamanho no cliente e no bucket, compressão para ≤1600 px (remove EXIF no caminho normal), HEIC só sob demanda, selfie/documento em bucket privado.
- Códigos de erro `BC401/404/409/422` e `PG_CODES` traduzidos; mensagens em português simples; `invokeFunction` usa o código e a mensagem que a função mandou.
- `setTheme` desfaz a mudança local quando o servidor recusa; a flag de recuperação de senha persiste para não virar login (X11) e tem teste.
- `router.ts`: o hash com tokens é limpo antes de o roteador subir; `safeDecode` evita queda com `%` solto; `busy.ts` limita o travamento a 30 s, então o botão "voltar" nunca fica preso para sempre.

### C3 — telas compartilhadas

- Senhas só em `useState` local; rascunho do cadastro apagado ao sair; store zerado ao trocar de conta (`store.ts:140-153`).
- Login com mensagem única para credencial errada, `<form>` real para gerenciador de senhas e retorno ao link de origem.
- Cadastro com dígitos verificadores de CPF/CNPJ, checagem de duplicidade por passo, `useBusyWhile` contra toque duplo, `useInnerBack` e `refused()` genérico.
- "Esqueci a senha" sempre responde "Link enviado". `ResetPassword` encerra a sessão curta se a pessoa sair.
- `DeleteAccount`: prova por senha ou código, prévia do impacto, caixa de confirmação mais diálogo.
- `PublicJob`: só entra por slug aleatório, link antigo só logado, flag `alive`. `CodeInput` com `one-time-code`.
- Nenhum `console.*`, `localStorage`, `dangerouslySetInnerHTML` ou import de `data/` nas 35 telas. O único `target=_blank` (`Help.tsx:128`) tem `rel="noopener noreferrer"`. Sem `any`, `@ts-*` ou TODO.
- Perfis, Notificações, Bloqueados e Avaliações usam `ScreenLoading`/`QueryView` (padrão B10).

### C4 — telas do trabalhador, da empresa e /admin

- `useAction`: anti-toque duplo e o formulário não se perde em erro.
- Status da candidatura exaustivos pelo compilador (`candidateBadge`/`statusInfo`), e `CandidateActions` trata os 11 status com confirmação onde destrói.
- `decisionToasts` (desfazer por 7 s) e `JobManage.decide` (uma decisão por vez).
- Guardas de `ApplicationSent` (X07) e `ConfirmApplication` (Y07).
- `jobForm.ts` puro: valor em reais inteiros, impulso em centavos, `minSlots`, noite que passa da meia-noite, teto de 60 dias.
- `BoostPayment`: hooks antes dos `return`, intervalos com limpeza, cartão fora do store (Y14).
- `VerifyIdentity`: consentimento com versão.
- `Admin`: o servidor é quem decide o papel de equipe, links assinados de 5 min, recusa sempre com motivo.

### C5 — componentes de UI

- `useModal`: pilha de diálogos, armadilha de Tab, Esc só no topo, foco devolvido.
- `ErrorBoundary` com `key={path}` em `App.tsx:167`.
- `BusyOverlay` com trava de 30 s.
- `AutocompleteField` e `AddressFields`: abort e descarte de resposta velha.
- `Tag` (U66), `JobTile` (X05), `CodeInput`, `ThemeToggle` e `FieldError` com `role="alert"`; `tapTarget.test.ts`.

### C6 — rotas, hooks, utilitários, estilos, tipos

- `routes.ts` `screen()`: promessa marcada como resolvida (render síncrono) e download falho esquecido (Z10); frágil a trocar por `React.lazy`. `services/guards.ts`: guarda pura, onboarding preso ao passo, papel errado vira tela explicativa.
- Datas: `parseISODate` local (nunca `new Date('YYYY-MM-DD')`); `dayLabel/addDays/daysBetween` corretos em `TZ=America/Sao_Paulo` e UTC; `dateTimeLabel/relativeTime` só recebem timestamps. CPF/CNPJ: dígitos e sequências repetidas certos; `formatBRL`; `whatsappUrl` decide o 55 pelo tamanho.
- `useModal` (pilha, trava de rolagem contada, foco devolvido); `useInnerBack/holdBack`; enums de `models.ts` = banco gerado; `cidades.ts` íntegro (5.571 linhas, 27 UFs, sem nome+UF repetido; só Noronha fora de lon ≤ -34, já em D3c); seed sem vocabulário de obra/EPI; nenhum link do código aponta para rota inexistente e nenhuma rota é órfã; parâmetros inválidos (`/cadastro/xyz`, `/avaliacoes/xyz/1`) caem em padrão seguro.

### M1 — máquina de status e paridade demo × real

- A tabela de transições está idêntica nos dois lados e tem teste nos dois (`applications.test.ts` e `r03_suspensao_completa.sql` comparam as mesmas 21 linhas). Quem mexer em uma ação precisa mexer nos dois testes.
- Toda decisão sobre candidatura passa por RPC `security definer` que trava a vaga (`for update`) antes de contar posições: aprovação dupla, candidatura dupla, excluir × candidatar e desfazer × aprovar não furam a lotação. `authenticated` só tem SELECT em `applications`/`application_events`.
- `job_holding` conta pré-selecionado + contratado + concluída nos três lugares (aprovar, candidatar, mural) e no `job_stats` usado pelo app; a vaga concluída não volta ao mural.
- O front usa `Record<ApplicationStatus,…>` e `switch` exaustivo nos rótulos: um status novo no banco quebra o `typecheck`, não a tela.
- Todas as mensagens de erro das RPCs de candidatura estão em português simples e o demo repete as mesmas frases.

### D1 — tabelas, RLS, grants, Storage

- RLS ligada em todas as 39 tabelas do `public` (staging e produção), nenhuma `for all`, nenhuma política de escrita ampla; as únicas `using (true)` são o catálogo de ofícios (anon) e leitura de perfis/avaliações/portfólio para quem está logado.
- Grants por coluna funcionam: `whatsapp` (workers e companies), `document_hash`, `document_cipher`, `suspended_reason`, `cnpj_check`, `identity_reason`, `hidden_*` dão 42501 para `authenticated`; `anon` só lê `oficios`. Nota, selo e impulso não podem ser alterados por `update` direto (42501).
- Escritas diretas indevidas recusadas: `accounts`, `applications`, `reviews`, `boost_payments`, `jobs` (insert/update/delete) e `notifications` (título, insert, delete); atualizar perfil/post/notificação de outra pessoa afeta 0 linhas.
- Gatilhos `check_*_v2` recusam foto de perfil, capa, logo, post ou foto de vaga fora da pasta do dono no Storage (BC422).
- Legado (`profiles`, `vagas`, `candidaturas`, `avaliacoes`, `vagas_salvas`, `publicacoes_trabalhador`, `consentimentos`): RLS ligada, sem política e sem grant (42501 provado); nenhuma coluna de documento sai.
- Storage: sem política de `select` nos buckets públicos (sem listagem); `identidade` privado, leitura só pela equipe; envio só na própria pasta e só pelo lado certo (trabalhador no `portfolio`/`identidade`, empresa em `vagas`).
- Staging == repositório: 67 de 67 versões; `APLICAR-TUDO.sql` regenerado é idêntico ao do repositório; `database.generated.ts` bate com o banco (39 tabelas, colunas, 147 funções e seus argumentos, 13 enums).
- Advisors do staging: nenhum ERROR; sem `unindexed_foreign_keys`, `auth_rls_initplan`, `multiple_permissive_policies`, `function_search_path_mutable`, nem `extension_in_public`; produção: único `extension_in_public` é `pg_net` (sai com a lanc09), como documentado.

### D2 — RPCs e funções do banco

- ACL mínima: só `public_job_card` para anon; funções de equipe/serviço (`set_*_verification`, `set_identity_status`, `funnel_daily`, `application_step`, `*_boost_payment`, `conclude_finished_jobs`, `orphan_storage_objects`) fora do alcance de authenticated; `search_path` fixo em todas; nenhum overload; 176/176 corpos iguais às migrations.
- `for update` na vaga serializa candidatar/aprovar/editar/excluir/convidar/cobrar; `applications unique(job_id,worker_id)`; índice único parcial de pagamento `aguardando` por vaga; confirmação de pagamento idempotente.
- Paginação por cursor `(rank,chave,id)` do mural testada em `perto/valor/cedo` com impulsionadas, urgentes e sem valor: sem repetir nem pular; `get_contact` confere status, lado e suspensão dos dois; `public_job_card` (slug 31^12, só bairro/cidade, limite por IP); `delete_my_account` exige login recente; `admin_suspend_account` não suspende a si nem equipe.

### D3a — migrations z01…f18

- Nenhuma função `security definer` da lista é executável por anon; as de cobrança, `mark_whatsapp_verified`, `company_cnpj_for_check`, `set_company_verification` e `document_login_email` só têm service_role; todas com `search_path` fixo (as com PostGIS incluem `extensions`).
- Lista de `repair` do APLICAR.md exata (script): 41 "applied" = arquivos até x23; 53 "reverted" = versões da produção; a ordem #1–#63 bate com os arquivos; 25 pendentes na produção (lanc06…u67). O staging tem as mesmas versões dos arquivos.
- Enums novos usados só em `plpgsql` (z02, y01, y24, y28, f12): é o que permite a transação única do `APLICAR-TUDO.sql`.
- z09 (documento fora dos metadados do Auth), z02 (pagamento idempotente e revalidado), Storage sem listagem, contrato `BC4xx` mantido, algoritmos de CPF/CNPJ conferidos à mão.

### D3b — migrations f09…r04, legado, pendentes

- Grants/guard de toda RPC `admin_*` (testes lanc06 provam 42501 nas auxiliares).
- Colunas sensíveis sem grant (`suspended_reason`, `hidden_reason`, `cnpj_check`, `identity_reason`).
- Tabelas e 21 funções do app antigo fechadas na produção (RLS ligada, sem política, sem execute).
- Storage sem listagem pública; chave do Vault do staging não é a de exemplo do baseline.
- Horários dos 7 crons sem conflito; `last_day` = `job_last_day` no staging; `pg_net` no staging em `extensions`.
- Mensagens do banco já dizem "empresa/local".

### D3c — migrations u01…u67

- **U48 é cópia fiel**: comparei as 13 funções com a última definição anterior (script `work/funcdiff.py`): a diferença é só de texto (obra/construtora/EPI). Foi uma boa decisão manter a mesma assinatura e os mesmos grants. Frágil: `create or replace` de função inteira só para trocar texto reverte qualquer mudança paralela; sempre diffar antes.
- **Endereço privado do trabalhador**: `addresses` tem RLS própria (`account_id = auth.uid()`), sem `insert/update/delete` para `authenticated` (conferido em `column_privileges`), gravação só por `save_address` (revogada de `public, anon, authenticated`) e leitura de volta em `export_my_data`. O perfil público guarda só a cidade e o ponto a 0,01° (`save_address`, testado em `u51`).
- **Limites do app e do banco batem**: preço R$ 80–5.000 (`jobForm.ts` ↔ `job_from_draft`; o CHECK da tabela é mais folgado, até 100.000, como segunda trava), título 60, descrição 20–1000, pessoas 1–50, diárias 1–60, bio e "sobre" 500, experiências 10×(2–80).
- **Busca sem injeção**: `feed_jobs` usa `position()` sobre texto "dobrado" e `regexp_split_to_table` com padrão fixo, sem `LIKE` com entrada do usuário e sem SQL dinâmico; `p_limit` é limitado a 60 e a ordenação usa chave estável com cursor.
- **Migrations idempotentes na prática**: `if not exists`, `create or replace`, `drop … if exists`, blocos `do $$` com `duplicate_object` e guardas por catálogo (U51 conferindo `attgenerated`/expressão antes de mexer); o único `delete` em massa (U62) tem `where` por junção de papel; o `update` de dados do U48 tem `where` por texto.
- **U30/U32/U62/U65**: RLS própria com `(select auth.uid())`, `revoke` + `grant` explícitos, e no U65 a função nova recebe de volta o `revoke/grant` depois do `drop`. Compatibilidade com o app aberto antes da versão (`p_min_pay` por último, `p_contact_name` ignorado, `finish_sign_up` aceita o formato antigo).
- **Testes**: `u06` (assertiva por `sqlstate` + mensagem exata), `u51` (negativos `42501`/`BC422`, `anon`, exclusão em cascata), `u52`, `u65` e `u30` testam recusa de papel/anon e não só o caminho feliz.

### D4 — Edge Functions, Auth, CSP, front seguro

- Segredos comparados em tempo constante (`same()` em `enviar-push` e `limpar-arquivos`) e falha fechada sem segredo: captcha sem `TURNSTILE_SECRET` recusa; webhook sem `MP_WEBHOOK_SECRET` dá 401; push sem VAPID dá 503; funções do navegador não sobem sem `APP_ORIGIN`.
- Webhook do Mercado Pago: HMAC sobre `id;request-id;ts` com janela de 15 minutos, leitura do pagamento na API do Mercado Pago (o corpo do aviso não é usado para valor nem status), deduplicação por `(provider, event_id)` com `23505`, aviso liberado se a leitura falhar, `confirm_boost_payment` com `for update` e tratamento do pagamento tardio e da vaga já fechada. Valor cobrado vem do banco, não do navegador (`criar-cobranca/index.ts:56`).
- As RPCs de uso interno (`rate_limit_hit`, `begin/confirm/fail/attach_boost_*`, `document_login_email`, `signup_taken`, `mark_whatsapp_verified`, `orphan_storage_objects`, `company_cnpj_for_check`, `set_company_verification`, `call_storage_cleanup`) só têm `execute` para `service_role` (staging, `pg_proc.proacl`: `anon` e `authenticated` = falso).
- `verifyFirebaseToken` confere `alg` fixo RS256, `kid`, assinatura, `aud`, `iss`, `exp`, `iat`, `auth_time` (≤ 10 min) e `sub`; chaves em cache pelo `max-age`; falha de rede sobe como 502 (fecha). Só aceita `google.com` com e-mail verificado ou `phone`. X31 (senha antiga trocada por uma aleatória) está certo e testado.
- Storage: políticas por pasta `<uid>/` em todos os buckets, limites de tamanho e tipos por bucket (imagens; vídeo só no portfólio), `identidade` privado e lido só por `is_staff()`, sem listagem; `orphan_storage_objects` cobre todas as colunas que guardam URL de arquivo (conferi o esquema).
- CSP de script sem `unsafe-inline`/`unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`; a build tem um único `<script type="module">` (nada inline); o app em demonstração carrega 8 rotas sem violação sob a CSP (`$SCRATCH/o1work/d4/csp-app.mjs`); HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` e COOP compatível com a janela do Google.
- Front: nenhum `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `postMessage`; todo `target="_blank"` com `rel`; `window.open` com `noopener`; links de WhatsApp montados só com dígitos; nenhum `?next=`/redirecionamento aberto; o `localStorage` guarda só a própria conta (documento mascarado) e é limpo ao sair; o service worker só guarda fotos públicas (nada de Auth, banco ou funções).
- Segredos: nenhuma chave privada, `service_role`, token `sbp_`/`APP_USR`/`sk_live`, JWT ou DSN em `src`, `public`, `scripts`, `docs`, `supabase`, no `dist-demo` nem no histórico do Git (279 commits, `git log -G`). `.env.*` fora do Git (só os `.example`).
- `deno check */index.ts` (como o CI) e `deno lint` passam, com Deno 2.9.6 (o CI usa 2.5.4).
- Templates de e-mail: HTML só com estilo em linha, sem imagem nem script externos, português claro, variáveis do Auth corretas, avisos coerentes com a configuração (código vale 1 h = `mailer_otp_exp 3600`; cadastro sem confirmação some em 7 dias = limpeza do banco).
- CORS: origem exata (ou curinga controlado), `Vary: Origin`, `Max-Age` de 2 h, preflight tratado.

### D5 — LGPD

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

### O1 — processo, CI, deploy, docs

- Travas de produção por padrão: configurar-auth.mjs:25, publicar-funcoes.sh:11, aplicar-banco.sh:19-21, volume/rodar.sh:11-13, fotos-vagas-teste.mjs:13, deploy.sh:17.
- deploy.sh: build falha sem variável; trava contra publicar a demonstração (verificado: `dist-demo/assets/*.js` não contém nenhum `https://*.supabase.co`); apaga os `.map`.
- web.yml: prova que o build sem variáveis falha e que o build de produção para com textos legais incompletos; `deno check` das 10 funções; APLICAR-TUDO.sql e tipos "em dia"; testes SQL em imagem fixa; Lighthouse pela mediana de 3; ferramentas fixadas (lighthouse 12.8.2, supabase 2.48.3, wrangler 4.20.0, @sentry/cli 2.39.1, Deno 2.5.4, Playwright 1.56.1).
- staging.yml: aplica no staging ANTES da produção; confere histórico = arquivos; aplicar-banco.sh termina conferindo RLS em todas as tabelas do `public`; `concurrency` sem cancelar a montagem.
- Segredos: nenhum na árvore nem no histórico; `::add-mask::` antes de gravar no `GITHUB_ENV`; staging-fotos.yml e site.yml com `permissions` mínimas; `.gitignore` cobre `.env.*`, `dist-*`, `lighthouse*.json`, `e2e/resultados/`.
- `npm ci` funciona; `npm audit --omit=dev` = 0; pixelmatch/pngjs estão em uso (`scripts/limpeza/comparar.mjs`) apesar do knip.
- X31 e X32 dizem o que ficou de fora e o que fazer antes de publicar; X30 é coerente com CLAUDE.md §9.9 e o passo 1 do IMPLANTACAO. TESTE-MANUAL.md e conferir-funcoes.sh são bons ensaios; falta registrar resultado.

### O2 — testes

- A tabela de transições da candidatura está espelhada nos dois lados com prova automática: `applications.test.ts:21-53` lista as 21 transições `estado -ação/ator-> destino`, e `r03_suspensao_completa.sql:39-45` monta a mesma lista a partir de `application_next_status` no banco. Mudou uma, o CI do outro lado falha.
- `_helpers.sql`/`run.mjs` são estritos: provado no PGlite que `ok(false)`, `ok(NULL)`, `fails` que passa sem erro e `fails` com SQLSTATE diferente derrubam o teste; `run.mjs` exige psql com código 0 mais o marcador "TODOS OS TESTES PASSARAM" e roda tudo em `begin … rollback`.
- A suíte Vitest não depende de ordem: 5 sementes de `--sequence.shuffle`, mais duas combinadas com fusos, e 2 repetições deram os mesmos resultados; não há `skip/only/todo`; nenhum teste usa `Math.random` sem fixar (`services.test.ts:118`).
- `remote.test.ts:1226` prova que o número do cartão digitado nunca sai do navegador (`JSON.stringify(fake.calls)` sem "4111"); `headers.test.ts:75-90` varre o código atrás de endereços externos e confere cada um na CSP; `edgeOrigin.test.ts` varre as funções atrás de `requireAppOrigin()`.
- `fakeSupabase` reproduz regras do banco quando o teste pede (`unique` → 23505, `noUpdate` → 42501), regras que explicam o Z04 (`upsert` em `saved_jobs`, `remote.test.ts:1173-1190`).
- A limpeza do E2E funciona: 0 contas `+e2e-` no staging depois de pelo menos 65 execuções do fluxo 7 (65 linhas `suspender_conta` no log); o E2E usa cabeçalhos iguais aos do app e `CAPTCHA_TESTE` para não contornar o captcha; o fluxo 6 prova o limite de tentativas (6ª = 429) e que a senha certa também é recusada depois.
- O fluxo 4 testa o ciclo inteiro com dinheiro de nota: presença → conclusão → duas avaliações → médias nos perfis (`rating 4`/`5`, `review_count 1`).

### B1 — telas no navegador (visitante, trabalhador)

- Mensagens de erro claras e sem jargão; `inputmode`/`autocomplete`/`type` corretos (CPF numérico, e-mail, tel, `one-time-code`, 16 px).
- Anti-duplicidade no duplo clique em Criar conta, Candidatar, Entrar, Excluir conta, Salvar senha e Publicar post.
- Tratamento offline com mensagem em português sem perder o formulário; candidatura duplicada e vaga encerrada barradas por link direto.
- Exclusão em duas etapas com aviso dos bicos em andamento.
- Guardas de rota (visitante→login com retorno, trabalhador em área de empresa, "Voltar" após sair não reentra).

### B2 — telas no navegador (empresa, equipe)

- Guardas de rota: empresa em área de trabalhador cai em "Essa área é da conta de trabalhador"; visitante-logado vai para /mural; IDs inválidos e vaga alheia dão mensagem, nunca tela branca (varredura de 87 rotas, 0 erro de console).
- Validação da vaga: título só com espaços, CEP curto, nenhum dia marcado, data passada, dia da semana incompatível, hora só no início, hora igual, descrição curta, valor < R$ 80 ou > R$ 5.000, diárias 0/61, pessoas 0/51: todas com mensagem clara em português.
- Publicar offline: "Sem internet. Confira sua conexão e tente de novo." e a vaga não é duplicada ao voltar o sinal.

### P1 — produto e UX

- Cadastro em uma pergunta por tela com "Passo n de 6" e botão fixo (`Signup.tsx:92-154`, print 54).
- Ficha do candidato com nota, "bicos realizados", "0 faltas · 0 desistências", selo "Verificado" (print 85); WhatsApp só depois da aprovação.
- Denunciar/bloquear com motivo "Golpe ou pedido de dinheiro" (`safety.ts:13-20`); "Desfazer" por 7 s ao aprovar/recusar; confirmações com o verbo da ação.
- Estados vazios com chamada para ação; erros do cadastro que dizem o que fazer; "Você não paga nada para se candidatar".
- Link público `/v/:id` com selo "Verificada" e "Entrar para me candidatar / Criar minha conta" (print 91): base do crescimento por WhatsApp.
- Cards sem pílulas nem urgência artificial (U04).

### Q1 — desempenho, acessibilidade, robustez

- axe 4.10.3 com `wcag2a/2aa/21a/21aa/22aa`, incluindo `target-size`: 128 varreduras (31 telas distintas × 360 e 1280 px × claro e escuro) com 0 violações; a sanidade do script foi provada com 3 violações plantadas; Lighthouse a11y, boas práticas e SEO = 100.
- Só teclado: o modal de Filtros recebe o foco, o prende em 40 Tab, fecha com Esc e devolve o foco ao botão (360 e 1280 px).
- Texto grande: sem rolagem horizontal em 12 telas, a 320 px e com fonte 150 % e 200 %.
- Supabase falhando (pendurado, 503 ou recusando a conexão): em ≤ 12 s o app mostra "Sem conexão com a Bicos… Tentar de novo"; sem tela branca (`fail.cjs`).
- `localStorage` e `sessionStorage` bloqueados ou cheios: o app funciona; offline mostra a faixa "Sem internet…".
- Primeira pintura enxuta: `/login` a frio sai com FCP 0,6 s e `load` 2,6 s em 4G lento (211 KB brotli); no 3G (400 kbps, 400 ms) FCP 1,7 s e `load` 5,3 s; CLS 0.
- `_headers`: `/assets/*` imutável por 1 ano, `sw.js`, `push-sw.js` e `manifest` com `no-cache`. Fontes próprias, só `latin`, `font-display:swap`, 2 pré-carregadas. Ícones maskable com zona segura; `og.png` correto.
- Envio de foto: `compressImage` limita a 1600 px e WebP 0,82; `heic2any` só carrega sob demanda e fora do 1º carregamento; o servidor usa Brasília em `bicos_today()`.

### HUNTER — caçador de lacunas (rodadas 1 e 2)

- O gatilho `recount_rating` existe e corrige o arredondamento incremental; `notification_group` é igual no banco e em `enviar-push`; a publicação do Realtime cobre `notifications` e `account_prefs`.
- Os acessos a `localStorage`/`sessionStorage` estão todos em `try/catch`; `fold_text` cobre todas as letras do português.
- A verificação do token do Firebase está coerente (iss, aud, exp, auth_time, provedor); `set_job_photos` é validada pelo gatilho `check_job_photos_v2` (máx. 8 fotos, URL do próprio bucket).
- As licenças de produção são permissivas (MIT, ISC, Apache-2.0, BSD-2, OFL, 0BSD); o `<script>` inline do `index.html` é removido no build (a CSP não precisa de `unsafe-inline`); `companies.cnpj` fica mascarado.
- `services/router.ts`, `guards.ts` e `supabase.ts` lidos por inteiro sem defeito.

## 7. Hipóteses não confirmadas

Suspeitas que **não** foram provadas. Nenhuma está na lista de achados. Quem corrigir deve confirmar antes de agir.

### C1 — serviços (conta, vagas, candidaturas, auth)

- H1 — Salvar vaga (coração) tocado duas vezes rápido: `toggleSavedJob` real (`remote/jobs.ts:55-74`) lê `wasSaved` do estado otimista e dispara `insert` e `delete` ao mesmo tempo, sem trava por vaga (`feedback.ts:8-12`, e as 3 telas que chamam). Se a rede reordenar os dois pedidos, o servidor fica "salva" e a tela "não salva" até recarregar. Faltou prova: o falso Supabase atende em ordem; só reproduz com rede real.
- H2 — Entrar com o Google _sem_ Firebase (`auth.ts:415-424`): `startBusy({message:'Abrindo o Google…'}, {maxMs: 10 min})` sem botão "Cancelar", com o app `inert` e o botão voltar bloqueado (`router.ts` consulta `isBusy()`); nada trata `pageshow`. Se o navegador restaurar a página do cache ao voltar da tela do Google, a pessoa pode ficar presa até 10 min. Faltou prova: depende do navegador e de o build de produção não ter `VITE_FIREBASE_*` (o CHECKLIST U28 trata Firebase como pendente de console).
- H3 — `locateMyCity` (`cities.ts:78-90`) devolve o município _mais próximo_ do GPS sem limite de distância: fora do Brasil (ou com GPS impreciso na fronteira) escolhe uma cidade brasileira distante. Faltou prova de uso real fora do país; baixa probabilidade no piloto.
- H4 — `signUp` guarda a senha em claro em memória (`pendingSignUp`, `auth.ts:189,198`) até confirmar o e-mail, para o "Trocar e-mail" (U11/U43, decisão documentada). Não foi achado nenhum caminho que a grave ou envie ao Sentry (`monitoring.ts` limpa ids; não olhei o conteúdo de todas as mensagens de erro). Risco só com extensão/XSS; fica como lembrete de higiene.
- H5 — `markAllNotificationsRead` (`remote/actions.ts:22-32`) atualiza o servidor com `read_at is null` e a tela com _todos_ os avisos do store; um aviso que chegue por tempo real entre os dois passos aparece lido na tela e não lido no servidor até a próxima leitura do número do sino. Impacto mínimo; faltou prova de ordem real.
- H6 — Já registrado em M1 (H5): o corpo demo de `significantChanges` (`jobs.ts:123-150`) trata a vaga antiga sem `weekdays` como "mesmos dias", mas o banco compara com `NULL` (M1 H5). Não repito; só confirmo que o lado TypeScript tem o comentário (U52) e o SQL não.

### C2 — serviços (store, sessão, Storage, Sentry)

- H1 — `startRealtime` é chamado sem esperar (`void startRealtime(account)`, session.ts:305): dois `loadSession` seguidos (ex.: `finishSignUp` + evento `USER_UPDATED`) poderiam passar juntos por `await stopRealtime()` com `channel` nulo e deixar um canal e os ouvintes `online`/`visibilitychange` do primeiro sem remover. Não consegui provocar; o efeito seria avisos duplicados e requisições a mais.
- H2 — `handleAuthRedirect` liga `setRecovering(true)` (e grava `bicos.recuperacao`) antes de `setSession` (session.ts:371-373). Se `setSession` falhar com tokens de recuperação inválidos num aparelho que já tem uma conta logada, a flag fica e a próxima abertura desloga essa conta (caminho do X11). Não reproduzi; exige link com tokens presentes mas inválidos.
- H3 — Um `SIGNED_IN` de OUTRA conta vindo de outra aba (ex.: link de confirmação aberto no mesmo navegador) chama `enterSession` sem `leaveSession` (session.ts:573-579): ficam no store as fatias da conta anterior (a causa raiz de AUD-029 também se aplica). Não reproduzi.
- H4 — Paginação por `lte` + ids vistos (`nextPage`, remote/data.ts:292-301): se mais de 30 linhas de uma mesma conta tiverem o mesmo `status_changed_at`/`created_at` (atualização em lote do cron), "Carregar mais" repetiria a mesma página. Improvável por conta; não reproduzi.
- H5 — Sentry: `monitoring.ts` usa o endpoint legado `/api/<id>/store/`, que a Sentry marca como descontinuado (pode deixar de aceitar); e `crypto.randomUUID()` (l.124) não existe em Chrome <92 mas o build é `es2020`: nesses aparelhos `reportError` lançaria dentro dos ouvintes globais. Sem aparelho para testar.
- H6 — O mural esconde empresas bloqueadas só no cliente (`notBlocked`, safety.ts:29; `feed_jobs` em u65 não menciona `blocks`): uma página de 30 vagas pode vir quase toda escondida e `hasMore` continua verdadeiro. Não medi.
- H7 — `warmUpSignIn` (firebase.ts:96-101) chama `entrar-com-firebase` com `{aquecer:true}` a cada ≥3 min por aba; se a função contar essa chamada no limite de 20/IP em 15 min (não li o código da função, fora da minha lista), IPs compartilhados de operadora poderiam bloquear logins reais.
- H8 — `signIn` com e-mail/senha de um usuário do Auth sem linha em `accounts` lança `MissingAccountError` (não é `ServiceError`) e a tela mostra o texto genérico; só no próximo recarregamento aparece "Não achamos o cadastro dessa conta" (session.ts:437). Caso raro (o gatilho cria `accounts` junto com o usuário).
- H9 — `enablePush` reaproveita `getSubscription()` existente (push.ts:63): depois de uma troca de chave VAPID a assinatura antiga continuaria sendo salva e nenhum aviso chegaria. Só importa quando houver rotação de chave.

### C3 — telas compartilhadas

- H1: conta só-Google sem senha em `ChangeEmail`/`ChangePassword` (exigem a senha atual; só `DeleteAccount` usa `accountHasPassword`). A U37 já cria senha no cadastro por Google, então só contas antigas seriam afetadas.
- H2: `DeleteAccount`. Se a função apagar a conta e a resposta se perder, uma nova tentativa dá "Senha incorreta". Depende de AUD-130.
- H3: download da exportação (`Blob` + `<a download>`) em iPhone/PWA.
- H4: `EditWorkerProfile` salva em 3 passos sem transação. A nova tentativa funciona, então não há perda de dado.
- H5: `NotificationSettings.tsx:52` (`muted: on ? [] : [...]`) sobrescreve a lista. Hoje só existe um grupo na tela.
- H6: o cadastro revela se e-mail, CPF ou WhatsApp já têm conta. É decisão documentada (U10, com limites); a mensagem final é genérica de propósito.
- H7: `/entrar-celular` não tem botão em lugar nenhum. É decisão documentada (DECISOES l.1988), não bug.

### C4 — telas do trabalhador, da empresa e /admin

- `workerOf`/`companyOf` (`selectors.ts:53-63`) lançam `Error` dentro do render. Hoje `workers` e `companies` são legíveis por qualquer conta logada (`using (true)`), então só quebra se um carregador esquecer de trazer a linha.
- `ContactButton` só relê o contato quando muda `applicationId`, então o texto do `wa.me` fica o da fase anterior depois de contratar na mesma tela (ver AUD-091).
- O switch "Avisar quando aparecer bico novo" promete notificação, mas com push desligado ela só existe no sino dentro do app.
- A contagem do PIX usa o relógio do aparelho contra `expiresAt` do servidor.
- O mural monta os layouts de celular e de computador ao mesmo tempo, com DOM duplicado (não medido).
- `Selected.tsx:106-111` mostra "Carregando o endereço…" para sempre se a vaga não tiver rua.

### C5 — componentes de UI

- H1: o `onError` do Brick do Mercado Pago marca falha mesmo em erro não fatal.
- H2: regiões `aria-live` que já nascem com texto podem não ser anunciadas.
- H3: o crédito do mapa é só "© OpenStreetMap", sem link.
- H4: `scrollTo` suave ignora `prefers-reduced-motion`.
- H5: `app.inert` não existe em navegadores antigos.
- H6: o `Sheet` usa `85vh` em vez de `dvh`.

### C6 — rotas, hooks, utilitários, estilos, tipos

- H1 `utils/media.ts:68-85` `videoSeconds` sem prazo: se o iOS (economia de dados) não disparar `loadedmetadata`/`error`, "Publicar trabalho" espera para sempre. Sem iPhone para testar.
- H2 `hooks/useAction.ts:36-41`: `onSuccess` roda dentro do `try`; se lançar, ação que deu certo aparece como erro (latente: os 50 usos só chamam toast/navigate).
- H3 `hooks/useModal.ts:27-31` filtra por `offsetParent`; filhos `position: fixed` ficam fora do Tab.
- H4 `useAddressEditor.ts:38-47` `setDraft(r.draft)` após `await` pode sobrescrever digitação durante a consulta.
- H5 `useTextField.ts:6`: autofoco só na primeira tela do documento.
- H6 `runQuery` + `clearQueries`: resposta tardia entre contas (AUD-029).

### M1 — máquina de status e paridade demo × real

- H1 — Vaga "a combinar" + contratado: o sistema conclui a diária sozinho 32 dias depois de **publicada** (`job_last_day` = criação + 30; `+2`), mesmo que a data combinada com o trabalhador seja depois disso. Está dentro do Y04/Y02 ("a combinar vence 30 dias depois"), então não é bug; o risco é concluir (e pedir avaliação, somar `jobs_done`) um bico que ainda não aconteceu. Prova faltando: nenhuma vaga real "a combinar" com contratação tardia; reproduzível no SQL (`update jobs set created_at = now() - interval '33 days'`) mas é decisão de produto.
- H2 — Deadlock cron × ação do usuário: `conclude_finished_jobs` (1º laço) trava a candidatura e depois a vaga; `transition_application`/`undo_reject`/`delete_job` travam a vaga e depois a candidatura. Só aconteceria se a empresa marcar falta/cancelar a mesma candidatura na hora exata da conclusão automática; o Postgres derruba uma das duas (40P01) e a do cron roda de novo na hora seguinte. Não dá para provar com o conector (uma sessão por chamada).
- H3 — `block_account` não corta o contato por WhatsApp de um bico já aprovado/contratado (`get_contact` não consulta `blocks`; teste staging: continuou abrindo). É a decisão F04 ("contratação já confirmada não é desfeita pelo bloqueio") e o número já foi visto, então não é achado; vale reavaliar se "bloquear por assédio" deveria também cancelar o bico.
- H4 — `admin_suspend_account` de trabalhador **apaga** as candidaturas pendentes (sem evento, sem aviso à empresa; `delete from applications … status in ('enviada','em_analise')`). A empresa vê o candidato sumir; está dito no código ("as candidaturas pendentes saem") mas não no `DECISOES.md` R03.
- H5 — `update_job`/`significantChanges`: para vaga antiga (`weekdays` nulo, `dias='semana'`) o app manda `weekdays` derivado ([1..5]) e o banco compara com `weekdays` nulo → pode avisar "mudou a data" sem a empresa ter mexido nos dias. Sem vaga antiga para testar.
- H6 — A hora do aparelho decide botões como "Marcar diária como concluída" (`jobStarted(todayISO())`) e o selo "Vaga vencida"; o servidor decide por Brasília. Quem usa celular com data errada ou fuso de Manaus/Rio Branco vê o botão errado por algumas horas; o servidor sempre tem a palavra final.
- H7 — `submit_application` numa vaga oculta (acessada com o id) responde "O prazo dessa vaga já passou." (mensagem de prazo para um caso de ocultação); a RLS já esconde a vaga do trabalhador sem candidatura, então só aparece por chamada direta.

### D1 — tabelas, RLS, grants, Storage

- Janela do token de uma conta suspensa (AUD-022): a validade do JWT é configuração do Auth, que não consegui ler; se estiver em 1 hora, a janela é de até 1 hora.
- Tipo de arquivo no Storage: `allowed_mime_types` (`image/jpeg|png|webp`; `video/mp4|quicktime|webm` no portfólio) é checado contra o tipo declarado no envio. Se o servidor não conferir o conteúdo, um HTML enviado como `image/png` seria servido com o tipo declarado (o navegador não o executa). Não testei por falta de rede para o Storage.
- Exclusão de conta (U24, documentada): `terms_acceptances` (prova do aceite) e `reports` (denúncias) saem em cascata com a conta; vale perguntar ao advogado se a prova do consentimento deve ser guardada.
- `saved_jobs`: o trabalhador consegue salvar o id de uma vaga oculta ou excluída (a chave estrangeira ignora a RLS), o que revela só a existência do id; não vaza conteúdo.
- Não consegui rodar, depois que a ferramenta de SQL do staging parou de responder, as consultas de: agendamentos reais do `pg_cron`, privilégios padrão e `search_path` dos papéis, lista de `check`/índices por tabela. Ficaram só pelos arquivos de migration (ver coverage.tsv, linhas `n/v`).

### D2 — RPCs e funções do banco

- Corridas reais (dupla aprovação/candidatura) não reproduzidas: o conector roda uma sessão por vez. Por leitura, `submit_application`, `aprovar`, desfazer, `update_job`, `delete_job`, `invite_worker` e cobrança travam `jobs … for update` antes de contar vagas. Recomendado `pgbench` antes do lançamento.
- `create_my_account` usa `coalesce(auth.users.email_confirmed_at, now())`: se o Auth permitir login anônimo/por telefone sem e-mail (função `entrar-com-firebase`), a conta nasce "confirmada". Config do Auth não legível por SQL.
- `workers.lat/lon` (~1,1 km) + nome/foto de todos os trabalhadores legíveis por qualquer conta logada (grant); AUD-002 cobre só as vagas.
- `whatsapp_verifications` é por número, não por conta (janela de 30 min); `feed_jobs` não esconde vagas de empresa bloqueada.

### D3a — migrations z01…f18

- H1 — `migrations/20261012000200_l22_desfazer_recusa.sql:38`: sem evento `nao_selecionado`, `v_last."by"` e `v_last.at` são nulos, a condição vira NULL e o `raise` não dispara (desfaz fora dos 10 minutos). Só dados migrados do app antigo poderiam não ter evento; não reproduzido.
- H2 — `migrations/20261011000600_y25_whatsapp.sql:25-31,78`: a confirmação vale para o número, não para a conta, por 30 minutos; outra conta poderia pegar o selo se a vítima confirmar naquele momento.
- H3 — `z07:47-53`, `z08:57-64`, `f12:84-91`: sem `pg_cron` o `if exists` pula em silêncio e nenhuma rotina é agendada; não conferiu se o `staging.yml` pega isso.
- H4 — Produção × staging: `claim_document_for`, `confirm_boost_payment` e `document_login_email` têm md5 diferente; a única diferença são comentários SQL (lógica igual). O X16 diz que o conteúdo é "o dos arquivos": igual em lógica, não em bytes.

### D3b — migrations f09…r04, legado, pendentes

- `add_staff_member` sem exigir e-mail confirmado.
- Corrida entre dois decisores (sem `for update`).
- `cf-connecting-ip` chegar ao PostgREST (sem rede ao staging).
- Dono do `drop extension pg_net` na produção.
- Curingas `%`/`_` na busca do `feed_jobs`.
- Reescrita da tabela `jobs` pela coluna gerada `last_day` com volume.
- `ALTER TYPE ADD VALUE` e uso no mesmo `APLICAR-TUDO.sql`.

### D3c — migrations u01…u67

- **`weekdays: [null]` e `lat: "abc"` na vaga**: `job_from_draft` deixa passar `{NULL}` (medido no staging: devolve `weekdays = {NULL}`) e dá `22P02` no `lat` não numérico; o INSERT cairia no CHECK `jobs_weekdays_check` (`23514`). O client traduz `22P02`/`23514` como `validacao` (`services/remote/client.ts:35-36`), então só a mensagem fica genérica e só com chamada feita à mão. Não tratado como achado.
- **`signup_taken('email')`** compara `lower(email) = lower(v)` em `auth.users`: sem índice em `lower(email)` pode varrer a tabela inteira a cada pergunta. Não medido (poucos usuários); o limite de 30 por IP da Edge Function atenua.
- **`terms_acceptances` some com a conta** (`on delete cascade` de `accounts`): a prova de que a pessoa aceitou os termos deixa de existir depois da exclusão. Depende de a política jurídica exigir guardar o aceite por prazo (ação do advogado); relacionado a AUD-163.
- **Pagamentos de impulso apagados com a empresa** (`boost_payments` `on delete cascade` de `companies`/`jobs`): decisão registrada em DECISOES U24 (o comprovante fica no Mercado Pago); se o contador pedir o histórico na Bicos, vira problema fiscal. Não é falha do código.
- **Corrida no WhatsApp**: dois cadastros ao mesmo tempo com o mesmo número passam em `claim_whatsapp_for` e o segundo cai no índice único (`23505`, traduzido para `conflito`), sem a mensagem `BC409` correta. Não reproduzido (precisa de duas sessões).
- **Distância no mural** (`feed_jobs`, `u51`): o filtro e a ordenação usam o ponto deslocado (`area_geog`, até 200 m do exato) e o card passa a mostrar o ponto exato depois do U53; diferença de até 200 m. Não medido no app.

### D4 — Edge Functions, Auth, CSP, front seguro

- H1 Webhook do Mercado Pago ponta a ponta: nunca exercitado (pagamentos desligados). Dois pontos para o teste em sandbox: (a) se o Supabase entrega o `x-request-id` do Mercado Pago sem alterar (a assinatura usa esse cabeçalho; se a borda o trocar, todo aviso legítimo daria 401); (b) se `date_of_expiration` no formato que o banco devolve (`…+00:00`, sem milissegundos) é aceito pelo Mercado Pago no PIX (`criar-cobranca/index.ts:66`).
- H2 `POST /auth/v1/otp` com `create_user:false` para e-mail inexistente costuma devolver erro (422 "Signups not allowed for otp"): isso seria um oráculo de e-mails no Auth, fora do `verificar-cadastro`. Testar no staging com a chave pública.
- H3 `verifyFirebaseToken` não busca as chaves de novo quando o `kid` do token não está no cache (`_shared/firebase.ts:82`): numa troca de chaves do Google antes do `max-age` acabar, o login receberia 401 até o cache vencer. O Google publica a chave nova antes de usar, então o risco é baixo.
- H4 CSP × fluxos de terceiros: só o app em demonstração foi carregado sob a CSP (8 rotas, sem violação). Google/Firebase (janela e reCAPTCHA do SMS), Turnstile e o formulário de cartão do Mercado Pago nunca rodaram sob `_headers`; podem faltar hosts (p. ex. `connect-src` para `*.mlstatic.com`, `frame-src` para um `authDomain` próprio). Depende do AUD-034 (smoke com cabeçalhos).
- H5 O service worker guarda fotos com `statuses: [0, 200]` (respostas opacas): o Chrome conta cada resposta opaca com um enchimento grande na cota de armazenamento; com até 300 fotos, celulares com pouco espaço podem estourar a cota. Não medido.
- H6 "JWT: sim" na tabela de funções do `CLAUDE.md` não é autenticação para `entrar-com-documento`, `verificar-cadastro`, `codigo-whatsapp` e `entrar-com-firebase`: a chave anônima é um JWT válido e é pública. Não há bug (as funções têm captcha e limites próprios), mas a tabela induz a achar que há login.
- H7 Não verificável sem o painel do Auth: Site URL e Redirect URLs, captcha do Auth ligado, SMTP/Brevo, Google, tempo de vida do código (`mailer_otp_exp`), confirmação de e-mail (os dados mostram 0 usuários não confirmados que entraram, 4 na produção e 13 no staging), limites de taxa do Auth, proteção de senha vazada (advisor: desligada nos dois projetos).
- H8 Segredos das funções (`TURNSTILE_SECRET`, `APP_ORIGIN`, `FIREBASE_PROJECT_ID`, `CLEANUP_SECRET`…) não podem ser listados com as ferramentas disponíveis; a conclusão do AUD-065 vale para o código publicado, não para os Secrets.

### D5 — LGPD

1. **Twilio Verify**: não sei por quanto tempo o Twilio guarda o telefone e o registro de cada verificação (e se o idioma/canal WhatsApp gera conversa no WhatsApp Business). Não há como ver daqui; se for mais de 1 dia, a Política ("códigos do WhatsApp: 1 dia") só vale para o lado da Bicos. Ação: conferir no console do Twilio e documentar.
2. **Brevo**: os e-mails do Auth passam pela Brevo (e-mail do destinatário e link). Não sei se o rastreio de abertura/clique está ligado para e-mail transacional nem a retenção dos logs. Os modelos têm só texto e tabela, sem imagem remota (`DECISOES.md` L04), o que ajuda, mas a opção é da conta.
3. **Logs do Supabase**: `edge_logs` costuma ter IP e caminho de cada requisição; não consultei o conteúdo (regra de não ler dado pessoal), então não confirmei quais campos de IP existem nem o tempo exato no plano atual (AUD-015).
4. **Firebase**: não consegui ver o console do projeto `bicoapp-6cc68`: se há usuários guardados, se Analytics ou "Identity Platform" estão ligados, e a retenção dos números de SMS. AUD-017 assume que o usuário não é apagado porque nenhum código chama a API de exclusão.
5. **Sentry**: opção "Prevent Storing of IP Addresses", retenção real e região (EUA ou UE) não verificáveis (AUD-074).
6. **Menores de idade**: só há a caixa "tenho 18 anos" (`create_my_account(p_adult)` e metadado do Auth); nem a selfie opcional prova idade, e não existe rotina para apagar a conta de quem se descobre menor. É o padrão do mercado, mas vale o advogado dizer se, com a legislação de proteção de crianças e adolescentes em ambiente digital em vigor em 2026, basta a autodeclaração para um app de trabalho.
7. **Produção hoje**: 4 contas (uma só com versão dos termos gravada, `accounts.terms_version`), `terms_acceptances` não existe lá; quando a Política 2.0 subir, o `guards.ts` exige novo aceite e isso corrige o registro; a exclusão de conta na produção ainda é a antiga (anonimização do Y15: usa `author_label`, não apaga avaliações) — o que ela fez com as 4 contas reais não foi verificado, e o texto da Política 2.0 ("apagamos na hora… as avaliações") só passa a valer depois que as migrations `u24` e `r04` forem aplicadas.
8. **Backups do Supabase**: sem acesso ao painel, não sei o plano, a janela de retenção nem se Point-in-Time Recovery está ligado (AUD-076).
9. **Notas fiscais**: se a NivoTech precisa emitir nota pelo impulso e por quanto tempo guardar o registro do pagamento é pergunta para o contador (AUD-069).
10. **`reports.details` e `staff_actions.reason`** são texto livre; não li o conteúdo (regra), então não sei se já há dado pessoal de terceiros escrito neles.

### O1 — processo, CI, deploy, docs

- `GITHUB_TOKEN` padrão e aprovação de workflows de forks: web.yml e staging.yml sem `permissions:`; o proxy bloqueou `/actions/permissions` (HTTP 403 do proxy).
- Cloudflare Pages já ligado ao Git? Sem ferramenta aqui; o domínio ainda não está no ar. AUD-053 vale se o checklist for seguido como escrito.
- Restaurar `pg_dump` em outro projeto: creio que os valores do `vault.secrets` (incl. `nivotech_documento_key`) não sejam decifráveis fora do projeto de origem (a chave mestra fica no Supabase); não testei. Se for verdade, AUD-186 sobe para S1 no lançamento.
- Os 12 e-mails @gmail.com do staging (19–28/10) podem ser dos sócios; não separei equipe de terceiros nem sei se o site de teste está indexado.
- Chave de API do Firebase (AIza…, em site.yml) sem restrição de referrer no Google Cloud: não verificável daqui.
- `archive/` no histórico público tem 10 sequências com formato de CPF e alguns telefones, provavelmente dados de demonstração do app antigo; não verificado um a um.
- Colaborador `GuiFlorezz` (escrita): identidade e 2FA desconhecidos; relevante para AUD-023.

### O2 — testes

- H-1 (bug, não de teste): o servidor decide "hoje" em `America/Sao_Paulo` (`bicos_today()`, `migrations/20261009000200_bicos_v2_rules.sql:103-106`), mas o app compara datas no fuso do aparelho (`web/src/utils/dates.ts:11-16`, `applications.ts:43,187`). Num celular com o fuso errado ou fora do Brasil, "a partir do dia", prazo e "vaga vencida" podem divergir do banco. Não provei com um aparelho; os testes de hoje não conseguem dizer (AUD-127 mistura os dois relógios). Para quem cuida da frente de dados/datas: escrever o teste de regra com relógio fixo em cada fuso.
- H-2 (sem prova): o `sleep 3` fixo antes do E2E (`staging.yml:187`, `web.yml:193`) pode esperar pouco se o `vite preview` demorar; 1 execução vista (run 40117427320) passou. Sem evidência de falha.
- H-3 (sem prova): `idDaConta` (`e2e/apoio.ts:194-202`) lista até 20 páginas × 200 usuários; com o staging em 13 usuários não é problema, mas não escala se o staging virar base de teste de volume.

### B1 — telas no navegador (visitante, trabalhador)

- Trocar WhatsApp para número de outra conta passa no demo (o cadastro barra): outro agente deve confirmar no real (ver AUD-088).
- `/redefinir-senha` sem link do e-mail mostra o formulário (no real o Supabase deveria recusar; ver AUD-103).

### B2 — telas no navegador (empresa, equipe)

- `/privacidade` a 360 px: `document.scrollWidth` = 372 (contêiner fixo do toast com 372 px, `.fixed.inset-x-0.bottom-28`), mas `scrollX` não sai de 0 — sem rolagem lateral real; só em `/privacidade`.
- (descartada) o texto "Verificado" "cortado" em `/vaga-gerenciar` é um `<span class="sr-only">` de 1 px (falso positivo da medição).
- Recusar candidato só tem "Desfazer" por 7 s no aviso (`decisionToasts.ts:10`); depois disso, `CandidateActions.tsx:208-229` mostra "Avisamos que dessa vez não deu certo" sem caminho de volta. Pode ser decisão (L22); não achei em `DECISOES.md` o limite de 7 s — confirmar com o responsável antes de chamar de falha.
- O cadastro inteiro (6 passos) e o rascunho da vaga vivem só na memória: recarregar no passo do código volta ao passo 1 (`f9.cjs`, passo D). Estende C4 (rascunho da vaga). Em produção o código por WhatsApp está desligado e o código de e-mail vem depois de a conta existir (sessão persiste), então o impacto real é pequeno.
- Perfil de trabalhador novo (ex.: Silas) mostra "Novo na plataforma" duas vezes (selo no canto e texto no lugar da nota) — visto no texto da tela em `f18.cjs` (não conferi o print).

### P1 — produto e UX

- H1: rolagem do mural com fotos/mapa pode engasgar em Android de 2 GB; medido em navegador de desktop.
- H2: contraste do tema escuro não medido (tema é da conta, U26; o script travou).
- H3: o código de e-mail (sair do app e voltar) deve ser o maior ponto de abandono; sem dados de funil (`funnel_daily` existe, produção tem 4 contas).
- H4: textos sobre "caixa de spam" dependem de o e-mail chegar de fato (L04, ação do responsável); sem SMTP próprio não verificado.

### Q1 — desempenho, acessibilidade, robustez

1. Tela branca em navegador antigo: `ErrorBoundary.componentDidCatch` chama `reportError` sem `try/catch` (`:57`); sem `randomUUID` o erro nasce dentro do limite de erro e pode derrubar a árvore. Não reproduzido.
2. iOS ≤ 14: `aspect-ratio` pode zerar a altura da foto do cartão e `gap` em flex espreme a tela. Não há WebKit no contêiner.
3. EXIF/GPS preservado: `utils/image.ts:51-58` devolve o arquivo original quando o recodificado não fica menor (ver AUD-008); a foto sobe com os metadados. Não reproduzido.
4. `CacheFirst` com `statuses:[0,200]` (`vite.config.ts:141`) guarda respostas opacas, que ocupam ~7 MB de cota cada no Chrome; pode estourar a cota com 300 fotos. Não medido.
5. Leituras sem `limit`: `loadWorkerProfile` (`data.ts:413`) e `loadCompanyProfile` buscam todas as avaliações e publicações; só pesa com centenas.
6. Contraste "incompleto" do axe em cartões do mural (52 nós): texto sobre foto ou gradiente; precisa de olho humano com fotos reais.
7. Latência real do Supabase, Realtime em aba escondida e SW em aparelho real: não medidos.

### HUNTER — caçador de lacunas (rodadas 1 e 2)

- **H1 (potencialmente S1, PIX):** `begin_boost_payment` fixa `expires_at = now() + 30 minutes` no banco, e `criar-cobranca` manda isso como `date_of_expiration` ao Mercado Pago logo depois. A documentação encontrada (API de Orders) exige no mínimo 30 minutos após a criação do pagamento; se o mesmo valer para `/v1/payments`, o PIX falharia com 400 e cairia no ramo "provedor" (502). Também não confirmou se o formato com 6 casas decimais e `+00:00` é aceito. Nunca houve teste com o Mercado Pago de verdade (pagamentos desligados). Testar no sandbox, usar 35–60 min com offset ISO e 3 casas.
- **H2:** `conclude_finished_jobs()` e `remind_presence()` rodam em uma só transação sem tratamento de exceção por linha; uma linha "venenosa" pararia todas as diárias e vagas, e o cron só avisaria (AUD-006 / AUD-139).
- **H3:** o "Carregar mais" por `lte(status_changed_at, cursor)` não tem desempate por `id`; com 30 ou mais linhas no mesmo instante a próxima página repete as mesmas linhas (`remote/data.ts:289-300`). Improvável com 30 por página.
- **H4:** serviços públicos gratuitos no caminho do cadastro de endereço e do mapa (Photon, Nominatim, OSRM demo, tiles do OSM), sem contrato nem SLA; as políticas de uso restringem uso comercial em volume. Se um bloquear, vira o caso de AUD-028 (localização no centro da cidade em silêncio).
- **H5:** o login por celular (SMS) usa o número como única credencial; número reciclado pela operadora ou SIM swap abre a conta antiga (aspecto de AUD-067).
- **H6:** `fold_text` só troca letras acentuadas pré-compostas; texto decomposto (NFD) não casa com a busca.
- **H7:** o PostgREST corta a resposta em 1000 linhas por padrão (`max_rows`); `applications.in('job_id', ids)` para empresa com muitas vagas abertas pode vir truncado sem aviso (aspecto de AUD-052).
- **H8:** se o Turnstile cair, `captchaOk` devolve `false` e ninguém entra por CPF/CNPJ nem cria cadastro, sem plano B.
- **H9:** SPF/DKIM/DMARC de `nivotech.com.br` não verificados (sem DNS no ambiente). Se o SMTP próprio (Brevo) continuar desligado na produção, o Supabase usa o SMTP padrão, limitado e restrito a e-mails da equipe do projeto.
- **H10:** `begin_boost_payment` não confere o selo da empresa nem se a vaga está oculta pela equipe, então uma empresa reprovada paga impulso.
- **H11:** o `heic2any` embute o `libheif` (LGPL-3.0) no pacote; falta aviso de licença.
- **H12:** `confirm_boost_payment` não compara o valor pago com `amount_cents` (AUD-206): um chargeback parcial ou valor diferente não seria notado.
- **H13:** `anon` e `authenticated` têm SELECT de nível de tabela em `net.http_request_queue` e `net._http_response`. Se o schema `net` aparecer em `db_schemas` da API, o enfileirado inclui o cabeçalho `x-webhook-secret` de `limpar-arquivos` e de `enviar-push`, além do texto dos avisos. Por padrão o schema não é exposto, mas não consigo ler `pgrst.db_schemas`. Confira no painel (Settings, API, Exposed schemas).
- **H14:** `rate_limit_hit` insere a tentativa mesmo quando já passou do limite e conta numa janela deslizante. Quem continua tentando mantém a chave travada indefinidamente (agrava AUD-140: travar o login de outra pessoa passa a custar uma tentativa por janela).
- **H15:** `submit_identity`, `set_job_photos` e `worker_posts` só conferem prefixo, com `..` proibido em texto puro. Variações `%2e%2e` ficam fora do filtro; navegadores normalizam isso para outro diretório, mas todos os buckets envolvidos são públicos, então o dano é baixo.
- **H16:** `configurar-auth.mjs` usa `rate_limit_email_sent` padrão de 100/h, enquanto o checklist fala em ≈12/h para a Brevo grátis (300/dia). Ao bater a cota diária da Brevo, o Auth devolve falha de SMTP e não `over_email_send_rate_limit`, então o cadastro mostra "Não deu certo agora" em vez da mensagem de espera.
- **H17:** a política de Storage de `identidade` não tem DELETE para o dono (liga com AUD-071); o orçamento de arquivos de teste cresce sem teto no staging. Medido: `orphan_storage_objects()` lista 279 órfãos (142 em `identidade`, 134 em `vagas`, de 19 a 28/10). É a prova numérica de AUD-006 na staging.

## 8. Registro de cobertura

**Cobertura total: NÃO.** Todos os 586 arquivos versionados têm leitor registrado e todas as 55 rotas, as 39 tabelas, as 176 funções, os 7 jobs do cron, os 4 buckets e as 10 Edge Functions foram examinados, mas ficaram lacunas que o ambiente não permitiu fechar: ver 8.6.

Resumo: **586** arquivos versionados no commit `67d9ffb`, todos com leitor registrado. `497+` lidos por inteiro; os demais são imagens (binário), arquivos gerados (conferidos contra a fonte) e poucos documentos históricos/dados de demonstração **amostrados** (lista em 8.1, coluna "Como"). Cobertura de runtime: ver 8.2 (rotas), 8.4 (banco) e 8.6 (o que não foi possível verificar).

### 8.1 Arquivos

Gerado de `git ls-files` (586 arquivos) no commit `67d9ffb`. Colunas: arquivo · linhas · agentes que o leram (IDs) · como foi coberto · achados (AUD) que o citam.

Arquivos sem leitura registrada: **0**.

| Arquivo                                                                  | Linhas | Lido por | Como                                                                                                                                           | Achados que citam                                                                                                                                                                                             |
| ------------------------------------------------------------------------ | -----: | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/site.yml`                                             |     77 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-030, AUD-050, AUD-067, AUD-094                                                                                                                                                                            |
| `.github/workflows/staging-fotos.yml`                                    |     49 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-029                                                                                                                                                                                                       |
| `.github/workflows/staging.yml`                                          |    201 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-029, AUD-030, AUD-050, AUD-067, AUD-073, AUD-094, AUD-192                                                                                                                                                 |
| `.github/workflows/web.yml`                                              |    207 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-067, AUD-068, AUD-073, AUD-183, AUD-188, AUD-205                                                                                                                                                          |
| `.gitignore`                                                             |     21 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `CLAUDE.md`                                                              |    244 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-017, AUD-050, AUD-067, AUD-073, AUD-074, AUD-080, AUD-170, AUD-179, AUD-189, AUD-190, AUD-191, AUD-192                                                                                                    |
| `README.md`                                                              |     64 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-195                                                                                                                                                                                                       |
| `legal/politica-de-privacidade.md`                                       |     90 | D5       | lido por inteiro (D5)                                                                                                                          |                                                                                                                                                                                                               |
| `legal/termos-de-uso.md`                                                 |     68 | D5       | lido por inteiro (D5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/.env.example`                                                       |     46 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-074, AUD-190, AUD-194                                                                                                                                                                                     |
| `web/.env.staging.example`                                               |     22 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-094, AUD-194                                                                                                                                                                                              |
| `web/.gitignore`                                                         |     16 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/.prettierignore`                                                    |      9 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/.prettierrc.json`                                                   |      6 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/README.md`                                                          |     89 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-195                                                                                                                                                                                                       |
| `web/build/env.ts`                                                       |    129 | Q1       | amostrado (linhas 70-131: parte jurídica) (D5); lido por inteiro (apoio) (C2)                                                                  | AUD-010, AUD-074                                                                                                                                                                                              |
| `web/docs/ADVISORS.md`                                                   |     74 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-050, AUD-192                                                                                                                                                                                              |
| `web/docs/CHECKLIST-LANCAMENTO.md`                                       |    223 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-010, AUD-029, AUD-062, AUD-067, AUD-075                                                                                                                                                                   |
| `web/docs/CONTRATO-BACKEND.md`                                           |    254 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-190, AUD-195                                                                                                                                                                                              |
| `web/docs/DECISOES.md`                                                   |   2545 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-002, AUD-006, AUD-007, AUD-016, AUD-018, AUD-022, AUD-029, AUD-048, AUD-062, AUD-070, AUD-075, AUD-090, AUD-102, AUD-133, AUD-147, AUD-149                                                                |
| `web/docs/E2E.md`                                                        |    176 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-073, AUD-192, AUD-195                                                                                                                                                                                     |
| `web/docs/IMPLANTACAO.md`                                                |    150 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-067, AUD-069, AUD-070, AUD-074, AUD-192                                                                                                                                                                   |
| `web/docs/LGPD.md`                                                       |     69 | D5, O1   | lido por inteiro (D5)                                                                                                                          | AUD-009, AUD-022, AUD-024, AUD-025, AUD-070, AUD-087, AUD-088, AUD-190, AUD-192                                                                                                                               |
| `web/docs/LIMPEZA.md`                                                    |    256 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-192, AUD-195                                                                                                                                                                                              |
| `web/docs/MAPEAMENTO.md`                                                 |    192 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-195                                                                                                                                                                                                       |
| `web/docs/PLANO-CADASTRO.md`                                             |    109 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-192                                                                                                                                                                                                       |
| `web/docs/RELATORIO-FINAL.md`                                            |    175 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-068, AUD-195                                                                                                                                                                                              |
| `web/docs/RELATORIO_PARIDADE.md`                                         |    728 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-195                                                                                                                                                                                                       |
| `web/docs/STAGING.md`                                                    |     90 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-029, AUD-030, AUD-094                                                                                                                                                                                     |
| `web/docs/SUPABASE.md`                                                   |    204 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-017, AUD-050, AUD-086, AUD-094, AUD-191, AUD-192, AUD-194                                                                                                                                                 |
| `web/docs/TESTE-MANUAL.md`                                               |     37 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-075, AUD-192                                                                                                                                                                                              |
| `web/docs/VALIDACAO.md`                                                  |    234 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         | AUD-195                                                                                                                                                                                                       |
| `web/docs/VOLUME.md`                                                     |     57 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-075                                                                                                                                                                                                       |
| `web/docs/e2e-prints/01-f1-cadastro-senha-e-aceites.jpg`                 |     54 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/02-f1-confirme-seu-e-mail.jpg`                      |     47 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/03-f1-completar-perfil-oficio.jpg`                  |     89 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/04-f1-completar-perfil-especialidade.jpg`           |     65 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/05-f1-mural-do-trabalhador.jpg`                     |     64 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/06-f2-construtora-completa-o-perfil.jpg`            |     58 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/07-f2-publicar-vaga-passo-1.jpg`                    |     86 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/08-f2-publicar-vaga-passo-2.jpg`                    |     66 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/09-f2-vaga-publicada.jpg`                           |     45 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/10-f2-mural-por-cidade-mostra-a-vaga.jpg`           |     55 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/11-f3-detalhe-da-vaga.jpg`                          |      5 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/12-f3-candidatura-enviada.jpg`                      |     32 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/13-f3-construtora-ve-os-candidatos.jpg`             |     77 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/14-f3-aprovado-whatsapp-liberado-para-a-constr.jpg` |     67 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/15-f3-recusa-desfeita.jpg`                          |     93 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/16-f3-whatsapp-liberado-para-o-trabalhador.jpg`     |     44 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/17-f4-construtora-confirma-a-contratacao.jpg`       |     73 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/18-f4-trabalhador-confirma-presenca.jpg`            |     61 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/19-f4-trabalhador-avaliou-a-construtora.jpg`        |     57 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/20-f4-construtora-avaliou-o-trabalhador.jpg`        |     73 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/21-f4-nota-no-perfil-do-trabalhador.jpg`            |     51 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/22-f4-nota-no-perfil-da-construtora.jpg`            |     61 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/23-f5-denuncia.jpg`                                 |     43 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/24-f5-bloqueio.jpg`                                 |     43 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/25-f5-exportar-dados.jpg`                           |     73 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/26-f5-confirmar-exclusao.jpg`                       |     40 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/27-f5-conta-excluida.jpg`                           |     35 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/28-f6-entrou-com-cpf.jpg`                           |     36 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/29-f6-entrou-com-cnpj.jpg`                          |     43 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/30-f6-link-de-recuperacao-enviado.jpg`              |     33 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/31-f6-senha-nova-salva.jpg`                         |     20 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/32-f7-admin-recusado-para-conta-comum.jpg`          |     13 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/33-f7-consentimento-da-selfie.jpg`                  |     61 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/34-f7-fila-de-identidades.jpg`                      |     55 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/35-f7-fila-de-construtoras.jpg`                     |    101 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/36-f7-fila-de-denuncias.jpg`                        |    102 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/37-f7-conta-suspensa-nao-entra.jpg`                 |     40 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/docs/e2e-prints/38-f7-registro-de-auditoria.jpg`                    |    196 | O1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/e2e/LEIA.md`                                                        |     65 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-047, AUD-073, AUD-192                                                                                                                                                                                     |
| `web/e2e/apoio.ts`                                                       |    352 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-094, AUD-185                                                                                                                                                                                              |
| `web/e2e/fixtures/foto.png`                                              |      3 | O2       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/e2e/fluxos/01-cadastro-trabalhador.spec.ts`                         |     62 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/e2e/fluxos/02-construtora-vaga.spec.ts`                             |    167 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/e2e/fluxos/03-candidatura.spec.ts`                                  |     79 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/e2e/fluxos/04-diaria-avaliacao.spec.ts`                             |     93 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-185                                                                                                                                                                                                       |
| `web/e2e/fluxos/05-seguranca-conta.spec.ts`                              |     85 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/e2e/fluxos/06-login.spec.ts`                                        |    101 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/e2e/fluxos/07-equipe.spec.ts`                                       |    157 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-185                                                                                                                                                                                                       |
| `web/e2e/fluxos/08-cadastro-google.spec.ts`                              |    128 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-071                                                                                                                                                                                                       |
| `web/e2e/limpeza.ts`                                                     |     32 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-185                                                                                                                                                                                                       |
| `web/e2e/local/serve-fn.ts`                                              |     10 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/e2e/local/servidor.mjs`                                             |     53 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-071, AUD-073                                                                                                                                                                                              |
| `web/e2e/playwright.config.ts`                                           |     27 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-072, AUD-185                                                                                                                                                                                              |
| `web/e2e/relatorio.ts`                                                   |     64 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-073                                                                                                                                                                                                       |
| `web/eslint.config.js`                                                   |     44 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/index.html`                                                         |    148 | Q1       | lido por inteiro (lista do agente)                                                                                                             | AUD-054, AUD-136, AUD-168, AUD-198                                                                                                                                                                            |
| `web/package-lock.json`                                                  |   9141 | O1       | conferido contra a fonte (npm ci ok; npm audit) (O1)                                                                                           |                                                                                                                                                                                                               |
| `web/package.json`                                                       |     61 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-183, AUD-189                                                                                                                                                                                              |
| `web/postcss.config.js`                                                  |      8 | Q1       | lido por inteiro (lista do agente)                                                                                                             |                                                                                                                                                                                                               |
| `web/public/_headers`                                                    |     26 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-008, AUD-019, AUD-042, AUD-202                                                                                                                                                                            |
| `web/public/icons/apple-touch-icon.png`                                  |      6 | Q1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/public/icons/favicon-32.png`                                        |      6 | Q1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/public/icons/icon-192.png`                                          |     14 | Q1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/public/icons/icon-512.png`                                          |     48 | Q1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/public/icons/icon.svg`                                              |      1 | Q1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/public/icons/maskable-512.png`                                      |      9 | Q1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/public/icons/og.png`                                                |     72 | Q1       | binário/imagem                                                                                                                                 |                                                                                                                                                                                                               |
| `web/public/push-sw.js`                                                  |     36 | D4       | lido por inteiro (D4)                                                                                                                          | AUD-084                                                                                                                                                                                                       |
| `web/public/robots.txt`                                                  |      2 | Q1       | lido por inteiro (lista do agente)                                                                                                             | AUD-030                                                                                                                                                                                                       |
| `web/scripts/a11y-check.mjs`                                             |     79 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-068, AUD-072, AUD-157                                                                                                                                                                                     |
| `web/scripts/aplicar-tudo.mjs`                                           |     39 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/configurar-auth.mjs`                                        |    108 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-030, AUD-069, AUD-086, AUD-169                                                                                                                                                                            |
| `web/scripts/deploy.sh`                                                  |     34 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-067, AUD-184                                                                                                                                                                                              |
| `web/scripts/exportar-app-antigo.sh`                                     |     21 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-047, AUD-070, AUD-184                                                                                                                                                                                     |
| `web/scripts/gen-db-types.mjs`                                           |    165 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/lighthouse-check.mjs`                                       |     21 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-068                                                                                                                                                                                                       |
| `web/scripts/limpeza/comparar.mjs`                                       |     46 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/limpeza/fotografar.mjs`                                     |    190 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/limpeza/links.mjs`                                          |     34 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/make-icons.mjs`                                             |     61 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/sem-rolagem.mjs`                                            |    154 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/sentry-sourcemaps.mjs`                                      |     48 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-184                                                                                                                                                                                                       |
| `web/scripts/staging/aplicar-banco.sh`                                   |     90 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-145, AUD-184                                                                                                                                                                                              |
| `web/scripts/staging/conferir-funcoes.sh`                                |     54 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-030, AUD-071                                                                                                                                                                                              |
| `web/scripts/staging/conferir-migrations.sh`                             |     33 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/staging/fotos-vagas-teste.mjs`                              |    498 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/staging/publicar-funcoes.sh`                                |     27 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-074                                                                                                                                                                                                       |
| `web/scripts/volume/apagar.sql`                                          |     32 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/volume/medir.sql`                                           |     61 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/volume/popular.sql`                                         |    113 | O1       | amostrado (O1: cabeçalho e trechos, cruzados por grep)                                                                                         |                                                                                                                                                                                                               |
| `web/scripts/volume/rodar.sh`                                            |     27 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/App.tsx`                                                        |    187 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-011, AUD-054, AUD-099, AUD-113, AUD-126, AUD-138, AUD-139, AUD-153, AUD-174, AUD-190                                                                                                                      |
| `web/src/__tests__/address.test.ts`                                      |    274 | O2       | amostrado (linhas 60-75 + grep + cobertura; não lido por inteiro por limite de uso) (O2)                                                       | AUD-187                                                                                                                                                                                                       |
| `web/src/__tests__/admin.test.ts`                                        |    136 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/__tests__/applications.test.ts`                                 |    375 | O2       | lido por inteiro (O2); amostrado (tabela) (M1)                                                                                                 | AUD-044, AUD-182, AUD-187, AUD-190                                                                                                                                                                            |
| `web/src/__tests__/buildEnv.test.ts`                                     |    115 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/busy.test.ts`                                         |    137 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/captcha.test.ts`                                      |     74 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/confirmEmail.test.ts`                                 |     28 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/contacts.test.ts`                                     |    114 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-102, AUD-182, AUD-187                                                                                                                                                                                     |
| `web/src/__tests__/days.test.ts`                                         |    102 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/deleteAccount.test.ts`                                |     85 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-182                                                                                                                                                                                                       |
| `web/src/__tests__/edgeOrigin.test.ts`                                   |     70 | O2       | amostrado (só grep + cobertura medida; não lido linha a linha por limite de uso) (O2)                                                          |                                                                                                                                                                                                               |
| `web/src/__tests__/editJob.test.ts`                                      |    100 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/emailTemplates.test.ts`                               |     58 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/fakeSupabase.ts`                                      |    218 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-182                                                                                                                                                                                                       |
| `web/src/__tests__/firebaseSignIn.test.ts`                               |    238 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-186                                                                                                                                                                                                       |
| `web/src/__tests__/firebaseToken.test.ts`                                |    110 | O2       | amostrado (só grep + cobertura medida; não lido linha a linha por limite de uso) (O2)                                                          |                                                                                                                                                                                                               |
| `web/src/__tests__/headers.test.ts`                                      |     91 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-042                                                                                                                                                                                                       |
| `web/src/__tests__/helpers.ts`                                           |     17 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/__tests__/legal.test.ts`                                        |     48 | O2       | lido por inteiro (D5); amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2) |                                                                                                                                                                                                               |
| `web/src/__tests__/monitoring.test.ts`                                   |     72 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/oficios.test.ts`                                      |     96 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/payments.test.ts`                                     |    145 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-182                                                                                                                                                                                                       |
| `web/src/__tests__/places.test.ts`                                       |    351 | O2       | amostrado (só grep + cobertura medida; não lido linha a linha por limite de uso) (O2)                                                          |                                                                                                                                                                                                               |
| `web/src/__tests__/publicLink.test.ts`                                   |     90 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/__tests__/remote.test.ts`                                       |   1503 | O2       | lido por inteiro (O2); amostrado (grep de rpc) (M1)                                                                                            | AUD-182, AUD-186, AUD-187                                                                                                                                                                                     |
| `web/src/__tests__/reviews.test.ts`                                      |    116 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-182                                                                                                                                                                                                       |
| `web/src/__tests__/route.test.ts`                                        |     66 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/router.test.ts`                                       |     93 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/services.test.ts`                                     |    474 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-182, AUD-187                                                                                                                                                                                              |
| `web/src/__tests__/session.test.ts`                                      |    180 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-182                                                                                                                                                                                                       |
| `web/src/__tests__/states.test.ts`                                       |    120 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/store.test.ts`                                        |     29 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/supabase.test.ts`                                     |    254 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-187                                                                                                                                                                                                       |
| `web/src/__tests__/tag.test.ts`                                          |     28 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/tapTarget.test.ts`                                    |     27 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/theme.test.ts`                                        |    129 | O2       | amostrado (só grep de asserções frouxas/skip/esperas + cobertura medida; não lido linha a linha por limite de uso) (O2)                        |                                                                                                                                                                                                               |
| `web/src/__tests__/utils.parity.test.ts`                                 |    241 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-187                                                                                                                                                                                                       |
| `web/src/components/AboutField.tsx`                                      |     47 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-162                                                                                                                                                                                                       |
| `web/src/components/AddressFields.tsx`                                   |    198 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-162                                                                                                                                                                                                       |
| `web/src/components/AutocompleteField.tsx`                               |    276 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/Avatar.tsx`                                          |     84 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-125                                                                                                                                                                                                       |
| `web/src/components/BackBar.tsx`                                         |     20 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/Badge.tsx`                                           |     33 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-163                                                                                                                                                                                                       |
| `web/src/components/BusyOverlay.tsx`                                     |     89 | C5       | lido por inteiro (C5); lido (primeiras 80 linhas, apoio) (C1)                                                                                  |                                                                                                                                                                                                               |
| `web/src/components/Button.tsx`                                          |     91 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053, AUD-061, AUD-159, AUD-163                                                                                                                                                                            |
| `web/src/components/CandidateRow.tsx`                                    |    121 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-052, AUD-061                                                                                                                                                                                              |
| `web/src/components/Captcha.tsx`                                         |     99 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-019, AUD-046, AUD-113                                                                                                                                                                                     |
| `web/src/components/Card.tsx`                                            |     37 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-208                                                                                                                                                                                                       |
| `web/src/components/Checkbox.tsx`                                        |     36 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053, AUD-156                                                                                                                                                                                              |
| `web/src/components/CityPicker.tsx`                                      |    148 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-124                                                                                                                                                                                                       |
| `web/src/components/CodeInput.tsx`                                       |    130 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-155, AUD-162                                                                                                                                                                                              |
| `web/src/components/ContactButton.tsx`                                   |     88 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/EmptyState.tsx`                                      |     27 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-095, AUD-167                                                                                                                                                                                              |
| `web/src/components/ErrorBoundary.tsx`                                   |     94 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-045, AUD-139, AUD-148                                                                                                                                                                                     |
| `web/src/components/ErrorState.tsx`                                      |     46 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-167                                                                                                                                                                                                       |
| `web/src/components/FieldError.tsx`                                      |     11 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/FlowLayout.tsx`                                      |    104 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-156                                                                                                                                                                                                       |
| `web/src/components/GoogleButton.tsx`                                    |     55 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/IconButton.tsx`                                      |     45 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-061                                                                                                                                                                                                       |
| `web/src/components/InfoRow.tsx`                                         |     14 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/Input.tsx`                                           |    205 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-155, AUD-157, AUD-162                                                                                                                                                                                     |
| `web/src/components/JobCover.tsx`                                        |     70 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-125                                                                                                                                                                                                       |
| `web/src/components/JobMap.tsx`                                          |    155 | C5       | amostrado (25-70) (D5); lido por inteiro (C5)                                                                                                  | AUD-008, AUD-053                                                                                                                                                                                              |
| `web/src/components/JobTile.tsx`                                         |    170 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053, AUD-059, AUD-065, AUD-152, AUD-163, AUD-172, AUD-173, AUD-211, AUD-215                                                                                                                               |
| `web/src/components/KeyValue.tsx`                                        |      9 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/LoadMore.tsx`                                        |     19 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/Logo.tsx`                                            |     26 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/MapCanvas.tsx`                                       |    175 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/MapLinks.tsx`                                        |     23 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/MercadoPagoCardForm.tsx`                             |    111 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-019, AUD-049                                                                                                                                                                                              |
| `web/src/components/Modal.tsx`                                           |    134 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-166                                                                                                                                                                                                       |
| `web/src/components/NotFound.tsx`                                        |     17 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-167, AUD-190                                                                                                                                                                                              |
| `web/src/components/NotificationsPanel.tsx`                              |    153 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-155, AUD-165                                                                                                                                                                                              |
| `web/src/components/OfflineBanner.tsx`                                   |     18 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/PasswordStrength.tsx`                                |     19 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/PhotoCarousel.tsx`                                   |    274 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053, AUD-065, AUD-125                                                                                                                                                                                     |
| `web/src/components/PhotoManager.tsx`                                    |     58 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-033, AUD-053, AUD-160                                                                                                                                                                                     |
| `web/src/components/PhotoSlot.tsx`                                       |     72 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053, AUD-160                                                                                                                                                                                              |
| `web/src/components/ProfileAddressField.tsx`                             |     26 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/ProfileSection.tsx`                                  |     51 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/QueryView.tsx`                                       |     47 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-049                                                                                                                                                                                                       |
| `web/src/components/Radio.tsx`                                           |     83 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053                                                                                                                                                                                                       |
| `web/src/components/Rating.tsx`                                          |     42 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-161                                                                                                                                                                                                       |
| `web/src/components/ReasonDialog.tsx`                                    |     70 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/ResultIcon.tsx`                                      |     21 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/ReviewForm.tsx`                                      |    130 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-170, AUD-214                                                                                                                                                                                              |
| `web/src/components/SafetyMenu.tsx`                                      |    138 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/SaveFlag.tsx`                                        |     29 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-173                                                                                                                                                                                                       |
| `web/src/components/Select.tsx`                                          |     76 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-162                                                                                                                                                                                                       |
| `web/src/components/SettingsButton.tsx`                                  |     14 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/SignOutDialog.tsx`                                   |     31 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-166                                                                                                                                                                                                       |
| `web/src/components/Skeleton.tsx`                                        |     80 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/Switch.tsx`                                          |     42 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053                                                                                                                                                                                                       |
| `web/src/components/Tag.tsx`                                             |     54 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-163                                                                                                                                                                                                       |
| `web/src/components/TextArea.tsx`                                        |     33 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/ThemeToggle.tsx`                                     |    125 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/ToastHost.tsx`                                       |     50 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-155, AUD-164                                                                                                                                                                                              |
| `web/src/components/WhatsAppButton.tsx`                                  |     78 | C5       | lido por inteiro (C5)                                                                                                                          | AUD-053                                                                                                                                                                                                       |
| `web/src/components/WhatsAppRow.tsx`                                     |     35 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/icons/Icon.tsx`                                      |     67 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/components/icons/iconData.ts`                                   |    174 | C5       | amostrado (linhas 1-71 lidas; o resto decodificado por script: 94 ícones SVG válidos) (C5)                                                     |                                                                                                                                                                                                               |
| `web/src/components/notificationLook.ts`                                 |     38 | C5       | lido por inteiro (C5)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/data/cidades.ts`                                                |      5 | C6       | conferido contra a fonte (script: 5.571 linhas, 27 UFs, sem duplicata) (C6)                                                                    | AUD-174                                                                                                                                                                                                       |
| `web/src/data/oficios.ts`                                                |     25 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/data/seed.ts`                                                   |   1408 | C6       | amostrado (C6: linhas 1-420 e 1150-1408 lidas; meio só por grep)                                                                               |                                                                                                                                                                                                               |
| `web/src/env.d.ts`                                                       |     39 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-190, AUD-194                                                                                                                                                                                              |
| `web/src/hooks/useAction.ts`                                             |     51 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useAddressEditor.ts`                                      |     49 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-035                                                                                                                                                                                                       |
| `web/src/hooks/useBusy.ts`                                               |     12 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useGoogleSignUp.ts`                                       |     19 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useInnerBack.ts`                                          |     31 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useModal.ts`                                              |     83 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useNotifications.ts`                                      |     33 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useOnline.ts`                                             |     19 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/usePaging.ts`                                             |     18 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useQuery.ts`                                              |     28 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/hooks/useStore.ts`                                              |     51 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-039                                                                                                                                                                                                       |
| `web/src/hooks/useTextField.ts`                                          |     49 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-199                                                                                                                                                                                                       |
| `web/src/layouts/AppNav.tsx`                                             |    350 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-165, AUD-170, AUD-172                                                                                                                                                                                     |
| `web/src/layouts/AppShell.tsx`                                           |    119 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-011                                                                                                                                                                                                       |
| `web/src/layouts/accountMenu.ts`                                         |     27 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-038, AUD-170                                                                                                                                                                                              |
| `web/src/layouts/navItems.ts`                                            |     26 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-170                                                                                                                                                                                                       |
| `web/src/main.tsx`                                                       |     57 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-139                                                                                                                                                                                                       |
| `web/src/pages/admin/Admin.tsx`                                          |    478 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-122                                                                                                                                                                                                       |
| `web/src/pages/recruiter/BoostJob.tsx`                                   |    139 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-098, AUD-158, AUD-170                                                                                                                                                                                     |
| `web/src/pages/recruiter/BoostPayment.tsx`                               |    481 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-040, AUD-170, AUD-177                                                                                                                                                                                     |
| `web/src/pages/recruiter/CandidateActions.tsx`                           |    296 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-044, AUD-119, AUD-170, AUD-190                                                                                                                                                                            |
| `web/src/pages/recruiter/CreateJob.tsx`                                  |    595 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-032, AUD-033, AUD-034, AUD-035, AUD-039, AUD-123, AUD-153, AUD-157                                                                                                                                        |
| `web/src/pages/recruiter/EditJob.tsx`                                    |     44 | C4       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/recruiter/History.tsx`                                    |      7 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-038                                                                                                                                                                                                       |
| `web/src/pages/recruiter/InviteSheet.tsx`                                |     79 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-190                                                                                                                                                                                                       |
| `web/src/pages/recruiter/JobClosed.tsx`                                  |    170 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-170, AUD-190, AUD-209                                                                                                                                                                                     |
| `web/src/pages/recruiter/JobManage.tsx`                                  |    424 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-033, AUD-052, AUD-060, AUD-154, AUD-170, AUD-190, AUD-197                                                                                                                                                 |
| `web/src/pages/recruiter/JobPublished.tsx`                               |     60 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-062, AUD-118, AUD-197                                                                                                                                                                                     |
| `web/src/pages/recruiter/MyJobs.tsx`                                     |    174 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-038, AUD-121, AUD-209                                                                                                                                                                                     |
| `web/src/pages/recruiter/Payments.tsx`                                   |    119 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-040                                                                                                                                                                                                       |
| `web/src/pages/recruiter/RateWorker.tsx`                                 |     70 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-038                                                                                                                                                                                                       |
| `web/src/pages/recruiter/RepublishJob.tsx`                               |     31 | C4       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/recruiter/decisionToasts.ts`                              |     46 | C4       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/recruiter/jobForm.ts`                                     |    294 | C4       | lido por inteiro (M1)                                                                                                                          | AUD-032                                                                                                                                                                                                       |
| `web/src/pages/shared/AcceptTerms.tsx`                                   |     65 | C3       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/shared/AccountDeleted.tsx`                                |     20 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-006                                                                                                                                                                                                       |
| `web/src/pages/shared/BlockedAccounts.tsx`                               |     61 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-116                                                                                                                                                                                                       |
| `web/src/pages/shared/ChangeEmail.tsx`                                   |    103 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-153                                                                                                                                                                                                       |
| `web/src/pages/shared/ChangePassword.tsx`                                |     91 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-153                                                                                                                                                                                                       |
| `web/src/pages/shared/ChangeWhatsApp.tsx`                                |    174 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-099, AUD-113, AUD-126, AUD-153                                                                                                                                                                            |
| `web/src/pages/shared/ChooseProfile.tsx`                                 |     74 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-170                                                                                                                                                                                                       |
| `web/src/pages/shared/CompanyProfileScreen.tsx`                          |    340 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-018, AUD-156, AUD-215                                                                                                                                                                                     |
| `web/src/pages/shared/CompleteProfile.tsx`                               |    287 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-035, AUD-041, AUD-051, AUD-207                                                                                                                                                                            |
| `web/src/pages/shared/DeleteAccount.tsx`                                 |    270 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-006, AUD-155                                                                                                                                                                                              |
| `web/src/pages/shared/EditCompanyProfile.tsx`                            |    195 | C3       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/shared/EditWorkerProfile.tsx`                             |    182 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-097                                                                                                                                                                                                       |
| `web/src/pages/shared/ExperiencesField.tsx`                              |    196 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-115, AUD-155                                                                                                                                                                                              |
| `web/src/pages/shared/ForgotPassword.tsx`                                |     93 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-051                                                                                                                                                                                                       |
| `web/src/pages/shared/GoogleSignUpRedirect.tsx`                          |     10 | C3       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/shared/Help.tsx`                                          |    136 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-023, AUD-026, AUD-051, AUD-058, AUD-094, AUD-170                                                                                                                                                          |
| `web/src/pages/shared/LegalScreen.tsx`                                   |     50 | C3       | lido por inteiro (D5)                                                                                                                          | AUD-010                                                                                                                                                                                                       |
| `web/src/pages/shared/Login.tsx`                                         |    290 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-041, AUD-046, AUD-051, AUD-155                                                                                                                                                                            |
| `web/src/pages/shared/NotificationSettings.tsx`                          |    146 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-170                                                                                                                                                                                                       |
| `web/src/pages/shared/Notifications.tsx`                                 |     87 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-155, AUD-156                                                                                                                                                                                              |
| `web/src/pages/shared/PhoneSignIn.tsx`                                   |    196 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-112, AUD-126, AUD-155                                                                                                                                                                                     |
| `web/src/pages/shared/PostViewer.tsx`                                    |    142 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-042, AUD-110                                                                                                                                                                                              |
| `web/src/pages/shared/Privacy.tsx`                                       |     85 | C3       | lido por inteiro (D5)                                                                                                                          | AUD-020, AUD-023, AUD-026                                                                                                                                                                                     |
| `web/src/pages/shared/PrivacyPolicy.tsx`                                 |      3 | C3       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/shared/PublicJob.tsx`                                     |    178 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-018, AUD-041, AUD-059, AUD-109, AUD-150, AUD-198, AUD-213                                                                                                                                                 |
| `web/src/pages/shared/ResetPassword.tsx`                                 |     97 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-051, AUD-114                                                                                                                                                                                              |
| `web/src/pages/shared/ReviewsScreen.tsx`                                 |    129 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-155, AUD-161                                                                                                                                                                                              |
| `web/src/pages/shared/Settings.tsx`                                      |    164 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-170                                                                                                                                                                                                       |
| `web/src/pages/shared/Signup.tsx`                                        |    660 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-031, AUD-051, AUD-097, AUD-099, AUD-100, AUD-126, AUD-153, AUD-170, AUD-199                                                                                                                               |
| `web/src/pages/shared/Splash.tsx`                                        |     25 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-051, AUD-163, AUD-206                                                                                                                                                                                     |
| `web/src/pages/shared/Terms.tsx`                                         |      3 | C3       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/shared/VerifyEmail.tsx`                                   |    337 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-051, AUD-100, AUD-112, AUD-155, AUD-170                                                                                                                                                                   |
| `web/src/pages/shared/WhatsAppCode.tsx`                                  |    108 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-100, AUD-112, AUD-155                                                                                                                                                                                     |
| `web/src/pages/shared/WorkerPosts.tsx`                                   |    278 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-012, AUD-042, AUD-110, AUD-111, AUD-155                                                                                                                                                                   |
| `web/src/pages/shared/WorkerProfileScreen.tsx`                           |    240 | C3       | lido por inteiro (relatório do agente)                                                                                                         | AUD-156, AUD-209                                                                                                                                                                                              |
| `web/src/pages/worker/ApplicationSent.tsx`                               |     62 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-058, AUD-062, AUD-212                                                                                                                                                                                     |
| `web/src/pages/worker/ApplicationStatusCard.tsx`                         |     46 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-208                                                                                                                                                                                                       |
| `web/src/pages/worker/ConfirmApplication.tsx`                            |    115 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-058, AUD-059, AUD-170, AUD-212                                                                                                                                                                            |
| `web/src/pages/worker/JobDetail.tsx`                                     |    377 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-008, AUD-058, AUD-059, AUD-190, AUD-212, AUD-214                                                                                                                                                          |
| `web/src/pages/worker/MyApplications.tsx`                                |    146 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-152, AUD-170                                                                                                                                                                                              |
| `web/src/pages/worker/RateJob.tsx`                                       |     70 | C4       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/worker/SavedJobs.tsx`                                     |     58 | C4       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/pages/worker/Selected.tsx`                                      |    174 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-058, AUD-170, AUD-214                                                                                                                                                                                     |
| `web/src/pages/worker/VerifyIdentity.tsx`                                |    169 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-033, AUD-158, AUD-190                                                                                                                                                                                     |
| `web/src/pages/worker/feed/DesktopFeed.tsx`                              |    120 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-037, AUD-117                                                                                                                                                                                              |
| `web/src/pages/worker/feed/Feed.tsx`                                     |    107 | C4       | amostrado (linhas 30-107) (M1)                                                                                                                 | AUD-037, AUD-044, AUD-065, AUD-117, AUD-120, AUD-135, AUD-158, AUD-163, AUD-171                                                                                                                               |
| `web/src/pages/worker/feed/FeedParts.tsx`                                |    187 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-037                                                                                                                                                                                                       |
| `web/src/pages/worker/feed/FeedSheets.tsx`                               |    165 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-062, AUD-117, AUD-171, AUD-210                                                                                                                                                                            |
| `web/src/pages/worker/feed/MobileFeed.tsx`                               |    140 | C4       | lido por inteiro (relatório do agente)                                                                                                         | AUD-037, AUD-117, AUD-120, AUD-158, AUD-163, AUD-171                                                                                                                                                          |
| `web/src/pages/worker/feed/feedUI.ts`                                    |    258 | C4       | lido por inteiro (M1)                                                                                                                          | AUD-135                                                                                                                                                                                                       |
| `web/src/routes.ts`                                                      |    206 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-011, AUD-068, AUD-096, AUD-174                                                                                                                                                                            |
| `web/src/services/account.ts`                                            |    220 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-190                                                                                                                                                                                                       |
| `web/src/services/address.ts`                                            |    420 | C1       | lido por inteiro (C1); amostrado (só os ramos IS_DEMO) (M1)                                                                                    | AUD-035                                                                                                                                                                                                       |
| `web/src/services/admin.ts`                                              |    208 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   |                                                                                                                                                                                                               |
| `web/src/services/alerts.ts`                                             |    155 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-182, AUD-190                                                                                                                                                                                              |
| `web/src/services/applicationMachine.ts`                                 |    173 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-134, AUD-190                                                                                                                                                                                              |
| `web/src/services/applications.ts`                                       |    675 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-034, AUD-044, AUD-101, AUD-182, AUD-190                                                                                                                                                                   |
| `web/src/services/auth.ts`                                               |    678 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-031, AUD-096, AUD-107, AUD-114, AUD-137, AUD-169, AUD-175, AUD-182, AUD-190, AUD-203                                                                                                                      |
| `web/src/services/boot.ts`                                               |     41 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/busy.ts`                                               |     93 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/catalog.ts`                                            |     60 | C1       | lido por inteiro (C1)                                                                                                                          | AUD-175                                                                                                                                                                                                       |
| `web/src/services/cities.ts`                                             |     90 | C1       | lido por inteiro (C1)                                                                                                                          | AUD-174, AUD-190                                                                                                                                                                                              |
| `web/src/services/contacts.ts`                                           |     73 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-102                                                                                                                                                                                                       |
| `web/src/services/defaults.ts`                                           |      7 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/demo.ts`                                               |     30 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/errors.ts`                                             |     51 | C1       | lido por inteiro (C1)                                                                                                                          | AUD-045                                                                                                                                                                                                       |
| `web/src/services/features.ts`                                           |     47 | C1       | lido por inteiro (C1)                                                                                                                          | AUD-062, AUD-089, AUD-094, AUD-190, AUD-194                                                                                                                                                                   |
| `web/src/services/feedQuery.ts`                                          |     37 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/feedback.ts`                                           |     12 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/googleSignUp.ts`                                       |     64 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/guards.ts`                                             |     43 | C1       | lido por inteiro (C1)                                                                                                                          | AUD-041                                                                                                                                                                                                       |
| `web/src/services/identity.ts`                                           |     65 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-190                                                                                                                                                                                                       |
| `web/src/services/invites.ts`                                            |    124 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-034, AUD-182, AUD-190                                                                                                                                                                                     |
| `web/src/services/jobs.ts`                                               |    271 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-034, AUD-190                                                                                                                                                                                              |
| `web/src/services/legal.ts`                                              |    225 | C2, D5   | lido por inteiro (D5); lido por inteiro (C2)                                                                                                   | AUD-001, AUD-002, AUD-006, AUD-008, AUD-009, AUD-010, AUD-019, AUD-020, AUD-021, AUD-022, AUD-023, AUD-025, AUD-026, AUD-027, AUD-058, AUD-083, AUD-087, AUD-088, AUD-089, AUD-090, AUD-093, AUD-103, AUD-204 |
| `web/src/services/media.ts`                                              |      6 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-033                                                                                                                                                                                                       |
| `web/src/services/mockLatency.ts`                                        |     23 | C2       | lido por inteiro (C2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/mode.ts`                                               |      9 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-175                                                                                                                                                                                                       |
| `web/src/services/monitoring.ts`                                         |    163 | C2       | amostrado (1-120) (D5); lido por inteiro (C2)                                                                                                  | AUD-045, AUD-049, AUD-088, AUD-148                                                                                                                                                                            |
| `web/src/services/notifications.ts`                                      |    161 | C2       | lido por inteiro (C2); lido por inteiro (M1)                                                                                                   | AUD-190                                                                                                                                                                                                       |
| `web/src/services/paging.ts`                                             |     38 | C2       | lido por inteiro (C2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/payments.ts`                                           |    286 | C2       | lido por inteiro (C2); lido por inteiro (M1)                                                                                                   | AUD-094, AUD-098, AUD-182, AUD-190                                                                                                                                                                            |
| `web/src/services/profiles.ts`                                           |    274 | C2       | lido por inteiro (C2); lido por inteiro (M1)                                                                                                   | AUD-036, AUD-099                                                                                                                                                                                              |
| `web/src/services/push.ts`                                               |    100 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-137                                                                                                                                                                                                       |
| `web/src/services/pwa.ts`                                                |     25 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-064, AUD-149                                                                                                                                                                                              |
| `web/src/services/pwaStub.ts`                                            |      4 | C2       | lido por inteiro (C2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/queries.ts`                                            |    110 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-036, AUD-049                                                                                                                                                                                              |
| `web/src/services/remote/actions.ts`                                     |    191 | C1       | amostrado (linhas 125-170) (D5); lido por inteiro (C1)                                                                                         | AUD-034, AUD-040, AUD-092, AUD-102, AUD-190                                                                                                                                                                   |
| `web/src/services/remote/address.ts`                                     |    388 | C1       | lido por inteiro (C1)                                                                                                                          | AUD-035                                                                                                                                                                                                       |
| `web/src/services/remote/admin.ts`                                       |    113 | C1       | lido por inteiro (C1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/remote/applications.ts`                                |     58 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-034, AUD-044, AUD-101, AUD-182, AUD-190                                                                                                                                                                   |
| `web/src/services/remote/auth.ts`                                        |    490 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-031, AUD-096, AUD-107, AUD-114, AUD-137, AUD-169, AUD-175, AUD-182, AUD-190, AUD-203                                                                                                                      |
| `web/src/services/remote/client.ts`                                      |    162 | C2       | lido por inteiro (C2); lido por inteiro (apoio) (C1)                                                                                           | AUD-043, AUD-045, AUD-049, AUD-138, AUD-190                                                                                                                                                                   |
| `web/src/services/remote/data.ts`                                        |    560 | C2       | lido por inteiro (C2); lido por inteiro (apoio) (C1); amostrado (loadFeed, loadJob, conclude) (M1)                                             | AUD-036, AUD-063, AUD-066, AUD-101, AUD-174, AUD-176, AUD-180, AUD-190                                                                                                                                        |
| `web/src/services/remote/firebase.ts`                                    |    242 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-019, AUD-049, AUD-089, AUD-108                                                                                                                                                                            |
| `web/src/services/remote/firebaseSdk.ts`                                 |     15 | C2       | lido por inteiro (C2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/remote/jobs.ts`                                        |     74 | C1       | lido por inteiro (C1); lido por inteiro (M1)                                                                                                   | AUD-034, AUD-190                                                                                                                                                                                              |
| `web/src/services/remote/merge.ts`                                       |    279 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-036                                                                                                                                                                                                       |
| `web/src/services/remote/profiles.ts`                                    |    218 | C2       | lido por inteiro (C2); lido por inteiro (M1)                                                                                                   | AUD-036, AUD-099                                                                                                                                                                                              |
| `web/src/services/remote/session.ts`                                     |    582 | C2       | amostrado (135-165) (D5); lido por inteiro (C2)                                                                                                | AUD-036, AUD-043, AUD-089, AUD-104, AUD-137, AUD-138, AUD-190, AUD-203                                                                                                                                        |
| `web/src/services/remote/storage.ts`                                     |    159 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-012, AUD-033, AUD-042, AUD-106, AUD-178, AUD-190                                                                                                                                                          |
| `web/src/services/reviews.ts`                                            |    132 | C2       | lido por inteiro (C2); lido por inteiro (M1)                                                                                                   | AUD-182, AUD-215                                                                                                                                                                                              |
| `web/src/services/route.ts`                                              |     65 | C2       | amostrado (linhas 1-65, arquivo lido quase todo) (D5); lido por inteiro (C2)                                                                   | AUD-008                                                                                                                                                                                                       |
| `web/src/services/router.ts`                                             |    237 | C2       | lido por inteiro (C2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/safety.ts`                                             |     92 | C2       | lido por inteiro (C2); lido por inteiro (M1)                                                                                                   | AUD-058                                                                                                                                                                                                       |
| `web/src/services/selectors.ts`                                          |    184 | C2       | lido por inteiro (C2); lido por inteiro (apoio) (C1); lido por inteiro (M1)                                                                    | AUD-008, AUD-105, AUD-175                                                                                                                                                                                     |
| `web/src/services/sharedUI.ts`                                           |     21 | C2       | lido por inteiro (C2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/src/services/store.ts`                                              |    271 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-036, AUD-039, AUD-041, AUD-175, AUD-190                                                                                                                                                                   |
| `web/src/services/supabase.ts`                                           |     50 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-043, AUD-139, AUD-190                                                                                                                                                                                     |
| `web/src/services/supabaseMappers.ts`                                    |    541 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-105, AUD-190                                                                                                                                                                                              |
| `web/src/services/theme.ts`                                              |    108 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-140                                                                                                                                                                                                       |
| `web/src/services/toast.ts`                                              |     45 | C2       | lido por inteiro (C2)                                                                                                                          | AUD-164                                                                                                                                                                                                       |
| `web/src/styles/base.css`                                                |    276 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-163, AUD-168                                                                                                                                                                                              |
| `web/src/styles/map.css`                                                 |     49 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/styles/tailwind.css`                                            |      3 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/styles/tokens.css`                                              |    183 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-163                                                                                                                                                                                                       |
| `web/src/types/database.generated.ts`                                    |   1944 | D1       | conferido contra a fonte (bate com o staging: 39 tabelas, 147 funções, 13 enums) (D1)                                                          | AUD-182                                                                                                                                                                                                       |
| `web/src/types/models.ts`                                                |    479 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-190                                                                                                                                                                                                       |
| `web/src/types/screen.ts`                                                |      6 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/types/supabase.ts`                                              |    644 | C6       | amostrado + comparado por script com database.generated.ts (C6)                                                                                | AUD-043, AUD-139, AUD-190                                                                                                                                                                                     |
| `web/src/types/ui.ts`                                                    |     12 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/addressText.ts`                                           |     42 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-190                                                                                                                                                                                                       |
| `web/src/utils/applicationStatus.ts`                                     |    126 | C6       | lido por inteiro (M1)                                                                                                                          | AUD-170, AUD-208                                                                                                                                                                                              |
| `web/src/utils/card.ts`                                                  |     58 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/code.ts`                                                  |      8 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/cx.ts`                                                    |      4 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/dates.ts`                                                 |     80 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-044, AUD-170, AUD-190                                                                                                                                                                                     |
| `web/src/utils/document.ts`                                              |     29 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-129                                                                                                                                                                                                       |
| `web/src/utils/fileInput.ts`                                             |      4 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/format.ts`                                                |     86 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-126, AUD-190                                                                                                                                                                                              |
| `web/src/utils/geo.ts`                                                   |     19 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/image.ts`                                                 |     59 | C6       | lido por inteiro (apoio) (C2)                                                                                                                  | AUD-012, AUD-065, AUD-106                                                                                                                                                                                     |
| `web/src/utils/jobInfo.ts`                                               |    323 | C6       | lido por inteiro (M1)                                                                                                                          | AUD-044, AUD-190                                                                                                                                                                                              |
| `web/src/utils/jobPhotos.ts`                                             |      6 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/media.ts`                                                 |     42 | C6       | lido por inteiro (apoio) (C2)                                                                                                                  | AUD-033                                                                                                                                                                                                       |
| `web/src/utils/password.ts`                                              |      8 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/profileText.ts`                                           |     25 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/share.ts`                                                 |     44 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-197                                                                                                                                                                                                       |
| `web/src/utils/specialties.ts`                                           |     13 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/src/utils/text.ts`                                                  |      4 | C6       | lido por inteiro (relatório do agente)                                                                                                         | AUD-190                                                                                                                                                                                                       |
| `web/src/utils/whatsapp.ts`                                              |     52 | C6       | lido por inteiro (apoio) (C1)                                                                                                                  | AUD-102                                                                                                                                                                                                       |
| `web/src/utils/workerInfo.ts`                                            |     13 | C6       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/APLICAR-TUDO.sql`                                          |   7931 | D1       | conferido contra a fonte (regenerado numa cópia: idêntico) (D1)                                                                                |                                                                                                                                                                                                               |
| `web/supabase/APLICAR.md`                                                |    769 | O1       | lido por inteiro (relatório do agente)                                                                                                         | AUD-074, AUD-145, AUD-180, AUD-190                                                                                                                                                                            |
| `web/supabase/email-templates/LEIA.md`                                   |     25 | D4       | lido por inteiro (D4)                                                                                                                          | AUD-047, AUD-073, AUD-192                                                                                                                                                                                     |
| `web/supabase/email-templates/confirmacao.html`                          |    134 | D4       | lido por inteiro (D4)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/email-templates/link-de-acesso.html`                       |    110 | D4       | lido por inteiro (D4)                                                                                                                          | AUD-169                                                                                                                                                                                                       |
| `web/supabase/email-templates/redefinir-senha.html`                      |     85 | D4       | lido por inteiro (D4)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/email-templates/troca-de-email.html`                       |     83 | D4       | lido por inteiro (D4)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/functions/.env.staging.example`                            |     23 | D4       | lido por inteiro (D4)                                                                                                                          | AUD-094, AUD-194                                                                                                                                                                                              |
| `web/supabase/functions/_shared/captcha.ts`                              |     32 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-049                                                                                                                                                                                                       |
| `web/supabase/functions/_shared/confirm.ts`                              |     20 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   |                                                                                                                                                                                                               |
| `web/supabase/functions/_shared/firebase.ts`                             |    115 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-019, AUD-049, AUD-089, AUD-108                                                                                                                                                                            |
| `web/supabase/functions/_shared/http.ts`                                 |     72 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-007                                                                                                                                                                                                       |
| `web/supabase/functions/_shared/mercadopago.ts`                          |     83 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-049, AUD-071, AUD-181                                                                                                                                                                                     |
| `web/supabase/functions/_shared/monitoring.ts`                           |     55 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-045, AUD-049, AUD-088, AUD-148                                                                                                                                                                            |
| `web/supabase/functions/_shared/origin.ts`                               |     59 | D4       | lido por inteiro (D4)                                                                                                                          | AUD-181                                                                                                                                                                                                       |
| `web/supabase/functions/codigo-whatsapp/index.ts`                        |     95 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-007, AUD-049, AUD-113                                                                                                                                                                                     |
| `web/supabase/functions/criar-cobranca/index.ts`                         |    110 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-040, AUD-048                                                                                                                                                                                              |
| `web/supabase/functions/entrar-com-documento/index.ts`                   |     59 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-007, AUD-021, AUD-147                                                                                                                                                                                     |
| `web/supabase/functions/entrar-com-firebase/index.ts`                    |    127 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-007, AUD-019, AUD-085, AUD-194                                                                                                                                                                            |
| `web/supabase/functions/enviar-push/index.ts`                            |    106 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-084                                                                                                                                                                                                       |
| `web/supabase/functions/excluir-conta/index.ts`                          |     75 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-002, AUD-019                                                                                                                                                                                              |
| `web/supabase/functions/limpar-arquivos/index.ts`                        |     46 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-001, AUD-141                                                                                                                                                                                              |
| `web/supabase/functions/verificar-cadastro/index.ts`                     |     79 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-007, AUD-021                                                                                                                                                                                              |
| `web/supabase/functions/verificar-cnpj/index.ts`                         |     82 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-018, AUD-049                                                                                                                                                                                              |
| `web/supabase/functions/webhook-pagamento/index.ts`                      |     64 | D4       | lido por inteiro (D5); lido por inteiro (D4)                                                                                                   | AUD-048, AUD-200                                                                                                                                                                                              |
| `web/supabase/legado/000_baseline.sql`                                   |    844 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-024                                                                                                                                                                                                       |
| `web/supabase/legado/001_bicos_vagas_columns.sql`                        |     28 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/002_bicos_vagas_valor_turno_nullable.sql`           |     21 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/003_bicos_profiles_whatsapp.sql`                    |     13 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/004_bicos_candidaturas_status.sql`                  |     27 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/005_bicos_whatsapp_rpc.sql`                         |     56 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/006_bicos_candidatura_rpcs.sql`                     |    122 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/007_bicos_profiles_extra_columns.sql`               |     76 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/008_bicos_avaliacoes.sql`                           |     36 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/009_bicos_vagas_salvas.sql`                         |     30 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/010_bicos_portfolio.sql`                            |     59 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/011_bicos_avaliacao_rpcs.sql`                       |     78 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/012_bicos_vagas_fotos_dias.sql`                     |     21 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/legado/LEIA.md`                                            |      9 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-047, AUD-073, AUD-192                                                                                                                                                                                     |
| `web/supabase/migrations/20261009000100_bicos_v2_schema.sql`             |    323 | D1       | lido por inteiro (D1)                                                                                                                          | AUD-004                                                                                                                                                                                                       |
| `web/supabase/migrations/20261009000200_bicos_v2_rules.sql`              |   1361 | D1       | lido por inteiro (D1)                                                                                                                          | AUD-021, AUD-044                                                                                                                                                                                              |
| `web/supabase/migrations/20261009000300_bicos_v2_data.sql`               |     80 | D1       | lido por inteiro (D1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261010000100_z01_rpcs_candidatura.sql`        |    483 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-015                                                                                                                                                                                                       |
| `web/supabase/migrations/20261010000200_z02_pagamentos.sql`              |    231 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261010000300_z07_documento_login.sql`         |    195 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-056, AUD-130                                                                                                                                                                                              |
| `web/supabase/migrations/20261010000400_z08_app_antigo.sql`              |     64 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261010000500_z09_cpf_metadados.sql`           |     51 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261010000600_z06_endereco.sql`                |     40 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-145                                                                                                                                                                                                       |
| `web/supabase/migrations/20261010000700_z12_fotos.sql`                   |    139 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-012, AUD-106, AUD-141                                                                                                                                                                                     |
| `web/supabase/migrations/20261011000100_y01_y04_ciclo_vaga.sql`          |    209 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261011000200_x01_mural.sql`                   |    118 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261011000300_y16_y17_documento.sql`           |    158 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-056, AUD-080, AUD-129, AUD-130                                                                                                                                                                            |
| `web/supabase/migrations/20261011000400_y18_media_notas.sql`             |     31 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261011000500_y24_verificacao.sql`             |     64 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-014, AUD-190                                                                                                                                                                                              |
| `web/supabase/migrations/20261011000600_y25_whatsapp.sql`                |    139 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-080                                                                                                                                                                                                       |
| `web/supabase/migrations/20261011000700_y28_alerta_bico.sql`             |     96 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-128                                                                                                                                                                                                       |
| `web/supabase/migrations/20261012000100_l18_pagamento.sql`               |    149 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-145                                                                                                                                                                                                       |
| `web/supabase/migrations/20261012000200_l22_desfazer_recusa.sql`         |     57 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261012000300_l11_validacao_perfil.sql`        |     18 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-131                                                                                                                                                                                                       |
| `web/supabase/migrations/20261012000400_l14_maior_idade.sql`             |     33 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261012000500_f12_presenca.sql`                |     95 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261012000600_f15_responsavel.sql`             |     39 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261012000700_l10_cnpj_receita.sql`            |     58 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-129                                                                                                                                                                                                       |
| `web/supabase/migrations/20261012000800_l13_conta_google.sql`            |     52 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-056                                                                                                                                                                                                       |
| `web/supabase/migrations/20261012000900_f18_membros.sql`                 |     43 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261012033541_habilitar_pg_net.sql`            |      3 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261013000100_f09_vaga_publica.sql`            |     24 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261013000200_f10_perfil_profissional.sql`     |     37 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-078, AUD-190                                                                                                                                                                                              |
| `web/supabase/migrations/20261013000300_f13_convite.sql`                 |     84 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-028, AUD-143                                                                                                                                                                                              |
| `web/supabase/migrations/20261013000400_f04_denuncia_bloqueio.sql`       |    136 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-013, AUD-127, AUD-143                                                                                                                                                                                     |
| `web/supabase/migrations/20261013000500_f06_preferencias_aviso.sql`      |     66 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261013000600_f16_portfolio.sql`               |     13 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261013000700_f07_identidade.sql`              |    110 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-077                                                                                                                                                                                                       |
| `web/supabase/migrations/20261014000100_x13_avisos_seguranca.sql`        |    102 | D1       | lido por inteiro (D1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261014000200_x15_rls_desempenho.sql`          |    115 | D1       | lido por inteiro (D1)                                                                                                                          | AUD-143                                                                                                                                                                                                       |
| `web/supabase/migrations/20261014000300_x03_push.sql`                    |    111 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-137                                                                                                                                                                                                       |
| `web/supabase/migrations/20261014000400_x09_arquivos_orfaos.sql`         |     99 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-001, AUD-002, AUD-141                                                                                                                                                                                     |
| `web/supabase/migrations/20261014000500_x21_funil.sql`                   |     48 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261014000600_w08_limites_vaga.sql`            |    100 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261014000700_x22_limpeza_tentativas.sql`      |     26 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-009                                                                                                                                                                                                       |
| `web/supabase/migrations/20261014000800_x23_indices_fk.sql`              |      9 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261015000100_lanc06_backoffice.sql`           |    540 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-055, AUD-081, AUD-082, AUD-087, AUD-122                                                                                                                                                                   |
| `web/supabase/migrations/20261015000200_lanc07_aceites.sql`              |    207 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-079                                                                                                                                                                                                       |
| `web/supabase/migrations/20261016000100_lanc09_pg_net.sql`               |     30 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261016000200_lanc10_link_publico.sql`         |    106 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-007, AUD-009, AUD-083, AUD-213                                                                                                                                                                            |
| `web/supabase/migrations/20261016000300_lanc12_vigia_cron.sql`           |    163 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-001, AUD-146                                                                                                                                                                                              |
| `web/supabase/migrations/20261016000400_lanc13_mural_volume.sql`         |     94 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-201                                                                                                                                                                                                       |
| `web/supabase/migrations/20261017000100_r03_suspensao_completa.sql`      |    138 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-013                                                                                                                                                                                                       |
| `web/supabase/migrations/20261017000200_r04_exclusao_pelo_painel.sql`    |    147 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-190                                                                                                                                                                                                       |
| `web/supabase/migrations/20261019000100_u01_vaga_simples.sql`            |    223 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-128, AUD-133, AUD-144                                                                                                                                                                                     |
| `web/supabase/migrations/20261019000200_u06_sem_encerrar_vaga.sql`       |     42 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261020000100_u10_dados_unicos.sql`            |    169 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-047, AUD-056, AUD-099                                                                                                                                                                                     |
| `web/supabase/migrations/20261020000200_u12_perfil_simples.sql`          |    229 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261020000300_u24_exclusao_completa.sql`       |     89 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-006, AUD-022, AUD-057                                                                                                                                                                                     |
| `web/supabase/migrations/20261021000100_u30_tema_da_conta.sql`           |     46 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261021000200_u32_perfis.sql`                  |     45 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261021000300_u37_cadastro_google.sql`         |     22 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-047                                                                                                                                                                                                       |
| `web/supabase/migrations/20261021000400_u49_busca_vagas.sql`             |    100 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-063, AUD-133                                                                                                                                                                                              |
| `web/supabase/migrations/20261021000500_u48_publico_geral.sql`           |    683 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-005, AUD-006, AUD-028, AUD-055, AUD-057, AUD-193                                                                                                                                                          |
| `web/supabase/migrations/20261021000600_u51_endereco.sql`                |    258 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-008, AUD-020, AUD-092, AUD-132, AUD-193                                                                                                                                                                   |
| `web/supabase/migrations/20261021000700_u52_dias_e_local.sql`            |    424 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-003, AUD-004, AUD-005, AUD-007, AUD-016, AUD-193                                                                                                                                                          |
| `web/supabase/migrations/20261021000800_u53_endereco_publico.sql`        |    101 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-003                                                                                                                                                                                                       |
| `web/supabase/migrations/20261022000100_u62_empresa_sem_endereco.sql`    |     60 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/migrations/20261022000200_u63_um_nome_so.sql`              |     72 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-056                                                                                                                                                                                                       |
| `web/supabase/migrations/20261022000300_u65_valor_minimo.sql`            |    105 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-004                                                                                                                                                                                                       |
| `web/supabase/migrations/20261024000100_u67_cidade_da_empresa.sql`       |     45 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/pendentes/20261015000900_lanc07_apagar_app_antigo.sql`     |    102 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-024, AUD-047                                                                                                                                                                                              |
| `web/supabase/pendentes/LEIA.md`                                         |     13 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-047, AUD-073, AUD-192                                                                                                                                                                                     |
| `web/supabase/tests/_helpers.sql`                                        |    129 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-188                                                                                                                                                                                                       |
| `web/supabase/tests/f04_denuncia_bloqueio.sql`                           |     36 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-013, AUD-127, AUD-143                                                                                                                                                                                     |
| `web/supabase/tests/f06_preferencias_aviso.sql`                          |     22 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/f07_identidade.sql`                                  |     23 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-077                                                                                                                                                                                                       |
| `web/supabase/tests/f09_vaga_publica.sql`                                |     18 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/f10_perfil_profissional.sql`                         |     19 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-078, AUD-179, AUD-190                                                                                                                                                                                     |
| `web/supabase/tests/f12_presenca.sql`                                    |     40 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-179, AUD-180                                                                                                                                                                                              |
| `web/supabase/tests/f13_convite.sql`                                     |     28 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-028, AUD-143                                                                                                                                                                                              |
| `web/supabase/tests/f16_portfolio.sql`                                   |     14 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/f18_membros.sql`                                     |     10 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/l10_cnpj.sql`                                        |     19 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-179                                                                                                                                                                                                       |
| `web/supabase/tests/l11_validacao_perfil.sql`                            |     10 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-131, AUD-179                                                                                                                                                                                              |
| `web/supabase/tests/l13_conta_google.sql`                                |     18 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-056, AUD-179                                                                                                                                                                                              |
| `web/supabase/tests/l14_maior_idade.sql`                                 |      8 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/l18_pagamento.sql`                                   |     42 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-145                                                                                                                                                                                                       |
| `web/supabase/tests/l22_desfazer_recusa.sql`                             |     36 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-179                                                                                                                                                                                                       |
| `web/supabase/tests/lanc06_backoffice.sql`                               |    137 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-055, AUD-081, AUD-082, AUD-087, AUD-122                                                                                                                                                                   |
| `web/supabase/tests/lanc07_aceites.sql`                                  |     39 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-079                                                                                                                                                                                                       |
| `web/supabase/tests/lanc09_pg_net.sql`                                   |     16 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-179                                                                                                                                                                                                       |
| `web/supabase/tests/lanc10_link_publico.sql`                             |     51 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-007, AUD-009, AUD-083, AUD-213                                                                                                                                                                            |
| `web/supabase/tests/lanc12_vigia_cron.sql`                               |     64 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-001, AUD-146, AUD-179                                                                                                                                                                                     |
| `web/supabase/tests/lanc13_mural_volume.sql`                             |     49 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-201                                                                                                                                                                                                       |
| `web/supabase/tests/local/setup.sh`                                      |     24 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/tests/local/shim.sql`                                      |     50 | O2       | lido por inteiro (O2)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/tests/r03_suspensao_completa.sql`                          |    106 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-013                                                                                                                                                                                                       |
| `web/supabase/tests/r04_exclusao_pelo_painel.sql`                        |     75 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-190                                                                                                                                                                                                       |
| `web/supabase/tests/run.mjs`                                             |     57 | O2       | lido por inteiro (O2)                                                                                                                          | AUD-188                                                                                                                                                                                                       |
| `web/supabase/tests/seguranca.sql`                                       |     52 | D1       | lido por inteiro (D1)                                                                                                                          | AUD-179, AUD-191                                                                                                                                                                                              |
| `web/supabase/tests/u01_vaga_simples.sql`                                |     51 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-128, AUD-133, AUD-144                                                                                                                                                                                     |
| `web/supabase/tests/u06_sem_encerrar_vaga.sql`                           |     44 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/u10_dados_unicos.sql`                                |     66 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-047, AUD-056, AUD-099                                                                                                                                                                                     |
| `web/supabase/tests/u12_perfil_simples.sql`                              |     34 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-193                                                                                                                                                                                                       |
| `web/supabase/tests/u24_exclusao_completa.sql`                           |     83 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-006, AUD-022, AUD-057                                                                                                                                                                                     |
| `web/supabase/tests/u30_tema_da_conta.sql`                               |     27 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/u32_perfis.sql`                                      |     43 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/u37_cadastro_google.sql`                             |     30 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-047                                                                                                                                                                                                       |
| `web/supabase/tests/u48_publico_geral.sql`                               |     32 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-005, AUD-006, AUD-028, AUD-055, AUD-057, AUD-078, AUD-193                                                                                                                                                 |
| `web/supabase/tests/u49_busca_vagas.sql`                                 |     47 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-063, AUD-133                                                                                                                                                                                              |
| `web/supabase/tests/u51_endereco.sql`                                    |     76 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-008, AUD-020, AUD-092, AUD-132, AUD-193                                                                                                                                                                   |
| `web/supabase/tests/u52_dias_e_local.sql`                                |     73 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-003, AUD-004, AUD-005, AUD-007, AUD-016, AUD-193                                                                                                                                                          |
| `web/supabase/tests/u53_endereco_publico.sql`                            |     21 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-003                                                                                                                                                                                                       |
| `web/supabase/tests/u62_empresa_sem_endereco.sql`                        |     31 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/u63_um_nome_so.sql`                                  |     12 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-056                                                                                                                                                                                                       |
| `web/supabase/tests/u65_valor_minimo.sql`                                |     34 | D3c      | lido por inteiro (D3c)                                                                                                                         | AUD-004                                                                                                                                                                                                       |
| `web/supabase/tests/u67_cidade_da_empresa.sql`                           |     23 | D3c      | lido por inteiro (D3c)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/w08_limites_vaga.sql`                                |     16 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/x01_mural.sql`                                       |     49 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-179, AUD-180                                                                                                                                                                                              |
| `web/supabase/tests/x03_push.sql`                                        |     44 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-137, AUD-179                                                                                                                                                                                              |
| `web/supabase/tests/x09_arquivos_orfaos.sql`                             |     33 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-001, AUD-002, AUD-141                                                                                                                                                                                     |
| `web/supabase/tests/x13_avisos_seguranca.sql`                            |     36 | D1       | lido por inteiro (D1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/tests/x15_rls_spam.sql`                                    |     44 | D1       | lido por inteiro (D1)                                                                                                                          |                                                                                                                                                                                                               |
| `web/supabase/tests/x21_funil.sql`                                       |     17 | D3b      | lido por inteiro (D3b)                                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/x22_limpeza_tentativas.sql`                          |     23 | D3b      | lido por inteiro (D3b)                                                                                                                         | AUD-009                                                                                                                                                                                                       |
| `web/supabase/tests/y01_y04_ciclo.sql`                                   |     78 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-179, AUD-180                                                                                                                                                                                              |
| `web/supabase/tests/y16_y17_documento.sql`                               |     45 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-056, AUD-080, AUD-129, AUD-130, AUD-180                                                                                                                                                                   |
| `web/supabase/tests/y18_media_notas.sql`                                 |     51 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/y24_verificacao.sql`                                 |     30 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-014, AUD-179, AUD-190                                                                                                                                                                                     |
| `web/supabase/tests/y25_whatsapp.sql`                                    |     55 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-080                                                                                                                                                                                                       |
| `web/supabase/tests/y28_alerta_bico.sql`                                 |     48 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-063, AUD-128                                                                                                                                                                                              |
| `web/supabase/tests/z01_candidaturas.sql`                                |    164 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-179                                                                                                                                                                                                       |
| `web/supabase/tests/z02_pagamentos.sql`                                  |     87 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-142, AUD-179                                                                                                                                                                                              |
| `web/supabase/tests/z06_endereco.sql`                                    |     41 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-145, AUD-180                                                                                                                                                                                              |
| `web/supabase/tests/z07_documento.sql`                                   |     52 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-056                                                                                                                                                                                                       |
| `web/supabase/tests/z08_app_antigo.sql`                                  |     29 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-180                                                                                                                                                                                                       |
| `web/supabase/tests/z09_cpf_metadados.sql`                               |     12 | D3a      | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/supabase/tests/z12_fotos.sql`                                       |     31 | D3a      | lido por inteiro (relatório do agente)                                                                                                         | AUD-012, AUD-106, AUD-141, AUD-179                                                                                                                                                                            |
| `web/tailwind.config.js`                                                 |     46 | Q1       | lido por inteiro (lista do agente)                                                                                                             |                                                                                                                                                                                                               |
| `web/tsconfig.app.json`                                                  |     23 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/tsconfig.json`                                                      |      4 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/tsconfig.node.json`                                                 |     18 | O1       | lido por inteiro (relatório do agente)                                                                                                         |                                                                                                                                                                                                               |
| `web/vite.config.ts`                                                     |    171 | Q1       | lido por inteiro (apoio) (C2)                                                                                                                  | AUD-010, AUD-064, AUD-068, AUD-072, AUD-148, AUD-149, AUD-175, AUD-186, AUD-189                                                                                                                               |

### 8.2 Rotas × perfil × tamanho de tela

55 rotas (de `web/src/routes.ts`). `ok` = abriu e se comportou, `falha` = defeito reproduzido (ver achados), `n/v` = não verificável (motivo em 8.6). A equipe e a conta suspensa não existem no demo. Células `falha`: **2**.

| Rota                        | Guarda      | Visitante 360 | Visitante 1280 | Trabalhador 360 | Trabalhador 1280 | Empresa 360 | Empresa 1280 | Equipe             | Suspensa |
| --------------------------- | ----------- | ------------- | -------------- | --------------- | ---------------- | ----------- | ------------ | ------------------ | -------- |
| `/splash`                   | guest       | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/escolha-perfil`           | guest       | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/cadastro/:role`           | guest       | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/login`                    | guest       | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/entrar-celular`           | guest       | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/verificar-email`          | onboarding  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/completar-perfil/:role`   | onboarding  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/aceitar-termos`           | onboarding  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/esqueci-senha`            | public      | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/redefinir-senha`          | public      | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/termos`                   | public      | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/privacidade`              | public      | falha         | ok             | falha           | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/conta-excluida`           | public      | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/completar-cadastro`       | public ⚠    | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/v/:id`                    | public ⚠    | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/ajuda`                    | public ⚠    | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/mural`                    | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/vaga/:id`                 | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/notificacoes`             | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/whatsapp`                 | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/configuracoes`            | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/senha`                    | app         | n/v           | n/v            | n/v             | n/v              | n/v         | n/v          | n/v (demo não tem) | n/v      |
| `/email`                    | app         | n/v           | n/v            | n/v             | n/v              | n/v         | n/v          | n/v (demo não tem) | n/v      |
| `/bloqueados`               | app         | n/v           | n/v            | n/v             | n/v              | n/v         | n/v          | n/v (demo não tem) | n/v      |
| `/avisos`                   | app         | n/v           | n/v            | n/v             | n/v              | n/v         | n/v          | n/v (demo não tem) | n/v      |
| `/excluir-conta`            | app         | n/v           | n/v            | n/v             | n/v              | n/v         | n/v          | n/v (demo não tem) | n/v      |
| `/trabalhador/:id`          | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/construtora/:id`          | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/avaliacoes/:type/:id`     | app         | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/admin`                    | app         | ok            | ok             | ok              | ok               | ok          | ok           | revisado no código | n/v      |
| `/confirmar/:id`            | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/enviado/:id`              | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/minhas-candidaturas`      | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/vagas-salvas`             | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/selecionado/:id`          | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/avaliar/:id`              | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/perfil`                   | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/perfil/editar`            | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/perfil/verificar`         | trabalhador | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/trabalhador/:id/:job`     | recrutador  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/empresa`                  | recrutador  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/empresa/editar`           | recrutador  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/criar-vaga`               | recrutador  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/vaga-editar/:id`          | recrutador  | n/v           | n/v            | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/publicar-de-novo/:id`     | recrutador  | n/v           | n/v            | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/vaga-publicada/:id`       | recrutador  | n/v           | n/v            | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/vaga-gerenciar/:id`       | recrutador  | n/v           | n/v            | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/fechado/:id`              | recrutador  | n/v           | n/v            | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/impulsionar/:id`          | recrutador  | n/v           | n/v            | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/impulsionar/:id/:plan`    | recrutador  | n/v           | n/v            | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/historico`                | recrutador  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/minhas-vagas`             | recrutador  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/pagamentos`               | recrutador  | ok            | ok             | ok              | ok               | ok          | ok           | n/v (demo não tem) | n/v      |
| `/avaliar-trabalhador/:job` | recrutador  | n/v           | n/v            | n/v             | n/v              | n/v         | n/v          | n/v (demo não tem) | n/v      |
| `/:worker`                  | recrutador  | n/v           | n/v            | n/v             | n/v              | ok          | ok           | n/v (demo não tem) | n/v      |

As rotas `/v/:id`, `/ajuda` e `/completar-cadastro` funcionam no demo mas **quebram sem login no build de produção** (AUD do AUD-007), reproduzido no navegador com Supabase interceptado (`dist-c2`); a matriz acima reflete o demo.

### 8.3 Inventário de interações

Botões, links, campos, filtros, menus, modais e gestos por tela, com estados (carregando, vazio, erro, offline, sessão expirada, lista longa, texto longo, clique duplo, voltar, recarregar, link profundo): `web/docs/auditoria/interacoes-b1.md` (visitante e trabalhador), `web/docs/auditoria/interacoes-b2.md` (empresa) e as matrizes por rota em `web/docs/auditoria/cobertura-rotas-b1.tsv` / `cobertura-rotas-b2.tsv`. Prints (339 do B1, 100 do P1, os do B2/C3/C6/Q1) ficaram fora do Git, no ambiente da auditoria.

### 8.4 Banco de dados, Storage e Edge Functions

#### Tabelas do schema `public` no staging (39; RLS ligada em todas)

| Tabela                             | RLS | Políticas | Gatilhos | Comandos das políticas      | Grants de tabela (anon/authenticated) | Revisado por |
| ---------------------------------- | --- | --------: | -------: | --------------------------- | ------------------------------------- | ------------ |
| `account_prefs`                    | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1           |
| `accounts`                         | sim |         1 |        3 | SELECT                      | (só colunas)                          | D1,D5        |
| `addresses`                        | sim |         1 |        0 | SELECT                      | (só colunas)                          | D1,D3c       |
| `app_config`                       | sim |         0 |        0 | —                           | nenhum                                | D1           |
| `application_attempts`             | sim |         0 |        0 | —                           | nenhum                                | D1           |
| `application_events`               | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1,M1        |
| `applications`                     | sim |         1 |        3 | SELECT                      | authenticated:SELECT                  | D1,M1,D2     |
| `auth_attempts`                    | sim |         0 |        0 | —                           | nenhum                                | D1,D4,D5     |
| `avaliacoes (legada)`              | sim |         0 |        0 | —                           | nenhum                                | D1,D5        |
| `blocks`                           | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1,D2        |
| `boost_payments`                   | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1,D4        |
| `candidaturas (legada)`            | sim |         0 |        0 | —                           | nenhum                                | D1,D5        |
| `companies`                        | sim |         2 |        4 | SELECT,UPDATE               | (só colunas)                          | D1,D2        |
| `company_members`                  | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1,D2        |
| `consentimentos (legada)`          | sim |         0 |        0 | —                           | nenhum                                | D1,D5        |
| `cron_alerts`                      | sim |         0 |        0 | —                           | nenhum                                | D1,D3b       |
| `identity_submissions`             | sim |         0 |        0 | —                           | nenhum                                | D1,D5        |
| `job_alerts`                       | sim |         1 |        0 | SELECT                      | (só colunas)                          | D1,D2        |
| `job_invites`                      | sim |         1 |        1 | SELECT                      | authenticated:SELECT                  | D1,D2        |
| `jobs`                             | sim |         1 |        6 | SELECT                      | (só colunas)                          | D1,D2,D3c    |
| `notification_prefs`               | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1           |
| `notifications`                    | sim |         2 |        1 | SELECT,UPDATE               | authenticated:SELECT                  | D1           |
| `oficios`                          | sim |         1 |        0 | SELECT                      | anon:SELECT authenticated:SELECT      | D1           |
| `payment_webhook_events`           | sim |         0 |        0 | —                           | nenhum                                | D1,D4        |
| `profiles (legada)`                | sim |         0 |        1 | —                           | nenhum                                | D1,D5        |
| `public_link_hits`                 | sim |         0 |        0 | —                           | nenhum                                | D1,D3b       |
| `publicacoes_trabalhador (legada)` | sim |         0 |        0 | —                           | nenhum                                | D1,D5        |
| `push_subscriptions`               | sim |         0 |        0 | —                           | nenhum                                | D1,D4        |
| `reports`                          | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1,D2        |
| `reviews`                          | sim |         1 |        0 | SELECT                      | authenticated:SELECT                  | D1,D2        |
| `saved_jobs`                       | sim |         3 |        0 | DELETE,INSERT,SELECT        | authenticated:DELETE,INSERT,SELECT    | D1           |
| `staff_actions`                    | sim |         0 |        0 | —                           | nenhum                                | D1,D3b       |
| `staff_members`                    | sim |         0 |        0 | —                           | nenhum                                | D1,D3b       |
| `terms_acceptances`                | sim |         0 |        0 | —                           | nenhum                                | D1,D2        |
| `vagas (legada)`                   | sim |         0 |        1 | —                           | nenhum                                | D1,D5        |
| `vagas_salvas (legada)`            | sim |         0 |        0 | —                           | nenhum                                | D1           |
| `whatsapp_verifications`           | sim |         0 |        0 | —                           | nenhum                                | D1,D4        |
| `worker_posts`                     | sim |         4 |        1 | DELETE,INSERT,SELECT,UPDATE | authenticated:DELETE,SELECT           | D1,D2        |
| `workers`                          | sim |         2 |        5 | SELECT,UPDATE               | (só colunas)                          | D1,D2        |

Nenhuma política `for all`; `using (true)` só em `oficios` (catálogo) e nas leituras públicas deliberadas de `workers`/`companies`/`reviews`/`worker_posts` para quem está logado (ver AUD-045 → moderação). Tabelas sem política e sem grant (`app_config`, `auth_attempts`, `identity_submissions`, `push_subscriptions`, `terms_acceptances`, `staff_*`, `cron_alerts` e as 7 legadas) ficam fechadas: só RPC `security definer`/`service_role` mexe nelas.

#### Cron, buckets e políticas de Storage

| Tipo             | Nome                                    | Detalhe                                            | Revisado por                                |
| ---------------- | --------------------------------------- | -------------------------------------------------- | ------------------------------------------- |
| cron             | bicos-concluir-diarias                  | 7 * * * *                                          | D2,D3a,M1                                   |
| cron             | bicos-lembrar-presenca                  | 0 21 * * *                                         | D2,D3b                                      |
| cron             | bicos-limpar-arquivos                   | 40 4 * * *                                         | D3b,D4,D5 (AUD-006: não apaga nada de fato) |
| cron             | bicos-limpar-cadastros                  | 23 3 * * *                                         | D3b,D3c                                     |
| cron             | bicos-limpar-tentativas                 | 17 4 * * *                                         | D3a,D3b                                     |
| cron             | bicos-vencer-pix                        | */10 * * * *                                       | D2,D4                                       |
| cron             | bicos-vigiar-cron                       | 12 * * * *                                         | D3b (AUD-139)                               |
| bucket           | avatars                                 | público; 10 MB; jpeg/png/webp                      | D1,D4                                       |
| bucket           | identidade                              | privado; 10 MB; jpeg/png/webp                      | D1,D4,D5                                    |
| bucket           | portfolio                               | público; 50 MB; jpeg/png/webp + mp4/quicktime/webm | D1,D4,C2 (AUD-008)                          |
| bucket           | vagas                                   | público; 10 MB; jpeg/png/webp                      | D1,D4                                       |
| politica_storage | Cada um atualiza seu proprio avatar     | UPDATE authenticated                               | D1                                          |
| politica_storage | Cada um envia seu proprio avatar        | INSERT authenticated                               | D1                                          |
| politica_storage | Cada um envia seu proprio portfolio     | INSERT authenticated                               | D1                                          |
| politica_storage | Cada um remove seu proprio avatar       | DELETE authenticated                               | D1                                          |
| politica_storage | Cada um remove seu proprio portfolio    | DELETE authenticated                               | D1                                          |
| politica_storage | Construtora envia foto da própria vaga  | INSERT authenticated                               | D1                                          |
| politica_storage | Construtora remove foto da própria vaga | DELETE authenticated                               | D1                                          |
| politica_storage | Equipe lê as fotos de identidade        | SELECT authenticated                               | D1,D5                                       |
| politica_storage | Trabalhador envia a própria identidade  | INSERT authenticated                               | D1                                          |

#### Funções (RPCs, gatilhos e internas)

184 linhas em `web/docs/auditoria/cobertura-banco-funcoes.tsv` (uma por função de `public`, com ACL, `search_path` e resultado). Resumo do D2: 176 funções; 62 executáveis por `authenticated`, 1 por `anon` (`public_job_card`); todas `security definer` com `search_path` fixo; nenhuma com overload; 176/176 corpos iguais à última migration que os define.

#### Edge Functions (10)

| Função                 | JWT           | Revisado por         | Achados                   |
| ---------------------- | ------------- | -------------------- | ------------------------- |
| `entrar-com-documento` | sim           | D4 (+O2 para testes) | AUD-005, AUD-140, AUD-141 |
| `verificar-cadastro`   | sim           | D4 (+O2 para testes) | AUD-005, AUD-065          |
| `entrar-com-firebase`  | sim           | D4 (+O2 para testes) | AUD-067, AUD-200, AUD-017 |
| `excluir-conta`        | sim           | D4 (+O2 para testes) | AUD-001                   |
| `codigo-whatsapp`      | sim           | D4 (+O2 para testes) | AUD-102                   |
| `verificar-cnpj`       | sim           | D4 (+O2 para testes) | AUD-013                   |
| `criar-cobranca`       | sim           | D4 (+O2 para testes) | AUD-038, AUD-032          |
| `webhook-pagamento`    | não (HMAC)    | D4 (+O2 para testes) | AUD-038, AUD-179, AUD-206 |
| `enviar-push`          | não (segredo) | D4 (+O2 para testes) | AUD-066                   |
| `limpar-arquivos`      | não (segredo) | D4 (+O2 para testes) | AUD-006, AUD-133          |

Obs.: `deno check` e `deno lint` rodaram sem erro (D4, Deno 2.5.4); nenhuma função tem teste automatizado (AUD-054).

### 8.5 Comandos rodados

Os caminhos `out/<agente>/…` citados nos achados são da pasta temporária de trabalho dos agentes (scripts de reprodução, prints, logs): **não foram versionados**. O passo a passo e o resultado de cada prova estão escritos no próprio achado e em `auditoria/por-agente/`.

| Comando / consulta                                     | Resultado resumido                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git fetch --all --prune`; comparação de branches      | `master`=5bddd2c (24/10); `claude/eloquent-heisenberg-y5hwt6`=67d9ffb = master + 6 commits (limpeza, X30–X32); `front-novo-supabase`, `bicos-cleanup-optimization` e `nivotech-react-typescript-migration` são antigas (repositório raso: 50 commits) |
| CI do commit auditado (GitHub Actions run 40389156966) | `checks` ✔, `sql` ✔ (migrations + testes SQL + `APLICAR-TUDO.sql` e tipos em dia), `e2e` **pulado** (AUD-190)                                                                                                                                         |
| `npm ci`                                               | exit 0; aviso EBADENGINE do Firebase (Node ≥ 24.12; CI usa 22)                                                                                                                                                                                        |
| `npm run typecheck` / `lint` / `format:check`          | exit 0 / 0 / 0                                                                                                                                                                                                                                        |
| `npm test`                                             | 287 testes em 35 arquivos, todos passam (CLAUDE.md diz 282/34); 2 repetições, 5 sementes de `--sequence.shuffle` e `TZ` UTC/São Paulo/Los Angeles passam; Tóquio/Kiritimati e relógio 21h–23h59 de Brasília falham (AUD-127 → AUD-127)                |
| `npm run build` (sem variáveis)                        | falha como previsto (L01)                                                                                                                                                                                                                             |
| `npm run build:demo` / `build:standalone`              | ok; precache do SW 123 entradas (3.076 KiB); `index` 653 KB (202 KB gz); `heic2any` 1.353 KB; standalone 3.325 KB num HTML                                                                                                                            |
| `npm audit --omit=dev`                                 | 0 vulnerabilidades (com dev: 9, AUD-187)                                                                                                                                                                                                              |
| `npm outdated`                                         | 24 pacotes atrás; nada crítico em produção                                                                                                                                                                                                            |
| `madge --circular`                                     | 24 ciclos entre `services/*` (acoplamento)                                                                                                                                                                                                            |
| `knip`                                                 | 30 "arquivos sem uso" (quase todos pontos de entrada de scripts/funções), 16 exports sem uso, `pixelmatch`/`pngjs` (em uso por `scripts/limpeza`, O1)                                                                                                 |
| `depcheck`                                             | só falsos positivos (`jsr:`, `npm:`, `virtual:`)                                                                                                                                                                                                      |
| `tsc --noUnusedLocals --noUnusedParameters`            | exit 0                                                                                                                                                                                                                                                |
| `deno check` / `deno lint` (D4)                        | limpos nas 10 funções                                                                                                                                                                                                                                 |
| Testes SQL locais                                      | **não rodaram**: sem Docker Hub (429), ECR/GHCR bloqueados, sem daemon; evidência = CI verde acima; `ok()`/`fails()` provados num Postgres embutido (PGlite, O2)                                                                                      |
| E2E Playwright                                         | não rodou local (sem staging acessível); evidência = run 40117427320 (staging.yml, verde)                                                                                                                                                             |
| Advisors de segurança (produção)                       | 14 tabelas com RLS sem política (INFO, esperado), `pg_net` no `public` (WARN), 1 RPC `anon`, 42 RPCs `authenticated` (esperado), proteção de senha vazada desligada                                                                                   |
| Advisors de desempenho (produção)                      | `application_attempts` sem chave primária; 17 índices nunca usados (banco quase vazio)                                                                                                                                                                |
| Catálogo do staging (D1, D2, D3a–c)                    | 39 tabelas, 176 funções, 67 migrations = 67 arquivos; `database.generated.ts` e `APLICAR-TUDO.sql` conferidos                                                                                                                                         |
| Produção (só catálogo/`count`)                         | 50 migrations aplicadas (parou em 12/10); faltam 25 (lanc06…u67); 4 contas, 0 vagas                                                                                                                                                                   |
| Lighthouse mobile (Q1)                                 | `/` 96–99; `/login` 90–98; `/cadastro/trabalhador` 74–86 (LCP 3,9–4,9 s)                                                                                                                                                                              |
| axe 4.10.3 (Q1)                                        | 128 varreduras (31 telas × 2 tamanhos × 2 temas) sem violação; mas o script do CI varre 2 rotas 404 (AUD-184)                                                                                                                                         |
| Playwright B1/B2/P1/C3/C6/Q1                           | ~120 + 87 rotas × 2 tamanhos sem erro de console; defeitos nos achados citados                                                                                                                                                                        |

### 8.6 O que não foi possível verificar (e o risco que fica)

- **Staging por rede**: o proxy do ambiente recusa `*.supabase.co`; tudo no staging foi lido/provado pelo conector (transações desfeitas). Não foi possível abrir o app real contra o staging.
- **Testes SQL e E2E locais**: sem Docker (Docker Hub 429, ECR/GHCR bloqueados). Risco: a prova de que os 66 testes SQL passam é o CI de 26/10.
- **Concorrência real** (duas sessões simultâneas: dupla aprovação, limites diários, deadlocks): o conector roda uma sessão por chamada; conclusões por leitura de código e locks (AUD-134, AUD-135). Recomendado `pgbench`.
- **Painéis**: Auth do Supabase (confirmação de e-mail, captcha, SMTP, validade do JWT, Site URL), Firebase, Twilio, Brevo, Sentry, Cloudflare Pages, plano/backup do Supabase, permissões do GitHub Actions. Risco: configuração real pode diferir do documentado.
- **Dispositivos reais**: leitor de tela (TalkBack/VoiceOver), Android de entrada, iPhone/Safari/WebKit, navegadores embutidos (WhatsApp/Instagram), instalação do PWA. Risco: defeitos só de aparelho.
- **Provedores externos ligados**: Mercado Pago (PIX/cartão), Turnstile, Twilio, push, Google/Firebase de verdade (estão desligados ou simulados no demo).
- **Equipe (`/admin`) e conta suspensa em tempo de execução**: o demo não tem; revisado só no código e no banco.
- **Mapa e rota** (tiles/OSRM) no navegador: sem rede externa no contêiner.
- **DNS de e-mail** (SPF, DKIM, DMARC de `nivotech.com.br`): sem `dig` nem DNS no contêiner. Risco: e-mails de cadastro caírem em spam se o domínio não estiver autenticado (hipótese H9).
- **Documentação do Mercado Pago**: o host não resolve no contêiner; a regra de validade mínima do PIX (H1) ficou como hipótese para testar no sandbox.
- **Schemas expostos pela API** (`pgrst.db_schemas`) do projeto: não é legível pelo conector (hipótese H13).
- **Conteúdo dos artefatos do E2E** publicados no GitHub: o download passa por um host bloqueado; só os nomes e as datas foram vistos.
- **Leitura parcial de dados de demonstração**: `data/seed.ts` (miolo) e `scripts/staging/fotos-vagas-teste.mjs` foram só amostrados (8.1, coluna "Como").
- **Rodadas dinâmicas do caçador**: sandbox do Mercado Pago, navegador real com a CSP e o link `#access_token`, Firebase real e teste de carga no mural não foram possíveis; é onde uma terceira rodada ainda renderia (8.7).
- **Dados reais**: a produção tem 4 contas e 0 vagas; nenhum achado depende de volume real, mas desempenho e limites precisam de teste de volume (`scripts/volume`, só no staging).

### 8.7 Revisão adversária

**Como foi feita.** Depois que os 20 agentes entregaram e o consolidador juntou as duplicatas, o resultado passou por duas camadas, como a rodada exigia.

1. **Céticos (2).** Cada um recebeu os achados e tinha uma única tarefa: tentar derrubar. Refazer a prova no código ou no staging, procurar a defesa que o agente não viu, contestar a severidade. O cético A pegou os 50 achados de maior peso (os 2 S0, os 9 S1 e 39 S2, segundo a severidade que os agentes tinham dado). O cético B pegou 25 S2 de UX, acessibilidade, desempenho, testes, processo e documentação, e olhou só o título e o local de 120 S3, para ver se eram decisão documentada ou duplicata.
2. **Caçadores (2 rodadas).** Um agente novo, sem ver a lista de achados dos outros além dos títulos, procurou o que ninguém olhou: lacunas de cobertura, áreas lidas por poucos, caminhos de dinheiro e de dado pessoal. Repetido até a rodada não achar nada relevante.

**Resultado dos céticos**

- **Nenhum achado foi derrubado como inexistente.** Todas as provas foram refeitas e se sustentaram.
- **25 severidades foram reduzidas** (nenhuma subiu): 1 de S0 para S1, 4 de S1 para S2 e 20 de S2 para S3. Quase sempre a razão é a mesma: o defeito é real, mas hoje não há dado real exposto (a produção tem 4 contas e 0 vagas) ou há uma decisão registrada dos sócios. Nesses casos o texto do achado guarda a objeção (linha "Revisão adversária").
- **Mantidos contra a sugestão do cético**, com a razão no próprio achado: a exclusão de conta que não apaga selfie e documento (S0: descumpre direto um pedido de exclusão), o endereço exato legível por qualquer conta (S1: o risco para pessoa física não foi ponderado na decisão U53, vai para a decisão nº 1 dos sócios), e alguns S2 que o cético queria em S3 (limite de vagas por empresa, mural vazio, cadastro que perde o rascunho, avisos fora do app).
- Os vereditos escritos são 86; os demais itens do cético foram aceitos como estavam.

**Severidades alteradas**

| Achado  | De  | Para | Título                                                                                                          |
| ------- | --- | ---- | --------------------------------------------------------------------------------------------------------------- |
| AUD-006 | S0  | S1   | A limpeza que apaga selfie/documento (30 dias), arquivos órfãos e sobras de exclusão não roda em nenhum ambien… |
| AUD-009 | S1  | S2   | Empresa sem verificação aprova todos e recebe o WhatsApp deles (coleta para golpe do falso emprego)             |
| AUD-014 | S1  | S2   | O mapa envia a casa do trabalhador (coordenada de rua, 6 casas) e o IP a servidores públicos de terceiros (OSR… |
| AUD-015 | S1  | S2   | Não existe guarda dos registros de acesso por 6 meses (Marco Civil, art. 15); a Política deixa o prazo em bran… |
| AUD-016 | S1  | S2   | Política e Termos publicados com 10 campos em branco (controlador, encarregado, prazos, base da transferência)… |
| AUD-086 | S2  | S3   | Fotos da vaga aceitam qualquer arquivo e qualquer tamanho, e cortam em 6 sem avisar                             |
| AUD-106 | S2  | S3   | O formulário de publicar vaga se perde ao sair da tela ou recarregar, sem aviso                                 |
| AUD-058 | S2  | S3   | Bloquear uma conta não corta contato nem contratação já aprovada                                                |
| AUD-138 | S2  | S3   | A migration pendente que apaga o app antigo está desatualizada e quebraria `signup_taken('documento')` e o cro… |
| AUD-163 | S2  | S3   | Apagar a conta apaga também as denúncias, os bloqueios e o registro de suspensão: quem foi denunciado some e v… |
| AUD-065 | S2  | S3   | Produção roda Edge Functions de antes do L05: captcha passa sem segredo, CORS cai para "*", 2 funções nem exis… |
| AUD-069 | S2  | S3   | Pagamentos: a Política diz que guarda "por obrigação fiscal", mas excluir a conta apaga `boost_payments` na ho… |
| AUD-071 | S2  | S3   | Retirar o consentimento da selfie/documento não tem caminho no app nem ferramenta da equipe; a Política promet… |
| AUD-072 | S2  | S3   | O gatilho do app antigo continua copiando nome e e-mail de cada cadastro novo para `profiles`; as 7 tabelas an… |
| AUD-073 | S2  | S3   | Transferência internacional sem base declarada: 6 operadores listados fora do Brasil (e pelo menos 4 não citad… |
| AUD-080 | S2  | S3   | Os direitos do titular existem no texto, mas o app só tem "exportar" e "excluir": não mostra o canal do encarr… |
| AUD-081 | S2  | S3   | Não há plano de resposta a incidente de segurança, mas a Política promete avisar a pessoa e a ANPD              |
| AUD-184 | S2  | S3   | Acessibilidade e desempenho no CI medem a demonstração, e duas telas varridas pelo axe são "Página não encontr… |
| AUD-185 | S2  | S3   | O `--mostrar` do configurar-auth.mjs não mostra o estado atual, mas o roteiro usa isso como "desfazer" do Auth  |
| AUD-186 | S2  | S3   | O "backup manual antes de qualquer mudança" do X30 é uma frase: sem script, sem teste de restauração e sem cóp… |
| AUD-201 | S2  | S3   | O checklist de lançamento não tem dono nem prazo em nenhum item, e o estado "feito/falta" está desatualizado    |
| AUD-189 | S2  | S3   | As telas só são abertas no build de demonstração (axe e rolagem); o modo real só é visto pelo E2E pós-merge, s… |
| AUD-165 | S2  | S3   | Nenhuma tela do app avisa contra golpe (dinheiro/PIX antecipado, "taxa")                                        |
| AUD-166 | S2  | S3   | Aprovar e Recusar candidato: dois ícones de 40×40 px, sem texto, lado a lado                                    |
| AUD-173 | S2  | S3   | O service worker baixa 0,88 MB de uma vez na primeira visita (heic2any, mapa, Firebase, tela da equipe, fontes… |

**Resultado dos caçadores**

| Rodada | Achados novos                                                                                                                                                                                                                                                                             | Hipóteses novas | O que foi lido que ninguém tinha lido                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | 7 (5 S2, 2 S3): AUD-039 a AUD-181 (reembolso/estorno sem fila, webhook que responde 200 ao falhar, login por `#access_token` forjado, leitura de todos os trabalhadores por qualquer conta, colunas de escrita direta sem limite, artefatos do E2E públicos, lixo e dado real no staging) | H1 a H12        | as 10 Edge Functions e `_shared/`, roteador, guards, `remote/data.ts`, `address.ts`, `admin.ts`, `feed_jobs`, catálogo do staging (grants por coluna, políticas, CHECKs, gatilhos, Realtime, cron)      |
| 2      | 2 S3: AUD-182 (E2E não executa 5 das 10 funções, nem pagamento, nem visitante) e AUD-124 (`submit_identity` aceita caminho inexistente e sem limite de tamanho)                                                                                                                           | H13 a H17       | os 8 specs do E2E e o proxy local, `remote/storage.ts` e `remote/merge.ts`, o legado que ainda afeta o banco, 18 arquivos de testes pequenos, matriz de autorização entre empresas no staging (correta) |

Na rodada 2 o caçador também conferiu que **não há caminho aberto** para ligar selo, impulso ou nota sem pagar, e que **não existe conciliação de pagamentos** (nenhum dos 7 jobs do cron consulta o Mercado Pago).

**Por que parar aqui.** A rodada 2 rendeu só dois S3. Uma 3ª rodada **estática** (leitura de código, catálogo e políticas) acharia pouco e de gravidade baixa. O que ainda renderia coisa relevante é **dinâmico**, e não foi possível neste ambiente: sandbox do Mercado Pago (H1, o PIX com validade de exatamente 30 minutos, e a conciliação de AUD-039/002), navegador real com a CSP e o link `#access_token` (AUD-020), Firebase real (Google e SMS), leitor de tela e teste de carga no mural. Estão em 8.6 e na lista de hipóteses.

**Limites desta revisão (transparência).** Os achados dos caçadores (HUNT-*) e as melhorias (M) **não passaram pelo cético**. Dos S3, o cético viu só o título e o local, sem refazer a prova. Quem executar a rodada FIX deve tratar a prova de cada item como ponto de partida e reproduzi-la antes de corrigir (o `PROMPT-CORRECAO.md` já pede isso).
