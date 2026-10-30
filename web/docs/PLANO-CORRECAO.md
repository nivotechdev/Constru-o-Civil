# Plano de correção (rodada FIX)

> Este plano transforma os 222 achados de `AUDITORIA-COMPLETA.md` em blocos executáveis, com ordem, tipo de mudança, risco e estimativa. O prompt para a IA que vai corrigir está em `PROMPT-CORRECAO.md`. **Nada aqui foi aplicado**: a auditoria foi somente leitura.

## Decisões que precisamos tomar antes da rodada FIX

Cada decisão destrava um grupo de achados (os `AUD-xxx` entre parênteses). Colar as respostas no `PROMPT-CORRECAO.md`, no lugar de `{{DECISOES_DOS_SOCIOS}}`. Onde há dúvida jurídica, a recomendação precisa de OK do advogado.

| #   | Decisão                                                                                                                                                                                                          | Opções                                                                                                                                                                                                                | Custo                            | Recomendação                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **Endereço exato das vagas** (AUD-002) — hoje qualquer conta logada lê rua, número, CEP e ponto exato de **todas** as vagas, inclusive de pessoa física em casa                                                  | A) manter como está (U53); B) só bairro/ponto aproximado até a candidatura ser aprovada; C) exato para local comercial, aproximado para casa/apartamento                                                              | B ou C: ~1 dia + teste; A: zero  | **C** (mantém o mapa útil nos casos comuns e protege residência); mais um limite de consultas por conta            |
| 2   | **Quando liberar o WhatsApp** (AUD-009, AUD-013) — hoje basta a empresa aprovar, mesmo sem verificação                                                                                                           | A) só empresa verificada; B) empresa nova com teto de aprovações/dia, conta com X dias e WhatsApp confirmado; C) o trabalhador toca "compartilhar meu WhatsApp"                                                       | ~1–2 dias                        | **B + C**; verificação de CNPJ só vale se o vínculo com quem cadastrou for provado (AUD-013)                       |
| 3   | **Exclusão da conta × avaliações que a pessoa escreveu** (AUD-004)                                                                                                                                               | A) apagar tudo (como a Política promete); B) anonimizar (tira nome e comentário, mantém a nota na média) e corrigir a Política                                                                                        | ~1 dia                           | **B**, com revisão do advogado: apagar a nota que alguém deu mexe na reputação de terceiros                        |
| 4   | **O que guardar depois de excluir** (AUD-163, AUD-069, AUD-070) — denúncias contra a pessoa, prova de aceite dos termos, pagamentos, hash do documento de banidos                                                | prazos de retenção por tipo                                                                                                                                                                                           | advogado                         | definir prazos (ex.: pagamentos 5 anos; denúncias/aceite por prazo curto) e escrever na Política                   |
| 5   | **Mapa e rota de carro** (AUD-014) — a casa do trabalhador (coordenada de rua) e o IP vão para `router.project-osrm.org` e `routing.openstreetmap.de`                                                            | A) tirar a rota de carro (mostrar só distância em linha reta); B) hospedar rota própria; C) manter e declarar na Política                                                                                             | A: ~2 h; B: dias e custo mensal  | **A**; manter os mosaicos do OpenStreetMap e citá-los na Política                                                  |
| 6   | **Plano do Supabase** (X30, AUD-015, AUD-186) — Free não tem backup diário e pausa por inatividade                                                                                                               | A) Free até o lançamento (decisão atual); B) Pro (US$ 25/mês) **antes do primeiro usuário real**                                                                                                                      | US$ 25/mês                       | **B**: backup, sem pausa, senha vazada bloqueada; sem ele o "backup manual" é só uma frase                         |
| 7   | **Textos legais** (AUD-016, AUD-015, AUD-073, AUD-081) — 10 campos `{{…}}` em branco, prazos de guarda, base da transferência internacional, encarregado, incidente                                              | enviar dados da empresa e contratar revisão                                                                                                                                                                           | advogado                         | fazer **antes** do piloto; sem isso o build de produção nem sai                                                    |
| 8   | **Avisos fora do app** (AUD-049) — candidato novo, aprovação e bico novo só aparecem dentro do app                                                                                                               | A) e-mail (Brevo já previsto); B) push no piloto; C) manter e corrigir o texto "Avisamos"                                                                                                                             | A: ~2 dias + conta Brevo         | **A** no piloto, push depois                                                                                       |
| 9   | **Moderação** (AUD-045) — hoje denúncia de perfil/avaliação/post só arquiva ou suspende a conta                                                                                                                  | permitir ocultar perfil, avaliação e post                                                                                                                                                                             | ~2 dias                          | sim (é o que a equipe vai precisar no primeiro dia)                                                                |
| 10  | **Papéis da equipe** (AUD-063) — "moderador" faz tudo que "admin" faz                                                                                                                                            | A) aplicar o papel nas funções; B) remover o papel                                                                                                                                                                    | ~1 dia                           | **A**                                                                                                              |
| 11  | **Tetos de abuso** (AUD-012, AUD-011) — nenhum limite de vagas por empresa; "urgente" grátis; reputação fabricada com duas contas                                                                                | definir números (ex.: 10 vagas abertas sem verificação, 3 por dia; concluir só depois do dia combinado)                                                                                                               | ~1–2 dias                        | usar os números do exemplo e revisar após o piloto                                                                 |
| 12  | **Staging na mesma organização da produção** (AUD-023)                                                                                                                                                           | A) criar organização/token só do staging; B) manter                                                                                                                                                                   | US$ 0                            | **A**; mais rotação do token no checklist                                                                          |
| 13  | **Site de teste público** (AUD-024) — GitHub Pages em modo real, captcha de teste, e-mail pelo remetente da produção                                                                                             | A) manter com faixa "ambiente de teste", `noindex` e remetente próprio; B) tornar privado                                                                                                                             | ~2 h                             | **A**                                                                                                              |
| 14  | **Navegadores suportados** (AUD-195)                                                                                                                                                                             | ex.: Chrome/WebView ≥ 100 e Safari ≥ 15.4                                                                                                                                                                             | ~2 h + job WebKit                | **adotar** e documentar                                                                                            |
| 15  | **Cadastro e primeiro uso** (AUD-213, AUD-214) — ver bicos antes de criar conta; endereço só no 1º bico                                                                                                          | sim/não                                                                                                                                                                                                               | ~2–3 dias                        | **sim** para os dois (conversão do piloto)                                                                         |
| 16  | **Vocabulário de status** (AUD-167) — "Pré-selecionado", "Aprovado", "Você avançou" para o mesmo estado                                                                                                          | escolher um nome por status                                                                                                                                                                                           | ~2 h                             | "Aprovado" no app todo                                                                                             |
| 17  | **Contatos de suporte** (AUD-082) — Gmail de desenvolvimento e celular nos arquivos de um repositório público                                                                                                    | criar `suporte@` e `dev@` no domínio                                                                                                                                                                                  | ação dos sócios                  | fazer antes do lançamento                                                                                          |
| 18  | **Quando aplicar na produção** (AUD-055, AUD-065) — a produção está 25 migrations e 8 funções atrás                                                                                                              | uma janela única com backup, na ordem do `APLICAR.md` e de um roteiro atualizado                                                                                                                                      | meio dia                         | só depois dos blocos 0 a 2 estarem no staging e do backup ensaiado                                                 |
| 19  | **Quem vê o perfil dos trabalhadores** (AUD-021, AUD-020) — hoje qualquer conta logada, inclusive uma "empresa" criada na hora, lê nome, bairro, coordenada aproximada, foto e bio de **todos** os trabalhadores | A) manter ("os dois lados veem o perfil do outro"); B) só empresa com vínculo (candidatura, convite, avaliação), por RPC que devolve o mínimo e sem coordenada; C) B e, no mural de talentos futuro, só nome e bairro | ~2 dias + teste SQL              | **B** (a regra de produto fica: quem se candidata mostra o perfil à empresa; quem não se candidatou não é listado) |
| 20  | **Reembolso, estorno e chargeback do impulso** (AUD-039, AUD-038) — a tela promete "Vamos devolver o valor", mas não há fila, estado final nem tratamento de estorno                                             | A) fila no `/admin` com marcação de reembolso e aviso à empresa; B) fazer à mão no painel do Mercado Pago e só registrar; C) não ligar pagamentos no piloto                                                           | A: ~2–3 dias; B: ~1 dia; C: zero | **C** no piloto (pagamentos já estão desligados); **A** antes de ligar o Mercado Pago                              |

## Como ler os blocos

- A ordem dos blocos é a ordem de execução (segurança e privacidade primeiro). Dentro de cada bloco a tabela já está na ordem certa: primeiro os mais graves, adiando só o que depende de outro item.
- Um item com `migration` precisa de migration idempotente, teste SQL, `node scripts/aplicar-tudo.mjs` e `npm run gen:types`; **nenhuma migration é aplicada na produção isolada**: todas entram no pacote "subir produção" (decisão 18).
- Os itens `responsável` esperam uma decisão da lista acima ou uma conta/serviço externo; a IA documenta o passo a passo no `CHECKLIST-LANCAMENTO.md` e não marca como feito.

## Blocos executáveis

Convenções: **Esf.** P < 2 h, M meio dia a 2 dias, G > 2 dias; **Tipo**: `migration` (exige migration + teste SQL + `aplicar-tudo.mjs` + `gen:types`), `função` (Edge Function), `produção` (algo precisa mudar na produção: só com "pode" e com o comando exato), `responsável` (depende de decisão/ação dos sócios).

### Bloco 0 — Segurança e privacidade

- Itens: 50 (S0 1, S1 5, S2 17, S3 27, M 0).
- Estimativa de esforço: ~26.0 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 29; toca a produção: 39; depende dos sócios: 27.
- **Ordem sugerida**: primeiro os dois S0 de privacidade (identidade não apagada), depois os S1 (mapa/OSRM, textos legais, abuso de WhatsApp, limites de taxa, endereço), depois os S2/S3 de segurança e LGPD.
- **Migrations**: a maior parte. **Produção**: nada se aplica sozinho; entra no pacote da decisão 18. **Ação do responsável**: textos legais, prazos, advogado, DPAs, plano Pro.
- **Risco de regressão**: grants/RLS/funções mexem no coração do app. Mitigação: estender `seguranca.sql` com casos negativos por papel antes de cada correção; testes de exclusão/exportação ponta a ponta no staging com contas de teste; backfill de `author_account` testado com dados.

| AUD     | Sev | Esf. | Tipo                                     | Título                                                                                                                   | Depende de                         |
| ------- | --- | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| AUD-002 | S1  | M    | migration, responsável, produção         | Rua, número, CEP e ponto exato de TODA vaga (inclusive casa/apartamento de pessoa física) saem por `select` direto para  | —                                  |
| AUD-003 | S1  | P    | migration, produção                      | Texto do endereço da vaga sem limite: uma empresa faz o mural pesar MB                                                   | —                                  |
| AUD-004 | S1  | P    | migration, responsável, produção         | Excluir a conta não apaga as avaliações que a pessoa escreveu                                                            | —                                  |
| AUD-005 | S1  | P    | migration, função, produção              | Todos os limites de taxa das Edge Functions usam o primeiro IP de `x-forwarded-for`, que o cliente pode escrever         | —                                  |
| AUD-008 | S2  | M    | migration, produção                      | Vídeos do portfólio sobem sem remover metadados (GPS do aparelho) para um bucket público                                 | —                                  |
| AUD-009 | S2  | M    | migration, responsável, produção         | Empresa sem verificação aprova todos e recebe o WhatsApp deles (coleta para golpe do falso emprego)                      | —                                  |
| AUD-010 | S2  | P    | migration, produção                      | Selo "Verificada/Verificado" permanece depois de trocar o nome                                                           | —                                  |
| AUD-012 | S2  | M    | migration, produção                      | Nenhum limite de vagas por empresa; "urgente" grátis pela API                                                            | —                                  |
| AUD-011 | S2  | M    | migration, produção                      | Reputação fabricada em segundos com duas contas                                                                          | AUD-009, AUD-012                   |
| AUD-013 | S2  | M    | função, responsável, produção            | "Empresa verificada" é concedida a qualquer pessoa que digite um CNPJ ativo qualquer                                     | —                                  |
| AUD-014 | S2  | M    | migration, responsável, produção         | O mapa envia a casa do trabalhador (coordenada de rua, 6 casas) e o IP a servidores públicos de terceiros (OSRM e OpenSt | —                                  |
| AUD-015 | S2  | M    | migration, responsável, produção         | Não existe guarda dos registros de acesso por 6 meses (Marco Civil, art. 15); a Política deixa o prazo em branco         | —                                  |
| AUD-018 | S2  | P    | migration, produção                      | "Exportar meus dados" não traz tudo o que a Bicos guarda sobre a pessoa, mas a tela e a Política dizem que traz          | —                                  |
| AUD-019 | S2  | M    | migration, função, responsável, produção | O "hash do documento" é SHA-256 sem segredo: com um vazamento do banco ou de backup, os CPFs saem em minutos (e a máscar | —                                  |
| AUD-020 | S2  | M    | —                                        | "Login CSRF": o app aceita `#access_token=…&refresh_token=…` de qualquer link e entra na conta de quem montou o link     | —                                  |
| AUD-021 | S2  | M    | migration, responsável, produção         | Qualquer conta logada lê todos os trabalhadores (nome, bairro, coordenada, foto, bio, experiências) com uma consulta só  | —                                  |
| AUD-022 | S2  | P    | migration, produção                      | Vaga oculta pela equipe e conta suspensa ainda aprovam, contratam e convidam                                             | —                                  |
| AUD-023 | S2  | M    | responsável, produção                    | O token da conta Supabase guardado no CI alcança a produção, e as mitigações do X30 não cobrem o ataque que importa      | —                                  |
| AUD-024 | S2  | P    | responsável                              | O site de teste público (GitHub Pages) tem captcha de teste e manda e-mail de verdade pelo remetente da produção, sem av | —                                  |
| AUD-056 | S3  | M    | responsável, produção                    | Nenhum teto de arquivos por conta no Storage (plano Free: 1 GB)                                                          | —                                  |
| AUD-057 | S3  | P    | migration, produção                      | Status da verificação de identidade (`recusado`, `em_analise`) legível por qualquer conta logada                         | —                                  |
| AUD-058 | S3  | P    | migration, produção                      | Bloquear uma conta não corta contato nem contratação já aprovada                                                         | —                                  |
| AUD-059 | S3  | P    | migration, produção                      | Leituras sem checar vínculo: `worker_track_record`, `job_stats` e erro que revela candidatura                            | —                                  |
| AUD-060 | S3  | P    | migration, produção                      | O servidor aceita qualquer "versão" de termos e de consentimento                                                         | —                                  |
| AUD-061 | S3  | P    | migration, produção                      | `cpf_valid`, `cnpj_valid`, `document_valid_for`, `whatsapp_valid` executáveis por visitante                              | —                                  |
| AUD-063 | S3  | P    | migration, produção                      | Papel admin × moderador não faz diferença                                                                                | —                                  |
| AUD-064 | S3  | P    | migration, responsável, produção         | Link público: IP guardado como sha256(ip/data) sem segredo, limite burlável por IPv6, uma escrita por visita anônima, po | —                                  |
| AUD-065 | S3  | P    | função, responsável, produção            | Produção roda Edge Functions de antes do L05: captcha passa sem segredo, CORS cai para "*", 2 funções nem existem        | —                                  |
| AUD-066 | S3  | P    | função, produção                         | Notificação por push: endpoint de inscrição é qualquer `https://…` (SSRF cego) e o clique abre URL absoluta              | —                                  |
| AUD-067 | S3  | P    | função, responsável, produção            | Entrar por celular (Firebase) abre a conta pelo WhatsApp digitado no cadastro, mesmo sem confirmação do número           | —                                  |
| AUD-068 | S3  | P    | responsável, produção                    | No servidor a senha só precisa de 8 caracteres de qualquer tipo; "letras e números" e a checagem de senha vazada não exi | —                                  |
| AUD-069 | S3  | P    | migration, responsável, produção         | Pagamentos: a Política diz que guarda "por obrigação fiscal", mas excluir a conta apaga `boost_payments` na hora; o praz | —                                  |
| AUD-070 | S3  | M    | migration, responsável, produção         | Histórico sem prazo de apagamento: decisões da equipe (`staff_actions`), denúncias resolvidas, avisos e eventos de pagam | —                                  |
| AUD-062 | S3  | M    | migration, produção                      | Auditoria da equipe mutável e com lacunas                                                                                | AUD-070                            |
| AUD-072 | S3  | P    | migration, responsável, produção         | O gatilho do app antigo continua copiando nome e e-mail de cada cadastro novo para `profiles`; as 7 tabelas antigas segu | —                                  |
| AUD-074 | S3  | P    | função, responsável, produção            | Relatórios de erro (Sentry): a Política diz "sem dados pessoais", mas o mapa interno admite IP; a retenção de 30 dias e  | —                                  |
| AUD-016 | S2  | P    | responsável                              | Política e Termos publicados com 10 campos em branco (controlador, encarregado, prazos, base da transferência) e sem rev | AUD-015, AUD-069, AUD-070, AUD-074 |
| AUD-017 | S2  | M    | função, responsável, produção            | Firebase/Google (login por Google e por celular) não é citado como operador e o usuário nunca é apagado de lá; reCAPTCHA | AUD-074                            |
| AUD-073 | S3  | M    | responsável                              | Transferência internacional sem base declarada: 6 operadores listados fora do Brasil (e pelo menos 4 não citados) e nenh | AUD-016                            |
| AUD-075 | S3  | P    | responsável                              | Coleta que a Política não descreve ou descreve só em parte                                                               | AUD-016                            |
| AUD-076 | S3  | P    | responsável                              | "Apagamos na hora" não diz nada sobre cópias de segurança; e hoje o plano Free nem tem cópia                             | —                                  |
| AUD-077 | S3  | P    | —                                        | Depois que o trabalhador exclui a conta, o primeiro nome dele continua nos avisos da empresa (e vice-versa)              | —                                  |
| AUD-078 | S3  | P    | migration, produção                      | A exportação devolve o CPF/CNPJ em claro sem pedir a senha de novo (a exclusão pede)                                     | —                                  |
| AUD-079 | S3  | P    | —                                        | Todo membro da equipe (inclusive "moderador") enxerga a selfie e a foto do documento; a Política diz "equipe de verifica | —                                  |
| AUD-081 | S3  | P    | responsável                              | Não há plano de resposta a incidente de segurança, mas a Política promete avisar a pessoa e a ANPD                       | AUD-016                            |
| AUD-082 | S3  | P    | função, responsável, produção            | Dados pessoais dos sócios num repositório público                                                                        | —                                  |
| AUD-001 | S0  | P    | migration, função, produção              | Excluir a conta não apaga a selfie e o documento na hora: a função só limpa 3 pastas; as fotos de identidade ficam para  | AUD-006                            |
| AUD-006 | S1  | P    | migration, função, responsável, produção | A limpeza que apaga selfie/documento (30 dias), arquivos órfãos e sobras de exclusão não roda em nenhum ambiente, e o cr | AUD-001                            |
| AUD-071 | S3  | M    | —                                        | Retirar o consentimento da selfie/documento não tem caminho no app nem ferramenta da equipe; a Política promete "a qualq | AUD-001                            |
| AUD-080 | S3  | P    | —                                        | Os direitos do titular existem no texto, mas o app só tem "exportar" e "excluir": não mostra o canal do encarregado nem  | AUD-016, AUD-071                   |

### Bloco 1 — Fluxo principal e correção de comportamento

- Itens: 58 (S0 0, S1 1, S2 11, S3 46, M 0).
- Estimativa de esforço: ~20.5 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 10; toca a produção: 13; depende dos sócios: 6.
- **Ordem sugerida**: link público/Ajuda sem login (S1) primeiro, depois o que quebra o fluxo central (publicar vaga em dobro, estados do pagamento, rascunho da vaga, resposta atrasada entre contas, hora do aparelho × Brasília), depois os defeitos de formulário e texto.
- **Risco de regressão**: alto, é o fluxo principal. Mitigação: todo item começa por teste que falha (Vitest, SQL ou E2E); acrescentar o E2E "visitante" no build real; comparar prints antes × depois nas telas tocadas.

| AUD     | Sev | Esf. | Tipo                          | Título                                                                                                                   | Depende de |
| ------- | --- | ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AUD-007 | S1  | P    | —                             | Link público da vaga e Ajuda quebram para quem não está logado (build de produção)                                       | —          |
| AUD-025 | S2  | M    | —                             | Cadastro perde tudo ao recarregar a página no passo do código do WhatsApp                                                | —          |
| AUD-026 | S2  | P    | —                             | Campos numéricos da vaga apagam vírgula, ponto e sinal e mudam o valor sem avisar                                        | —          |
| AUD-028 | S2  | P    | —                             | Cadastro do endereço: sem internet (ou provedor lento) o app diz "Não achamos essa rua", e a localização é salva em silê | —          |
| AUD-029 | S2  | P    | —                             | Resposta que chega depois do "Sair" cai no store da conta seguinte (selo de notificações de outra conta, consulta marcad | —          |
| AUD-027 | S2  | P    | função, produção              | Ação que deu certo no servidor aparece como erro quando a releitura seguinte falha; em "publicar vaga" o novo toque cria | AUD-029    |
| AUD-030 | S2  | P    | —                             | Mural vazio diz "Nenhuma vaga com esse filtro" sem filtro; "Limpar filtros" não faz nada                                 | —          |
| AUD-031 | S2  | P    | —                             | "Bicos fechados" (`/historico`) abre a aba "Abertas"                                                                     | —          |
| AUD-032 | S2  | M    | função, responsável, produção | Pagamento do impulso: três estados sem tela (risco de cobrança em dobro no cartão em análise)                            | —          |
| AUD-033 | S2  | M    | —                             | "Voltar para a vaga depois de entrar" só vale no login com e-mail e senha; Google, SMS e cadastro novo caem no mural     | AUD-007    |
| AUD-034 | S2  | P    | —                             | A CSP não tem `media-src`: vídeo do portfólio não toca nem aparece na prévia, e nenhuma etapa do CI exercita a CSP num n | —          |
| AUD-035 | S2  | P    | —                             | Com o relógio do celular errado, o app dobra cada consulta ou desloga a pessoa uma vez por hora                          | —          |
| AUD-083 | S3  | P    | —                             | Busca no mural com texto longo sem espaços: o título "Nenhuma vaga para “…”" sai do cartão                               | —          |
| AUD-084 | S3  | P    | —                             | `/entrar-celular` sem botão, mas abre por link e responde "Na demonstração, entre com e-mail e senha"                    | —          |
| AUD-085 | S3  | P    | —                             | Cadastro aceita "Maria 😀 Souza" e não limita o nome; o editar perfil limita em 80                                       | —          |
| AUD-086 | S3  | P    | —                             | Fotos da vaga aceitam qualquer arquivo e qualquer tamanho, e cortam em 6 sem avisar                                      | —          |
| AUD-087 | S3  | P    | —                             | Impulsionar vaga de outra empresa mostra um título e uma explicação que não combinam                                     | —          |
| AUD-088 | S3  | P    | migration, produção           | "Trocar WhatsApp" manda o código sem conferir se o número já é de outra conta                                            | —          |
| AUD-089 | S3  | P    | —                             | Passo do código (WhatsApp e e-mail) abre sem foco no campo: o teclado não sobe sozinho                                   | —          |
| AUD-090 | S3  | P    | —                             | "Minhas candidaturas", "Candidatos" e "Minhas vagas" só abrem se uma rotina que escreve (`conclude_my_finished_jobs`) de | —          |
| AUD-091 | S3  | P    | responsável                   | Mensagem pronta do WhatsApp erra o tratamento: "Aqui é da Ana Souza" (pessoa) e "Fui contratado" para qualquer trabalhad | —          |
| AUD-092 | S3  | P    | responsável                   | Textos legais mudaram em 21/10 sem mudar `version` nem `updatedAt` (continuam "2.0 / 15/10/2026")                        | —          |
| AUD-093 | S3  | P    | —                             | Aviso de sucesso "E-mail trocado. Use o novo para entrar." aparece como erro (tom vermelho)                              | —          |
| AUD-094 | S3  | P    | —                             | Posts do portfólio feitos no mesmo dia aparecem do mais antigo para o mais novo (comparador de ordenação inconsistente)  | —          |
| AUD-095 | S3  | P    | migration, produção           | Envio de fotos/vídeos: sem prazo nem cancelamento, e erros do bucket viram sempre "Não deu para enviar a foto agora"     | —          |
| AUD-096 | S3  | P    | —                             | `checkPassword`/`verifyOtp` não tratam limite de tentativas nem conta suspensa: caem em "Não deu certo agora"            | —          |
| AUD-097 | S3  | P    | —                             | Qualquer erro do Firebase com a palavra "captcha" vira "Esse jeito de entrar ainda não está ligado"; navegadores embutid | —          |
| AUD-098 | S3  | P    | —                             | "Ver outros bicos" numa vaga encerrada vai ao login e volta para a mesma vaga                                            | —          |
| AUD-099 | S3  | P    | —                             | Legenda em edição sobrevive ao fechar o visualizador e vai para outro post                                               | —          |
| AUD-100 | S3  | P    | —                             | "Publicar trabalho": o erro anterior reaparece ao reabrir a janela                                                       | —          |
| AUD-101 | S3  | P    | —                             | Contagem do "reenviar código": três cópias, relógios que nunca param, "0:60" no SMS                                      | —          |
| AUD-102 | S3  | P    | função, responsável, produção | Trocar WhatsApp: com captcha ligado, "Reenviar código" falha (latente)                                                   | —          |
| AUD-103 | S3  | P    | —                             | Link de redefinir senha vencido só avisa depois que a pessoa digita                                                      | —          |
| AUD-104 | S3  | P    | —                             | "Desfazer" remoção de experiência apaga o que foi adicionado depois                                                      | —          |
| AUD-105 | S3  | P    | —                             | "Desbloquear": todos os botões giram juntos                                                                              | —          |
| AUD-106 | S3  | M    | —                             | O formulário de publicar vaga se perde ao sair da tela ou recarregar, sem aviso                                          | —          |
| AUD-107 | S3  | P    | —                             | Busca do mural mostra só a primeira página (30), sem "Carregar mais"                                                     | —          |
| AUD-108 | S3  | P    | —                             | Recarregar "Vaga publicada" mostra "vaga não encontrada"                                                                 | AUD-027    |
| AUD-109 | S3  | P    | —                             | Candidato aprovado: "Desfazer aprovação" e "Cancelar" são quase iguais                                                   | —          |
| AUD-110 | S3  | P    | —                             | Digitar na busca troca a lista pelo esqueleto                                                                            | —          |
| AUD-111 | S3  | P    | —                             | "Todas · N" em Minhas vagas conta só as páginas carregadas                                                               | —          |
| AUD-112 | S3  | P    | migration, produção           | /admin: pequenos furos                                                                                                   | —          |
| AUD-113 | S3  | P    | —                             | O prazo de 30 dias da vaga sem data não é dito a quem publica                                                            | —          |
| AUD-114 | S3  | P    | —                             | O GPS do `CityPicker` pode trocar a cidade depois de a folha ser fechada; a lista usa `listbox`/`option` sem setas       | —          |
| AUD-115 | S3  | P    | —                             | Nenhum `img` tem `onError`; o track do carrossel tem `aria-roledescription` sem `role`                                   | —          |
| AUD-116 | S3  | P    | —                             | Número colado com "+55" ou "0" vira outro número e é recusado                                                            | —          |
| AUD-117 | S3  | P    | migration, produção           | Denúncias: alvo livre e denúncia analisada reaberta pelo denunciante                                                     | —          |
| AUD-118 | S3  | P    | migration, produção           | Aviso "Bico novo" mostra o valor com vírgula americana: R$ 1.500 sai "R$ 1,500"                                          | —          |
| AUD-119 | S3  | M    | migration, produção           | CNPJ alfanumérico (Receita, desde julho/2026) é recusado no cadastro e na verificação                                    | —          |
| AUD-120 | S3  | P    | migration, produção           | Todo cadastro novo nasce com "São Paulo, SP" e coordenadas de SP; na produção as 4 contas ainda têm                      | —          |
| AUD-121 | S3  | P    | migration, produção           | Constraints `NOT VALID` do L11 nunca validadas                                                                           | —          |
| AUD-122 | S3  | P    | —                             | Limites de localização diferentes entre as funções: quem mora em Fernando de Noronha não consegue cadastrar o endereço;  | —          |
| AUD-123 | S3  | M    | responsável                   | A busca do banco só acha o que está no título, bairro e cidade: os sinônimos são de construção e as vagas novas não têm  | —          |
| AUD-124 | S3  | ?    | migration, produção           | `submit_identity` aceita caminhos de arquivo que não existem, sem limite de tamanho, e o trabalhador fica "em análise" s | —          |
| AUD-125 | S3  | P    | responsável                   | "Não vou poder ir" não tem janela: depois do dia do bico o faltoso troca "falta" por "desistência"                       | —          |
| AUD-126 | S3  | M    | —                             | Mural no modo real: o app refiltra e reordena o que o servidor mandou com regras ligeiramente diferentes                 | —          |
| AUD-127 | S3  | P    | migration, produção           | "Hoje", "vaga vencida" e "diária começou" usam a data do aparelho; o servidor usa Brasília                               | —          |
| AUD-128 | S3  | P    | —                             | Favicon e ícone da tela inicial quebram em rotas com mais de um segmento (`/v/:id`, o link compartilhado)                | —          |

### Bloco 2 — Confiabilidade e observabilidade

- Itens: 20 (S0 0, S1 0, S2 5, S3 15, M 0).
- Estimativa de esforço: ~9.5 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 8; toca a produção: 11; depende dos sócios: 8.
- **Ordem sugerida**: avisos e Sentry (para ver o resto), prazos de rede (`QueryView`, Edge Functions, upload), alerta de cron, deadlocks e atomicidade dos limites, versão mínima do app.
- **Ação do responsável**: criar o projeto Sentry, o monitor de disponibilidade e o destino dos alertas; o `CLEANUP_SECRET`/URL de limpeza no Vault.
- **Risco**: baixo a médio; mudanças são aditivas. Mitigação: forçar erro e ver chegar o aviso (roteiro de `IMPLANTACAO.md`).

| AUD     | Sev | Esf. | Tipo                                     | Título                                                                                                                   | Depende de |
| ------- | --- | ---- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AUD-036 | S2  | M    | responsável, produção                    | Erros inesperados do servidor viram "Não deu certo agora" sem rastro: nada é enviado ao Sentry e a causa original é joga | —          |
| AUD-037 | S2  | P    | responsável                              | Captcha sem tratar `timeout-callback`/`unsupported-callback` do Turnstile: "Entrar" gira até recarregar                  | —          |
| AUD-038 | S2  | M    | função, responsável, produção            | Pagamento aprovado que não pode ser aplicado, ou que falha no webhook, não avisa ninguém da equipe                       | —          |
| AUD-039 | S2  | M    | migration, função, responsável, produção | Reembolso prometido não tem fila, nem estado final, nem tratamento de estorno ou chargeback (Mercado Pago)               | —          |
| AUD-129 | S3  | P    | migration, responsável, produção         | Fim de sessão por outro caminho que não o botão "Sair" deixa o aparelho recebendo notificações da conta antiga           | —          |
| AUD-130 | S3  | P    | —                                        | Falha de rede ao chamar uma Edge Function (com o aparelho "online") não vira `offline`: a pessoa vê "Não deu certo agora | —          |
| AUD-131 | S3  | P    | —                                        | Se o download do supabase-js falhar uma vez, `getSupabase()` guarda a promessa rejeitada e o app não se recupera sem rec | —          |
| AUD-132 | S3  | P    | —                                        | Se salvar o tema falhar, o aviso sempre diz "Sem internet" (mesmo quando a internet está boa)                            | —          |
| AUD-133 | S3  | P    | migration, função, produção              | Se a linha `storage_public_base` faltar, a conferência das fotos deixa passar tudo e a limpeza diária apaga todas as fot | —          |
| AUD-134 | S3  | P    | —                                        | Ordem de travas inconsistente (vaga↔candidatura, pagamento↔vaga): deadlock possível                                      | —          |
| AUD-135 | S3  | P    | migration, produção                      | Limites diários (candidaturas 30/dia, convites 20/dia, denúncias 20/dia) não são atômicos                                | —          |
| AUD-136 | S3  | M    | migration, função, produção              | Publicar vaga notifica todos os alertas na mesma transação                                                               | —          |
| AUD-137 | S3  | P    | migration, produção                      | Migrations "idempotentes" que reescrevem dados/permissões quando rodam de novo                                           | —          |
| AUD-138 | S3  | P    | migration, produção                      | A migration pendente que apaga o app antigo está desatualizada e quebraria `signup_taken('documento')` e o cron `bicos-l | —          |
| AUD-139 | S3  | P    | migration, responsável, produção         | Alerta de cron não enviado ao Sentry conta como "já alertado" por 24 h e nunca é reenviado                               | —          |
| AUD-040 | S2  | M    | responsável                              | Em produção nada avisa ninguém quando algo quebra (e o staging também não): Sentry e monitor de fora desligados, alerta  | AUD-139    |
| AUD-140 | S3  | P    | função, produção                         | Login por CPF/CNPJ: a resposta demora 140 vezes mais quando o documento existe, e 5 pedidos travam o login por documento | —          |
| AUD-141 | S3  | P    | —                                        | Nenhuma chamada a provedor externo tem prazo máximo; o app também não corta a espera                                     | —          |
| AUD-142 | S3  | P    | —                                        | O avisador de erros usa `crypto.randomUUID()` sem proteção: em navegador antigo ele próprio dá erro e nada chega ao Sent | —          |
| AUD-143 | S3  | M    | responsável                              | Sem versão mínima: o app aberto em segundo plano pode ficar semanas na versão antiga falando com RPCs novas              | —          |

### Bloco 3 — UX e acessibilidade para o público real

- Itens: 36 (S0 0, S1 0, S2 9, S3 27, M 0).
- Estimativa de esforço: ~12.8 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 3; toca a produção: 3; depende dos sócios: 6.
- Itens de **acessibilidade** (foco, nomes, alvos de toque, contraste, título da aba) e **UX** do público real (aviso antigolpe, selo de verificação onde se decide, candidatos à vista, botões Aprovar/Recusar com texto, mural vazio, status completos).
- **Risco**: visual. Mitigação: axe + prints Playwright antes × depois (360×800 e 1280×800, claro e escuro), `tap-target`/tokens reaproveitados, sem componente novo sem necessidade.

| AUD     | Sev | Esf. | Tipo                             | Título                                                                                                                   | Depende de |
| ------- | --- | ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AUD-041 | S2  | P    | —                                | Sem caminho para a Ajuda/suporte nas telas onde mais gente trava                                                         | —          |
| AUD-042 | S2  | P    | —                                | A linha do candidato é uma `div` com clique, sem teclado nem papel                                                       | —          |
| AUD-044 | S2  | P    | —                                | O título da aba nunca muda e o foco volta ao início a cada troca de tela                                                 | —          |
| AUD-045 | S2  | M    | migration, responsável, produção | Denúncia de perfil, avaliação ou publicação não tem como tirar o conteúdo do ar                                          | —          |
| AUD-046 | S2  | M    | migration, responsável, produção | Quem souber o CPF/CNPJ de outra pessoa trava o cadastro dela e apaga o cadastro pendente dela; não há prova de posse nem | —          |
| AUD-047 | S2  | P    | —                                | O selo "Verificada" e o nome da empresa não aparecem onde se decide (card, vaga, confirmar candidatura)                  | —          |
| AUD-048 | S2  | M    | —                                | "Sua vaga": candidatos ~1.150 px abaixo; a barra fixa oferece "Editar vaga" e "Excluir vaga"                             | —          |
| AUD-049 | S2  | M    | responsável                      | Avisos de candidato novo, aprovação e bico novo só existem dentro do app                                                 | —          |
| AUD-144 | S3  | P    | —                                | Textos que contradizem o contexto                                                                                        | —          |
| AUD-146 | S3  | P    | —                                | Em 360 px o status mais importante é cortado                                                                             | —          |
| AUD-147 | S3  | P    | —                                | Ao errar o formulário, o foco não vai para o primeiro erro e a mensagem do título fica escondida sob a barra fixa        | —          |
| AUD-148 | S3  | P    | —                                | No desktop o valor "R$ 150" quebra em duas linhas no cartão "Diária que você ofereceu"                                   | —          |
| AUD-149 | S3  | P    | —                                | Alvos de toque pequenos nas telas de entrada e leitura                                                                   | —          |
| AUD-150 | S3  | P    | —                                | Foco/nome acessível ausentes (checkbox, "não lida", selo, progresso)                                                     | —          |
| AUD-043 | S2  | P    | —                                | Sem foco visível em Checkbox, Radio/RadioCard, Switch, PhotoSlot, PhotoManager e carrossel                               | AUD-150    |
| AUD-145 | S3  | P    | —                                | Sem `h1` em várias telas                                                                                                 | AUD-150    |
| AUD-151 | S3  | P    | —                                | Os dois campos de horário do passo 2 de publicar vaga não têm nome acessível                                             | —          |
| AUD-152 | S3  | P    | —                                | Escolhas visuais sem estado para leitor de tela                                                                          | —          |
| AUD-153 | S3  | P    | —                                | `Button loading` perde o nome acessível, encolhe e fica desativado                                                       | —          |
| AUD-154 | S3  | P    | —                                | `PhotoSlot` com foto escolhida tem campo de arquivo sem nome; remover do `PhotoManager` tem 28 px                        | —          |
| AUD-155 | S3  | P    | —                                | `Rating showValue={false}` não tem texto equivalente                                                                     | —          |
| AUD-156 | S3  | P    | —                                | Erro não ligado ao campo em `Select`, `CodeInput` e `AboutField`; o CEP aponta para um id que some                       | —          |
| AUD-157 | S3  | P    | —                                | Contrastes abaixo de WCAG AA                                                                                             | —          |
| AUD-158 | S3  | P    | —                                | Toast some em 4 s, inclusive erro e "Desfazer", sem pausar                                                               | —          |
| AUD-159 | S3  | P    | —                                | `NotificationsPanel` não move nem devolve o foco; selo do sino fora do nome acessível; "Não lida" em `span` com `aria-la | —          |
| AUD-160 | S3  | P    | —                                | `alertdialog` sem `aria-describedby`; erro do `SignOutDialog` entra no lugar da descrição, sem `role="alert"`            | —          |
| AUD-161 | S3  | P    | —                                | `h3` fixo em `EmptyState`, `ErrorState` e `ReviewUnavailable`; `JobNotFound` é tela sem saída                            | —          |
| AUD-162 | S3  | P    | —                                | Com "reduzir movimento" o ícone de carregando fica parado                                                                | —          |
| AUD-163 | S3  | M    | migration, responsável, produção | Apagar a conta apaga também as denúncias, os bloqueios e o registro de suspensão: quem foi denunciado some e volta limpo | —          |
| AUD-164 | S3  | P    | responsável                      | E-mail "Magic link" fala em excluir a conta, mas qualquer pessoa com a chave pública pode disparar para qualquer e-mail  | —          |
| AUD-165 | S3  | P    | responsável                      | Nenhuma tela do app avisa contra golpe (dinheiro/PIX antecipado, "taxa")                                                 | —          |
| AUD-166 | S3  | P    | —                                | Aprovar e Recusar candidato: dois ícones de 40×40 px, sem texto, lado a lado                                             | AUD-042    |
| AUD-167 | S3  | P    | —                                | Vocabulário que ainda diverge na tela (lista com arquivo:linha em `termos.md` §2)                                        | —          |
| AUD-168 | S3  | P    | —                                | A cidade do mural só aparece dentro da folha "Filtros"                                                                   | —          |
| AUD-169 | S3  | P    | —                                | Com fonte a 200 %, a barra de baixo vira "I…", "V…", "P…" e os títulos das vagas ficam com uma palavra                   | AUD-157    |
| AUD-170 | S3  | P    | —                                | Todo botão de salvar vaga se chama só "Salvar vaga" (26 iguais no mural)                                                 | —          |

### Bloco 4 — Desempenho

- Itens: 9 (S0 0, S1 0, S2 3, S3 6, M 0).
- Estimativa de esforço: ~6.8 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 1; toca a produção: 1; depende dos sócios: 0.
- Pré-cache do service worker, fotos do mural (miniatura + `lazy` + uma árvore só), URLs de consulta por lotes, mural em menos viagens, upload de vídeo, PIX.
- **Medir antes e depois** com os mesmos scripts da auditoria (`cold.cjs`, `dom.cjs`, `urllen.mjs`, Lighthouse). Meta: carga a frio ≤ 400 KB/60 pedidos aos 25 s; mural com 30 vagas ≤ 1,5 MB até o primeiro scroll.

| AUD     | Sev | Esf. | Tipo                | Título                                                                                                                   | Depende de |
| ------- | --- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AUD-050 | S2  | P    | migration, produção | `feed_jobs` não limita o texto da busca: poucos KB de palavras repetidas prendem o banco por segundos (custo cresce com  | —          |
| AUD-051 | S2  | M    | —                   | Mural: a 1ª foto de cada cartão carrega de uma vez em 1600 px, e as duas versões (celular e computador) ficam montadas   | —          |
| AUD-052 | S2  | M    | —                   | `.in('…', [centenas de ids])` monta URLs de 8 a 19 KB: "Minhas vagas" de empresa movimentada pode falhar                 | —          |
| AUD-172 | S3  | M    | —                   | A versão de produção leva dentro os dados de demonstração e a senha da conta de exemplo                                  | —          |
| AUD-171 | S3  | M    | —                   | Lista do IBGE (≈64 KB gz) no pacote principal e prefetch de todas as telas pesam na primeira visita                      | AUD-172    |
| AUD-173 | S3  | P    | —                   | O service worker baixa 0,88 MB de uma vez na primeira visita (heic2any, mapa, Firebase, tela da equipe, fontes pouco usa | AUD-171    |
| AUD-174 | S3  | M    | —                   | O mural espera até 5 idas e voltas ao banco, uma depois da outra, antes de desenhar                                      | —          |
| AUD-175 | S3  | P    | —                   | PIX: um relógio de 1 s refaz a tela inteira e a consulta a cada 5 s não para com a aba escondida                         | —          |
| AUD-176 | S3  | M    | —                   | Vídeo de até 50 MB sobe sem compressão, sem prazo e sem como cancelar                                                    | —          |

### Bloco 5 — Código, testes e processo

- Itens: 21 (S0 0, S1 0, S2 2, S3 19, M 0).
- Estimativa de esforço: ~10.5 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 0; toca a produção: 5; depende dos sócios: 2.
- CI que não deixa passar (E2E pulado, axe nas rotas erradas, master sem proteção, deploys sem esperar o CI), testes que faltam (Edge Functions, telas no modo real, SQL negativo, fusos), roteiro de produção e scripts de deploy.
- **Risco**: mudar o CI pode deixar o master vermelho. Mitigação: testar numa branch/PR, ligar a proteção do master por último.

| AUD     | Sev | Esf. | Tipo             | Título                                                                                                                   | Depende de |
| ------- | --- | ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AUD-053 | S2  | M    | —                | Nada segura um commit com CI vermelho: master sem proteção, staging e site de teste não esperam o CI, e o plano de produ | —          |
| AUD-177 | S3  | M    | —                | Testes SQL sem as regras mais importantes de autorização, Storage e pagamento                                            | —          |
| AUD-054 | S2  | M    | função, produção | Nenhuma Edge Function tem teste; a assinatura do webhook de pagamento e as 10 funções só são conferidas com chamadas sem | AUD-177    |
| AUD-178 | S3  | P    | —                | Testes que só passam em banco vazio e mexem no banco inteiro                                                             | —          |
| AUD-179 | S3  | P    | função, produção | Pequenas folgas na validação: assinatura do webhook com `ts` não numérico, `APP_ORIGIN` aceita `https://*.com`           | —          |
| AUD-180 | S3  | P    | —                | Os artefatos do E2E (relatório e rastros do Playwright) ficam em repositório público, sem retenção curta                 | —          |
| AUD-181 | S3  | P    | produção         | O staging acumula lixo de teste e dado de gente real, sem rotina de limpeza                                              | —          |
| AUD-182 | S3  | ?    | —                | O E2E nunca executa de verdade 5 das 10 Edge Functions, simula o Google com `createUser` e finge o CNPJ e o mapa; também | —          |
| AUD-183 | S3  | M    | —                | O corpo demo deixa passar o que o banco recusa (candidatura, convite, presença, aviso, cadastro, avaliação)              | —          |
| AUD-184 | S3  | P    | —                | Acessibilidade e desempenho no CI medem a demonstração, e duas telas varridas pelo axe são "Página não encontrada"       | —          |
| AUD-185 | S3  | P    | produção         | O `--mostrar` do configurar-auth.mjs não mostra o estado atual, mas o roteiro usa isso como "desfazer" do Auth           | —          |
| AUD-186 | S3  | M    | responsável      | O "backup manual antes de qualquer mudança" do X30 é uma frase: sem script, sem teste de restauração e sem cópia da chav | —          |
| AUD-187 | S3  | P    | —                | Dependências e actions: 9 vulnerabilidades em ferramentas de desenvolvimento sem `npm audit` no CI, sem Dependabot, acti | —          |
| AUD-188 | S3  | P    | produção         | Scripts de deploy: a trava de produção do deploy.sh é uma variável de ambiente, publica o que está no disco e não confer | AUD-053    |
| AUD-189 | S3  | M    | —                | As telas só são abertas no build de demonstração (axe e rolagem); o modo real só é visto pelo E2E pós-merge, sem visitan | —          |
| AUD-190 | S3  | P    | —                | O job `e2e` do `web.yml` passa vazio e duplica o do `staging.yml`; LEIA.md, E2E.md e relatorio.ts descrevem o que não ro | —          |
| AUD-191 | S3  | P    | —                | O E2E deixa lixo e mexe em dados que não são dele no staging                                                             | AUD-178    |
| AUD-192 | S3  | P    | —                | Os testes Vitest não restauram globais/ambiente sozinhos: uma asserção que falha contamina os testes seguintes           | —          |
| AUD-193 | S3  | P    | —                | Asserções frouxas, ramos condicionais e um arquivo com nome enganoso                                                     | —          |
| AUD-194 | S3  | P    | —                | O harness dos testes SQL: `fails()` só confere o SQLSTATE e `run.mjs` sai com 0 sem `DATABASE_URL`                       | AUD-177    |
| AUD-195 | S3  | P    | responsável      | Não existe alvo de navegadores: o build promete uma coisa e o código e o CSS exigem outra                                | —          |

### Bloco 6 — Documentação e higiene

- Itens: 8 (S0 0, S1 0, S2 1, S3 7, M 0).
- Estimativa de esforço: ~2.8 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 4; toca a produção: 5; depende dos sócios: 2.
- CLAUDE.md, IMPLANTACAO.md, CHECKLIST (com dono e prazo), ADVISORS, documentos históricos, comentários de migrations/código. Sem risco de execução; **depende de os blocos anteriores estarem prontos** para os números não ficarem velhos de novo (gerar números por comando, não à mão).

| AUD     | Sev | Esf. | Tipo                | Título                                                                                                                   | Depende de |
| ------- | --- | ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AUD-196 | S3  | P    | migration, produção | Higiene: duplicações e comentários/documentos desatualizados                                                             | —          |
| AUD-197 | S3  | P    | —                   | `seguranca.sql` e a documentação afirmam proteção que não existe mais (endereço, nota, selo, impulso "não saem por selec | —          |
| AUD-198 | S3  | P    | migration, produção | Documentos descrevem o banco de antes (staging "sem migrations", 48 arquivos, 42/54 RPCs)                                | —          |
| AUD-055 | S2  | M    | migration, produção | O roteiro de produção (IMPLANTACAO.md) parou na migration u12: 13 migrations ficam de fora, sem "desfazer", e há passos  | AUD-198    |
| AUD-199 | S3  | P    | migration, produção | Textos e comentários que ficaram para trás depois do U48/U53/U24 (inclui um "construtora" no aviso de suspensão)         | —          |
| AUD-200 | S3  | P    | função, produção    | Variáveis do Firebase não estão documentadas nos exemplos de ambiente                                                    | —          |
| AUD-201 | S3  | P    | responsável         | O checklist de lançamento não tem dono nem prazo em nenhum item, e o estado "feito/falta" está desatualizado             | —          |
| AUD-202 | S3  | P    | responsável         | Documentos da migração antiga e relatórios velhos confundem: mandam rodar comandos que não existem e descrevem telas que | —          |

### Bloco 7 — Melhorias de produto (agora)

- Itens: 17 (S0 0, S1 0, S2 0, S3 0, M 17).
- Estimativa de esforço: ~9.5 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — somado ao total da rodada.
- Com migration: 1; toca a produção: 4; depende dos sócios: 4.
- Melhorias "agora" com ganho claro no piloto: divulgar a vaga (WhatsApp/copiar link/prévia), "chamar de novo", alerta no mural vazio, linha do tempo da candidatura, candidatura em um toque, cadastro mais curto, ver bicos antes da conta.
- Cada item é independente; fazer só depois dos blocos 0 a 2 e conforme as decisões 8, 15 e 16.

| AUD     | Sev | Esf. | Tipo                          | Título                                                                                                                   | Depende de |
| ------- | --- | ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------- |
| AUD-203 | M   | P    | —                             | Compartilhar vaga só oferece WhatsApp; sem "Copiar link"                                                                 | —          |
| AUD-204 | M   | M    | responsável                   | Link da vaga no WhatsApp mostra sempre a mesma pré-visualização                                                          | —          |
| AUD-205 | M   | P    | —                             | Cadastro: cada "Continuar" fecha o teclado                                                                               | —          |
| AUD-206 | M   | P    | função, produção              | Valor pago não é conferido antes de confirmar o impulso                                                                  | —          |
| AUD-207 | M   | P    | migration, produção           | `feed_jobs` não usa `blocked_between`; só o app filtra bloqueados                                                        | —          |
| AUD-208 | M   | P    | função, responsável, produção | Roteiro de aplicação na produção: dados atuais não correm risco, mas há 9 colunas apagadas sem volta, 2 funções removida | —          |
| AUD-209 | M   | P    | —                             | Folgas na CSP e nos cabeçalhos                                                                                           | —          |
| AUD-210 | M   | P    | função, produção              | Não existe "Sair de todos os aparelhos" e a redefinição de senha só encerra a sessão deste aparelho                      | —          |
| AUD-211 | M   | M    | responsável                   | Política em linguagem jurídica para um público de celular simples                                                        | —          |
| AUD-212 | M   | P    | —                             | Melhoria: matriz de fusos e medição de cobertura no CI (agora)                                                           | —          |
| AUD-213 | M   | M    | —                             | Deixar ver bicos antes de criar a conta                                                                                  | —          |
| AUD-214 | M   | M    | responsável                   | Endereço completo só depois do primeiro bico                                                                             | —          |
| AUD-215 | M   | M    | —                             | Linha do tempo da candidatura (padrão do pedido do iFood)                                                                | —          |
| AUD-216 | M   | M    | —                             | "Chamar de novo" quem trabalhou bem                                                                                      | —          |
| AUD-217 | M   | P    | —                             | O alerta "Avisar quando aparecer bico novo" vira passo do cadastro e do mural vazio                                      | —          |
| AUD-218 | M   | M    | —                             | Card do mural mais denso e informativo                                                                                   | —          |
| AUD-219 | M   | P    | —                             | Candidatura em um toque com "Desfazer"                                                                                   | —          |

### Bloco Fora — Fora desta rodada (potenciais futuros e dependentes de decisão)

- Itens: 3 (S0 0, S1 0, S2 0, S3 0, M 3).
- Estimativa de esforço: ~4.2 dia(s) de trabalho (P=2 h, M=1 dia, G=3 dias) — não entra na soma da rodada.
- Com migration: 1; toca a produção: 1; depende dos sócios: 2.
- Potenciais futuros e itens que dependem de decisão de negócio (renda e "recebi", prova social, "sair de todos os aparelhos"). Não entram na rodada FIX.

| AUD     | Sev | Esf. | Tipo                             | Título                                                              | Depende de |
| ------- | --- | ---- | -------------------------------- | ------------------------------------------------------------------- | ---------- |
| AUD-220 | M   | P    | migration, responsável, produção | Descrição livre da vaga vai ao link público sem filtro de contato   | —          |
| AUD-221 | M   | G    | responsável                      | Pagamento fora do app sem "recebi" e sem renda acumulada            | —          |
| AUD-222 | M   | M    | —                                | Prova social ("Pagou no dia 12 de 14") no detalhe da vaga e no card | —          |

## Estimativa total da rodada

Cerca de **98 dias** de trabalho de uma pessoa (soma dos blocos 0 a 7; P=2 h, M=1 dia, G=3 dias). É uma ordem de grandeza: os itens `responsável` esperam decisões e os itens `produção` esperam janelas e aprovações.

## Riscos transversais e como mitigar

| Risco                                              | Mitigação                                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Quebrar o fluxo central ao mexer em banco/serviços | teste que falha antes (SQL/Vitest/E2E); `seguranca.sql` com caso negativo por papel; staging antes de qualquer produção          |
| Aplicar migration destrutiva na produção           | `u32`, `u63`, `u62`, `u24` e a pendente que apaga o app antigo só com backup ensaiado (AUD-186), comando exato mostrado e "pode" |
| Produção 25 migrations atrás                       | um único roteiro atualizado (AUD-055); aplicar na ordem do `APLICAR.md`; conferir histórico com `conferir-migrations.sh`         |
| Limite de uso do ambiente de IA (janela de 5 h)    | no máximo 3 agentes em paralelo; commits pequenos e frequentes; relatório parcial gravado em arquivo                             |
| Texto legal mudar sem revisão                      | mudar `TERMS.version` só com texto revisado; o aviso de rascunho só some com `LEGAL_REVIEWED = true` (advogado)                  |

## O que fica de fora desta rodada

- Itens do bloco "Fora" (potenciais futuros e dependentes de decisão de negócio).
- Qualquer coisa que dependa de contas externas ainda não criadas (Sentry, healthchecks, SPF/DKIM/DMARC, Turnstile real, Twilio, VAPID, Cloudflare Pages): entram no `CHECKLIST-LANCAMENTO.md` como "ação do responsável", com dono e data.
