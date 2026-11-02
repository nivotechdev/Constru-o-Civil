# P1 — Produto e UX para o público real (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente P1 (o agente não conseguiu gravar o arquivo; `termos.md`, `caminho.md`, `comparacao.md`, `coverage.tsv` e 100 prints existem em `$SCRATCH/out/P1/` e `$SCRATCH/prints/P1/`). Contagem: S0 0, S1 0, S2 6, S3 6, M 10. Toques (caminho.md): trabalhador do zero ao mural = 14 toques e 11 campos (13 e 10 em produção) + código de e-mail; até a 1ª candidatura 17 (16); com conta, mural→candidatura = 3 toques. Empresa: da aba Publicar à vaga publicada = 6 toques e 8 campos (descrição obrigatória). Contraste (tema claro): título/valor 18,5:1; fatos da vaga 8,04:1; detalhes do card 5,84:1 (13 px); botão primário 6,4:1; frase da Splash 5,05:1. Tudo passa AA; só o texto principal passa 7:1. Caminhos relativos a `web/src/`.

### P1-001 — Mural vazio na cidade da pessoa diz "Nenhuma vaga com esse filtro" sem filtro nenhum

- Área: produto
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `pages/worker/feed/FeedParts.tsx:54-75` (`NoJobsState`)
- Prova: cadastro novo com cidade "Caxias do Sul" (`t5.cjs`, print 61): mural sem etiqueta de filtro mostra "Nenhuma vaga com esse filtro / Tire um filtro ou aumente a distância… / Limpar filtros". Só o ramo `location !== home` fala "Ainda não tem bico em {cidade}".
- Impacto: no piloto os primeiros trabalhadores veem o app mandar "tirar um filtro" que não existe; parece defeito.
- Causa raiz: `NoJobsState` não olha se há filtro ativo.
- Correção recomendada: sem filtro: "Ainda não tem bico em {cidade}. Avisamos quando aparecer" + botão que liga o `job_alert`; com filtro: texto atual.
- Critério de aceite: teste com `chips=[]` e `location===home` sem a palavra "filtro"; print do vazio com o botão.
- Dependências: nenhuma (mesmo problema do C4-001; consolidar; liga com P1-018)

### P1-002 — Nenhuma tela do app avisa contra golpe (dinheiro/PIX antecipado, "taxa")

- Área: produto
- Severidade: S2
- Esforço: P
- Confiança: confirmado (busca + leitura)
- Onde: ausência em `pages/worker/JobDetail.tsx`, `ConfirmApplication.tsx`, `ApplicationSent.tsx`, `Selected.tsx:94-97`, `pages/shared/Help.tsx:18-73`; só `services/legal.ts:78` (Termos) e `services/safety.ts:14` (motivo de denúncia)
- Prova: `rg -i "golpe|nunca pague|antecipad|fraude|cuidado"` em pages/components/utils só acha o motivo "Golpe ou pedido de dinheiro". Tela com o WhatsApp liberado (print 30): "Combine ponto de encontro, horário e pagamento direto com a empresa. A Bicos não cobra taxa e não entra na negociação." Ajuda: 12 perguntas, nenhuma de segurança.
- Impacto: o golpe típico (pedem taxa/depósito antes do trabalho) acontece logo depois do WhatsApp liberado, e a pessoa não é avisada nesse momento. Denunciar exige achar a bandeira de 44 px sem texto.
- Causa raiz: a regra está só nos Termos.
- Correção recomendada: linha fixa "Nunca pague para trabalhar. Se pedirem dinheiro antes, não faça e denuncie" com botão "Denunciar" em "Você avançou", no "Aprovado" da empresa e na confirmação; pergunta nova na Ajuda.
- Critério de aceite: texto nos 3 pontos (print) e na Ajuda.
- Dependências: texto aprovado pelos sócios (relacionado a D2-002)

### P1-003 — O selo "Verificada" e o nome da empresa não aparecem onde se decide (card, vaga, confirmar candidatura)

- Área: produto
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `components/JobTile.tsx:73-79,113-161` (nome só no `aria-label`); `pages/worker/JobDetail.tsx:212-228` (nome e nota, sem selo); `ConfirmApplication.tsx:70-95`; selo só em `PublicJob.tsx:157` e no perfil da empresa
- Prova: print 10 (card sem nome de empresa), 20b ("Casa de Festas Cangaíba ★ 4,3 (6) Ver perfil", sem selo), 22; o link público sem conta (print 91) mostra "Verificada" e a vaga dentro da conta não. `rg verified|Verificad` nesses três arquivos: nada.
- Impacto: a verificação de CNPJ, principal sinal de confiança do produto, não ajuda na decisão: quem navega não vê, quem recebe o link por WhatsApp vê.
- Causa raiz: telas refeitas (U58–U61) sem o selo, embora `company.verified` chegue.
- Correção recomendada: selo com texto ao lado do nome da empresa na vaga e na confirmação; nome da empresa numa linha cinza no card (+ selo quando houver).
- Critério de aceite: prints com e sem o selo.
- Dependências: ver D2-002 e D4-005 (regra de fundo do selo)

### P1-004 — "Sua vaga": candidatos ~1.150 px abaixo; a barra fixa oferece "Editar vaga" e "Excluir vaga"

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `pages/recruiter/JobManage.tsx:213-357` (ordem: fotos, selo, título, valor, vagas preenchidas, impulsionar, "Onde e como", candidatos); barra `:359-362`
- Prova: print 81 (1ª tela: "Escolher fotos", "3 aguardando análise", valor); print 84 (candidatos só depois de rolar); primeiro "Aprovar candidato" em y=1.218 px (tela de 800).
- Impacto: quem tem pressa para fechar o bico rola duas telas; a ação fixa à mão é apagar a vaga; demora de resposta afasta o trabalhador.
- Causa raiz: tela montada como "ficha da vaga"; candidatos ficaram no fim.
- Correção recomendada: com pendentes, lista logo sob o título (ou abas "Candidatos | Detalhes"); barra "Ver candidatos (3)"; "Excluir vaga" para dentro de "Editar vaga".
- Critério de aceite: 1º candidato visível na 1ª tela de 360×800.
- Dependências: nenhuma

### P1-005 — Aprovar e Recusar candidato: dois ícones de 40×40 px, sem texto, lado a lado

- Área: produto
- Severidade: S2
- Esforço: P
- Confiança: confirmado (medido)
- Onde: `components/CandidateRow.tsx:107-117` (`IconButton size="sm"`, `gap-1`); `components/IconButton.tsx:11`
- Prova: `t7.cjs`: 6 botões 40×40 (3 candidatos), print 84 (✕ e ✓ sem palavra; nome cortado "Joel Ribei…"). No perfil do candidato a mesma decisão é botão grande com texto (print 85).
- Impacto: toque errado recusa quem se queria aprovar e o trabalhador recebe "Não foi essa vez"; "Desfazer" dura 7 s (`pages/recruiter/decisionToasts.ts`).
- Causa raiz: linha compacta com ações de decisão no peso de ícone de cabeçalho.
- Correção recomendada: botões "Aprovar"/"Recusar" com texto, 48 px e espaço entre eles.
- Critério de aceite: alvos ≥ 48 px e ≥ 8 px de distância (`t7.cjs`).
- Dependências: nenhuma (relacionado a C5-001)

### P1-006 — Avisos de candidato novo, aprovação e bico novo só existem dentro do app

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: provável (decisão L12; não testável na demonstração)
- Onde: `web/docs/DECISOES.md:1409-1425` (push desligado no lançamento), `CHECKLIST-LANCAMENTO.md:125`, `services/features.ts:36`; promessas em `pages/recruiter/JobPublished.tsx:27`, `pages/worker/ApplicationSent.tsx:158`, `pages/worker/feed/FeedSheets.tsx:141-148`
- Prova: só há Edge Function de push (`enviar-push`), sem chave VAPID; nenhuma de e-mail/WhatsApp para avisos. Sem abrir o app ninguém sabe que foi aprovado ou que alguém se candidatou, mas a tela diz "Avisamos quando…".
- Impacto: o laço candidatura → resposta → WhatsApp depende de as duas pessoas abrirem o app; no piloto a 1ª candidatura sem resposta mata a confiança.
- Causa raiz: push adiado para "depois do piloto", sem alternativa.
- Correção recomendada: e-mail (Brevo já previsto) nos 3 eventos (candidato novo, aprovado, resumo diário do alerta) ou push no piloto; enquanto isso trocar "Avisamos" por "Você vê aqui no app".
- Critério de aceite: e-mail/push recebido nos 3 eventos no staging.
- Dependências: ação do responsável (canal, conta, VAPID)

### P1-007 — Etiqueta de situação do card cortada: "Pré-selec…"

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado (print 24)
- Onde: `components/JobTile.tsx:93-104` (`max-w-[calc(100%-3.5rem)]` com botão no canto; texto 11 px na linha 97); `pages/worker/MyApplications.tsx:217-228`
- Prova: print 24: "Pré-selec…" ao lado do botão verde; inteira no detalhe (print 20).
- Impacto: a situação mais importante ("fui escolhido") aparece cortada e pequena.
- Causa raiz: botão de 40 px divide a largura de um card de ~160 px.
- Correção recomendada: rótulo curto ("Aprovado", ver `termos.md` 2.4) ou duas linhas; WhatsApp como linha do card.
- Critério de aceite: print com a etiqueta inteira nos 4 estados com botão.
- Dependências: nenhuma (mesmo problema do B1-014; consolidar)

### P1-008 — "Sua vaga": "R$ 150" quebra em duas linhas a 360 px

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado (print 81)
- Onde: `pages/recruiter/JobManage.tsx:129-140` (`font-mono text-4xl` ao lado de bloco `max-w-[11rem]`)
- Prova: "R$" e "150" em linhas separadas, com "Total R$ 300 por 2 diárias" ao lado.
- Impacto: o número principal quebrado ocupa espaço.
- Causa raiz: duas colunas sem `whitespace-nowrap`.
- Correção recomendada: `whitespace-nowrap` e bloco da direita abaixo no celular.
- Critério de aceite: print 360 px com o valor numa linha.
- Dependências: nenhuma (B2-007 relata o mesmo no desktop; consolidar)

### P1-009 — Alvos de toque abaixo de 48 px em controles frequentes

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (medido, `smallTargets`)
- Onde/medida (L×A px): "Salvar vaga" 40×40; "Filtros" 90×36; abas de ordem 104×40; voltar/compartilhar/denunciar/sino 44×44; "Editar" 92×44; "Ver avaliações" 90×40; "Trocar" 66×36; "Mostrar senha" 36×36; "Esqueci minha senha" 148×36; "Criar minha conta" (login) 126×40; chips de filtro e de avaliação 36 de altura; "Tema claro/escuro" 37×34; "Excluir post" 40×40; aprovar/recusar 40×40
- Prova: `t2/t3/t4/t7/t9.log`. Passam 24 px (WCAG 2.2 AA 2.5.8) e a maioria 44 px; não passam os 48 px.
- Impacto: erro de toque em dedo grosso, pressa ou luva; pior em "Salvar vaga" colado na foto.
- Causa raiz: `h-9`/`h-10` em `Tag`, `IconButton sm`, `SaveFlag`.
- Correção recomendada: 48 px nos botões de ação (a classe `tap-target` já existe).
- Critério de aceite: `smallTargets(page,48)` só devolve campos de formulário de 44 px.
- Dependências: nenhuma (consolidar com C3-008, C5-009, B1-005, B2-006)

### P1-010 — Letra pequena e contraste < 7:1 nos detalhes do card e na tela de entrada

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (calculado, `contrast.cjs`)
- Onde: `components/JobTile.tsx:113` (13 px), `:97` (11 px); `pages/shared/Splash.tsx:9` (`text-white/85`); `pages/worker/feed/MobileFeed.tsx:174-180`
- Prova (claro): título e valor 18,5:1; distância/horário/"por diária" 5,84:1 a 13 px (`#5C6672`); aba inativa 5,0:1 a 14 px; hora da notificação 5,33:1 a 12 px; Splash 5,05:1; botão primário 6,4:1; fatos da vaga 8,04:1.
- Impacto: data, distância e situação, o que se lê na rua ao sol, ficam em 13 px cinza; o texto principal passa 7:1, o secundário não.
- Causa raiz: card no estilo "lista de hospedagem" (U57–U61).
- Correção recomendada: detalhes do card em 14 px e `concrete-600` (8,04:1); Splash em branco pleno.
- Critério de aceite: `contrast.cjs` ≥ 7:1 nos textos de informação e ≥ 14 px no card.
- Dependências: nenhuma (relacionado a C5-010, C5-018)

### P1-011 — Vocabulário que ainda diverge na tela (lista com arquivo:linha em `termos.md` §2)

- Área: produto
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Signup.tsx:124` ("Cadastro de recrutador"); `layouts/navItems.ts:17` × `pages/worker/MyApplications.tsx:235` × `Help.tsx:48` (aba "Vagas" = "Minhas candidaturas"; o mural é "Início"); `utils/applicationStatus.ts:390-397` × `:449-451` ("Pré-selecionado" × "Aprovado"); `pages/recruiter/JobManage.tsx:153,401,414` ("vaga" = anúncio e = lugar); `ConfirmApplication.tsx:98` ("suas especialidades", que não existem mais); `Selected.tsx:73,160` ("A {nome}" com pessoa física); `Help.tsx:29` ("pedir o link", agora é código); `components/ReviewForm.tsx:254` ("Ok"); cinco nomes para "encerrada" (`JobManage.tsx:411`, `JobClosed.tsx:421`, `layouts/accountMenu.ts:22`)
- Prova: `termos.md`. Cumprido o U48: nenhuma obra/pedreiro/EPI/construtora/ofício visível; só 1 "recrutador" na tela.
- Impacto: pequeno, mas "Vagas" abrindo "Minhas candidaturas" e "Pré-selecionado"/"Aprovado" é o que o suporte vai ouvir.
- Causa raiz: U62/U63 renomearam sem varrer Ajuda e telas vizinhas.
- Correção recomendada: coluna "Sugestão" de `termos.md`.
- Critério de aceite: `rg` nas formas antigas sem resultado.
- Dependências: nenhuma (consolidar com C4-010, C3-012, C6-007)

### P1-012 — A cidade do mural só aparece dentro da folha "Filtros"

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado (prints 10 e 12)
- Onde: `pages/worker/feed/MobileFeed.tsx:197-207` (logo, sino, busca); cidade só em `FeedSheets.tsx` ("Onde você quer trabalhar")
- Prova: print 10 sem cidade; print 12 mostra "São Paulo, SP — Escolher" só ao abrir Filtros; sem etiqueta quando é a cidade do perfil.
- Impacto: diante de "nenhuma vaga" (P1-001) ou poucos bicos a pessoa não sabe onde está buscando.
- Causa raiz: a cidade padrão não é "filtro ativo", então fica invisível.
- Correção recomendada: linha "cidade" tocável sob a busca (como o endereço no topo do iFood).
- Critério de aceite: print do mural com a cidade visível e tocável.
- Dependências: nenhuma

### P1-013 — (melhoria agora) Deixar ver bicos antes de criar a conta

- Área: produto
- Severidade: M
- Esforço: M
- Confiança: confirmado
- Onde: `pages/shared/Splash.tsx:4-25`; `/v/:id` só abre com link
- Prova: print 00 (só "Bicos e diárias perto de você. Sem taxa para o trabalhador.", "Entrar" em destaque e "Criar minha conta" apagado, para quem é novo); 14 toques, 11 campos e código de e-mail antes do 1º bico (`caminho.md`).
- Impacto: ganho: conversão do cadastro; vitrine para vender à empresa no piloto (o iFood mostra a lista antes do login).
- Causa raiz: tudo exige conta.
- Correção recomendada: "Ver bicos perto de mim" (cidade em 1 pergunta) com lista pública só bairro/cidade (regra do `public_job_card`); "Criar minha conta" vira o principal.
- Critério de aceite: visitante vê a lista pública sem conta.
- Dependências: C3-001, D1-001 (decidir o que é público)

### P1-014 — (melhoria agora) Endereço completo só depois do primeiro bico

- Área: produto
- Severidade: M
- Esforço: M
- Confiança: confirmado (prints 57–59)
- Onde: `pages/shared/CompleteProfile.tsx:207-236` (CEP, cidade, rua, bairro obrigatórios)
- Prova: após o código do e-mail, 4 campos e 3 toques de sugestão antes de ver qualquer vaga.
- Impacto: ganho: menos abandono no último passo; conta sem endereço já usa a cidade do perfil (U51).
- Causa raiz: endereço obrigatório no cadastro.
- Correção recomendada: pedir o endereço ao tocar na distância ou na 1ª candidatura.
- Critério de aceite: cadastro sem endereço chega ao mural.
- Dependências: decisão dos sócios

### P1-015 — (melhoria agora) Linha do tempo da candidatura (padrão do pedido do iFood)

- Área: produto
- Severidade: M
- Esforço: M
- Confiança: confirmado
- Onde: `pages/worker/ApplicationStatusCard.tsx:9-31`; `utils/applicationStatus.ts:388-390` (`enviada` e `em_analise` iguais: "Em análise")
- Prova: prints 20 e 24: texto "Enviada hoje, 14h16 / Pré-selecionado desde…", sem passos nem "falta a empresa responder".
- Impacto: ganho: menos "e aí?" no suporte e motivo para voltar ao app.
- Causa raiz: status sem progresso visual.
- Correção recomendada: passos Enviada → Vista → Aprovada → Concluída com hora.
- Critério de aceite: card mostra os passos.
- Dependências: nenhuma

### P1-016 — (melhoria agora) "Divulgar no WhatsApp" na tela "Vaga publicada"

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: confirmado (print 76)
- Onde: `pages/recruiter/JobPublished.tsx:40-55`; só há ícone sem texto em `JobManage.tsx:216-224`
- Prova: botões = Impulsionar (escondido sem pagamento), Gerenciar vaga, Voltar ao início.
- Impacto: ganho: efeito de rede no piloto — a empresa leva o link `/v/BC-…` (mostra a vaga e o selo, print 91) ao grupo dela; a 1ª vaga com 0 candidatos é o momento de maior abandono.
- Causa raiz: sem chamada de divulgação.
- Correção recomendada: botão que usa `shareJob`.
- Critério de aceite: botão abre o compartilhamento com o link `/v/<slug>`.
- Dependências: C3-001 (mesmo item do C4-016; consolidar)

### P1-017 — (melhoria agora) "Chamar de novo" quem trabalhou bem

- Área: produto
- Severidade: M
- Esforço: M
- Confiança: confirmado
- Onde: `pages/recruiter/JobClosed.tsx` (resumo); `pages/shared/WorkerProfileScreen.tsx:200` (único "Convidar para uma vaga"); `MyJobs.tsx:221-229` ("Publicar de novo" só como ícone ↻ 36–40 px)
- Prova: print 100 (resumo de vaga encerrada): a equipe mostra nome e "Avaliar", sem link para o perfil; `rg -i "favorit|recontrat|chamar de novo"`: nada; não achou outro caminho até o perfil de um trabalhador de vaga já encerrada.
- Impacto: ganho: 2ª vaga em menos de 1 minuto ("Quem já trabalhou com você: Ana, João — chamar") e retorno da empresa e do trabalhador que foi bem.
- Causa raiz: sem recontratação.
- Correção recomendada: bloco "Quem já trabalhou com você" na criação de vaga e no resumo da vaga encerrada.
- Critério de aceite: da vaga encerrada chega-se ao convite em 2 toques.
- Dependências: nenhuma

### P1-018 — (melhoria agora) O alerta "Avisar quando aparecer bico novo" vira passo do cadastro e do mural vazio

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: confirmado (print 12)
- Onde: `pages/worker/feed/FeedSheets.tsx:115-163` (último item da folha Filtros)
- Prova: só aparece rolando a folha; em nenhum outro lugar. Sem push só chega ao sino (P1-006).
- Impacto: ganho: único gancho de "voltar amanhã" já pronto; no piloto, com mural vazio, mantém o trabalhador inscrito.
- Causa raiz: recurso escondido.
- Correção recomendada: oferecer o alerta no mural vazio e no fim do cadastro.
- Critério de aceite: mural vazio mostra o botão do alerta.
- Dependências: P1-001, P1-006

### P1-019 — (melhoria agora) Card do mural mais denso e informativo

- Área: UX
- Severidade: M
- Esforço: M
- Confiança: confirmado (print 10)
- Onde: `components/JobTile.tsx:87-112`, grade de 2 colunas
- Prova: 2 bicos por tela a 360×800; a capa ilustrada ocupa ~60 % do card; títulos cortados ("Garçom para almoço e…").
- Impacto: ganho: comparar 4–6 bicos por rolagem; some a necessidade de abrir a vaga para saber quem contrata.
- Causa raiz: card de capa grande.
- Correção recomendada: capa 16:9 quando só há ilustração; nome da empresa no card.
- Critério de aceite: ≥ 4 bicos por tela em 360×800.
- Dependências: P1-003

### P1-020 — (melhoria agora) Candidatura em um toque com "Desfazer"

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: confirmado (prints 20b–23)
- Onde: `pages/worker/JobDetail.tsx:123` → `ConfirmApplication.tsx:104-111` → `ApplicationSent.tsx`
- Prova: 3 toques e 3 telas do card à candidatura; a tela do meio repete título, valor e data.
- Impacto: ganho: um passo a menos no momento de maior valor (padrão WhatsApp/Nubank: ação direta + Desfazer; cancelar já existe, `JobDetail.tsx:474-488`).
- Causa raiz: confirmação em tela separada.
- Correção recomendada: candidatar com um toque e "Desfazer" por alguns segundos.
- Critério de aceite: candidatura do detalhe em 1 toque.
- Dependências: C1-001

### P1-021 — (melhoria futura) Pagamento fora do app sem "recebi" e sem renda acumulada

- Área: produto
- Severidade: M
- Esforço: G
- Confiança: confirmado
- Onde: `pages/worker/JobDetail.tsx:219`, `Selected.tsx:94-97`, `components/ReviewForm.tsx` (etiqueta "Pagou no dia")
- Prova: o perfil do trabalhador mostra só "23 bicos realizados" (print 31); não há "Recebi"/"Paguei".
- Impacto: ganho: "você fez R$ X este mês" (motivo para voltar) e medição de calote (dado para confiança e para um futuro pagamento garantido).
- Causa raiz: o dinheiro não passa pelo app.
- Correção recomendada: botão "Recebi" / "Paguei" depois da diária e resumo de renda.
- Critério de aceite: renda do mês visível no perfil.
- Dependências: decisão de negócio

### P1-022 — (melhoria futura) Prova social ("Pagou no dia 12 de 14") no detalhe da vaga e no card

- Área: produto
- Severidade: M
- Esforço: M
- Confiança: confirmado
- Onde: `components/JobTile.tsx`, `pages/shared/CompanyProfileScreen.tsx`; `COMPANY_TAGS` em `services/reviews.ts`
- Prova: a etiqueta "Pagou no dia" é coletada, mas só aparece nas avaliações do perfil.
- Impacto: ganho: a informação que o trabalhador mais quer antes de ir (padrão nota + nº de avaliações do iFood/Uber).
- Causa raiz: dado coletado e não exibido onde se decide.
- Correção recomendada: mostrar "Pagou no dia: X de Y" no detalhe da vaga e no card.
- Critério de aceite: indicador visível no detalhe.
- Dependências: nenhuma

## Hipóteses não confirmadas

- H1: rolagem do mural com fotos/mapa pode engasgar em Android de 2 GB; medido em navegador de desktop.
- H2: contraste do tema escuro não medido (tema é da conta, U26; o script travou).
- H3: o código de e-mail (sair do app e voltar) deve ser o maior ponto de abandono; sem dados de funil (`funnel_daily` existe, produção tem 4 contas).
- H4: textos sobre "caixa de spam" dependem de o e-mail chegar de fato (L04, ação do responsável); sem SMTP próprio não verificado.

## Bom e deve ser preservado

- Cadastro em uma pergunta por tela com "Passo n de 6" e botão fixo (`Signup.tsx:92-154`, print 54).
- Ficha do candidato com nota, "bicos realizados", "0 faltas · 0 desistências", selo "Verificado" (print 85); WhatsApp só depois da aprovação.
- Denunciar/bloquear com motivo "Golpe ou pedido de dinheiro" (`safety.ts:13-20`); "Desfazer" por 7 s ao aprovar/recusar; confirmações com o verbo da ação.
- Estados vazios com chamada para ação; erros do cadastro que dizem o que fazer; "Você não paga nada para se candidatar".
- Link público `/v/:id` com selo "Verificada" e "Entrar para me candidatar / Criar minha conta" (print 91): base do crescimento por WhatsApp.
- Cards sem pílulas nem urgência artificial (U04).
