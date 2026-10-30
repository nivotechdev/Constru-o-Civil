# Achados S3 (baixo) da auditoria AUD

Mesmo formato dos demais; os IDs são os mesmos da `AUDITORIA-COMPLETA.md`. A origem de cada um (agente e ID original) está na linha `Origem`.

## Área: UX (26)

### AUD-083 — Busca no mural com texto longo sem espaços: o título "Nenhuma vaga para “…”" sai do cartão

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `components/EmptyState.tsx`; print `$SCRATCH/prints/B1/B1_mural_m_busca_longa.png`
- Prova: print.
- Impacto: layout quebrado.
- Causa raiz: sem quebra de palavra longa.
- Correção recomendada: `break-words` no título do `EmptyState`.
- Critério de aceite: o título não sai do cartão.
- Dependências: nenhuma
- Origem: B1-006 (B1)

### AUD-084 — `/entrar-celular` sem botão, mas abre por link e responde "Na demonstração, entre com e-mail e senha"

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `services/auth.ts:530`; `routes.ts:128` (rota sem guarda); DECISOES:1988
- Prova: com `phoneLogin` desligado a tela responde a mensagem de demonstração.
- Impacto: em produção a mensagem é errada.
- Causa raiz: rota acessível com o recurso desligado.
- Correção recomendada: redirecionar ao `/login` se `!FEATURES.phoneLogin`.
- Critério de aceite: `/entrar-celular` com o recurso desligado leva ao login.
- Dependências: nenhuma
- Origem: B1-007 (B1)
- Revisão adversária: Cético B: decisão documentada (`DECISOES.md:1988`: rota sem botão para quando o SMS for ligado); resíduo: a mensagem 'na demonstração…' aparece no modo real.

### AUD-085 — Cadastro aceita "Maria 😀 Souza" e não limita o nome; o editar perfil limita em 80

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Signup.tsx`, `EditWorkerProfile.tsx`
- Prova: reproduzido.
- Impacto: regra de nome inconsistente.
- Causa raiz: validações separadas.
- Correção recomendada: unificar a regra (comprimento e caracteres).
- Critério de aceite: mesma regra nas duas telas e no banco.
- Dependências: nenhuma
- Origem: B1-010 (B1)

### AUD-087 — Impulsionar vaga de outra empresa mostra um título e uma explicação que não combinam

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/BoostJob.tsx:40-57` (descrição fixa quando a vaga não está impulsionada); `boostBlocker` em `services/payments.ts`
- Prova: logado como Meridiano, abrir `/impulsionar/BC-4822` (vaga do Restaurante Alvorada): título "Só a empresa da vaga pode impulsionar." e descrição "Vagas encerradas, cheias ou vencidas não aparecem no mural." (`out/B2/tour1-m.txt`, `prints/B2/t1-m-impulsionar_BC_4822.png`).
- Impacto: a explicação fala de vaga encerrada quando o problema é ser de outra empresa; confunde, e dá a entender que a vaga está fechada.
- Causa raiz: a descrição só distingue "já impulsionada" de "qualquer outro bloqueio".
- Correção recomendada: descrição própria para "não é sua" (ou sem descrição), como já fazem `/vaga-gerenciar` e `/fechado` ("Essa vaga não é sua").
- Critério de aceite: teste de tela com vaga alheia, vaga cheia e vaga já impulsionada, cada uma com a explicação certa.
- Dependências: nenhuma
- Origem: B2-005 (B2)

### AUD-089 — Passo do código (WhatsApp e e-mail) abre sem foco no campo: o teclado não sobe sozinho

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/shared/Signup.tsx:537-550` + `WhatsAppCode.tsx`; `web/src/pages/shared/VerifyEmail.tsx:284-294` (o próprio arquivo comenta que o autofoco só funciona no primeiro campo da página, `:174-175`)
- Prova: `/cadastro/recrutador` até o passo "Confirme seu WhatsApp": `document.activeElement` é `BODY`; em `/verificar-email` também (`out/B2/f10.cjs`, `f11.cjs`).
- Impacto: em celular simples o usuário precisa tocar no campo antes de digitar o código recebido.
- Causa raiz: `autoFocus` não funciona ao trocar de passo; só o passo de e-mail do "Trocar" tem `focus()` manual.
- Correção recomendada: `useEffect` que foca o campo ao entrar no passo do código.
- Critério de aceite: `document.activeElement.id` igual ao do campo do código ao abrir o passo.
- Dependências: nenhuma
- Origem: B2-009 (B2)

### AUD-091 — Mensagem pronta do WhatsApp erra o tratamento: "Aqui é da Ana Souza" (pessoa) e "Fui contratado" para qualquer trabalhador

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (leitura + teste que fixa o texto)
- Onde: `web/src/utils/whatsapp.ts:38-44` (usada por `services/contacts.ts:62-70` e `services/remote/actions.ts:61-70`); testes que fixam o texto: `web/src/__tests__/contacts.test.ts:52,73-83`. Contexto: `DECISOES.md` U63 (quem contrata pode ser "Ana Souza ou Padaria Bom Pão").
- Prova: `companyToWorkerMessage` monta `Aqui é da ${companyName}, pela Bicos`; com o nome de uma pessoa sai "Aqui é da Ana Souza, pela Bicos". `workerToCompanyMessage` monta `Fui ${hired ? 'contratado' : 'aprovado'}` sem olhar quem escreve: uma trabalhadora manda "Fui contratado".
- Impacto: é a primeira mensagem entre as duas partes, a que prova que o app é sério; o erro é pequeno mas aparece em todo contato de pessoa física, que é o público novo do U48. A pessoa pode editar antes de enviar.
- Causa raiz: o texto foi escrito quando só havia construtora (artigo "da") e antes do nome único (U63).
- Correção recomendada: "Aqui é {nome}, pela Bicos" (sem artigo) e "Fui escolhido(a)/Você foi escolhido(a)", ou "Estou dentro da vaga…" — decisão de redação dos sócios.
- Critério de aceite: texto novo nos testes de `contacts.test.ts`.
- Dependências: nenhuma (redação: ação do responsável).
- Origem: C1-005 (C1)

### AUD-093 — Aviso de sucesso "E-mail trocado. Use o novo para entrar." aparece como erro (tom vermelho)

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (lógica lida; não abri o app com o link)
- Onde: web/src/services/remote/session.ts:376 e :397
- Prova: `notice = 'E-mail trocado. Use o novo para entrar.'` (l.376); `flushNotice` usa `tone: text.startsWith('E-mail confirmado') ? 'default' : 'error'` (l.397). "E-mail trocado…" não começa com "E-mail confirmado", então sai `error`.
- Impacto: quem acabou de trocar o e-mail com sucesso vê um aviso em vermelho e acha que deu errado.
- Causa raiz: o tom é deduzido do começo do texto.
- Correção recomendada: guardar `{ text, tone }` em `notice` em vez de comparar texto.
- Critério de aceite: teste de `restore()` com `#access_token=…&type=email_change` verifica `tone: 'default'`.
- Dependências: nenhuma.
- Origem: C2-010 (C2)

### AUD-095 — Envio de fotos/vídeos: sem prazo nem cancelamento, e erros do bucket viram sempre "Não deu para enviar a foto agora"

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: web/src/services/remote/storage.ts:40-62 (XHR sem `timeout`/`ontimeout`/`onabort`), :54-57 (qualquer status ≠ 2xx → `falha_demo`), :88 (`EXTENSIONS[blob.type] ?? 'jpg'`); web/src/utils/image.ts:44 (GIF volta como está); migration 20261010000700_z12_fotos.sql:100-107 (buckets só aceitam jpeg/png/webp, e mp4/quicktime/webm no `portfolio`)
- Prova: o XHR nunca define `xhr.timeout`; uma conexão que trava sem cair deixa a barra parada até o navegador desistir. `xhr.onload` trata 401 (token vencido), 403, 413 e 415 como a mesma falha genérica, sem acionar o "sessão terminou". Um GIF ou um vídeo 3gp/mkv escolhido (o `accept` é `image/*,video/*`) sobe com o tipo original, o bucket recusa e a pessoa recebe "Tente de novo" para sempre. `portfolioFileProblem` (utils/media.ts) só confere tamanho/duração, não o tipo aceito pelo bucket.
- Impacto: em internet ruim o envio pode ficar girando sem saída; formatos que o bucket não aceita nunca avisam o motivo.
- Causa raiz: tratamento de erro mínimo no caminho do XHR (feito para ter barra de progresso).
- Correção recomendada: `xhr.timeout` (ex.: 60 s sem progresso) com mensagem "Conexão fraca…"; mapear 401→sessão terminou, 413→"arquivo grande", 415→"formato não aceito (use JPG/PNG)"; validar o tipo contra a lista do bucket antes de enviar.
- Critério de aceite: testes do `storage.ts` com status 401/413/415 e com `ontimeout`.
- Dependências: nenhuma.
- Origem: C2-012 (C2)

### AUD-096 — `checkPassword`/`verifyOtp` não tratam limite de tentativas nem conta suspensa: caem em "Não deu certo agora"

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: web/src/services/remote/auth.ts:120-137 (`checkPassword`, usada por `changePassword`, `changeEmail` e pela exclusão de conta), :177-197 (`checkSecurityCode`)
- Prova: `signIn` (l.91-103) trata `over_request_rate_limit`, `user_banned`, `captcha_failed`; `checkPassword` só trata `invalid_credentials` e delega o resto a `toServiceError`, que para esses códigos devolve `falha_demo` (client.ts:78). Quem erra a senha várias vezes ao trocar a senha/e-mail ou ao excluir a conta recebe a mensagem genérica em vez de "Muitas tentativas. Espere…".
- Impacto: a pessoa repete sem saber que está bloqueada por alguns minutos.
- Causa raiz: tratamento duplicado e desigual entre as funções de re-autenticação.
- Correção recomendada: extrair `authErrorToService(error)` usado por `signIn`, `checkPassword`, `verifyEmailCode` e `checkSecurityCode`.
- Critério de aceite: teste de `checkPassword` com `over_request_rate_limit` espera `code: 'conflito'` com a mensagem de espera.
- Dependências: nenhuma.
- Origem: C2-016 (C2)

### AUD-097 — Qualquer erro do Firebase com a palavra "captcha" vira "Esse jeito de entrar ainda não está ligado"; navegadores embutidos (WhatsApp/Instagram) caem em erro genérico

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (lógica lida; não testei em aparelho)
- Onde: web/src/services/remote/firebase.ts:109-131 (`firebaseError`), :178-212 (`signInWithFirebaseGoogle`); `grep -rni "FBAN\|Instagram\|webview" web/src` → nenhuma detecção de navegador embutido
- Prova: `code.includes('captcha')` junto com `unauthorized-domain` e `operation-not-allowed` devolve `falha_demo` "…ainda não está ligado. Entre com e-mail e senha." — inclui `auth/captcha-check-failed` e `missing-recaptcha-token`, que são falhas reais do reCAPTCHA do aparelho (bloqueador de anúncios, rede lenta), não "recurso desligado". Erros como `auth/web-storage-unsupported` e `auth/operation-not-supported-in-this-environment` (típicos de navegador embutido) caem em `toServiceError(e)` → "Não deu certo agora".
- Impacto: o link da vaga é compartilhado por WhatsApp; quem abre dentro do WhatsApp/Instagram e toca em "Entrar com Google" vê erro sem saída clara (o Google bloqueia login em navegador embutido).
- Causa raiz: mapeamento de códigos incompleto e nenhuma orientação para "abrir no navegador".
- Correção recomendada: separar `captcha` (mensagem "Não deu para confirmar que você não é um robô, tente de novo") de `operation-not-allowed`; detectar navegador embutido e mostrar "Abra este link no Chrome/Safari para entrar com o Google".
- Critério de aceite: testes de `firebaseError` para `auth/captcha-check-failed` e `auth/web-storage-unsupported`.
- Dependências: nenhuma.
- Origem: C2-019 (C2)

### AUD-103 — Link de redefinir senha vencido só avisa depois que a pessoa digita

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/ResetPassword.tsx:31-46`; `services/remote/auth.ts:378-382`
- Prova: o formulário abre sempre (rota pública); só `resetPassword()` checa a sessão e recusa depois da digitação. O erro de força da senha cai embaixo do campo "Confirme", pois há um único `error`.
- Impacto: a pessoa digita a senha nova e só então descobre que o link venceu.
- Causa raiz: sem checagem da sessão de recuperação ao montar.
- Correção recomendada: ao montar, sem sessão de recuperação, mostrar "Esse link venceu" com "Pedir outro link", sem formulário; pôr o erro de força no campo da senha.
- Critério de aceite: link vencido mostra o aviso antes do formulário.
- Dependências: nenhuma
- Origem: C3-014 (C3)

### AUD-105 — "Desbloquear": todos os botões giram juntos

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/BlockedAccounts.tsx:43-49`
- Prova: `loading={unblock.loading}` é compartilhado entre as linhas; todos viram spinner sem rótulo e ficam desativados.
- Impacto: confusão ao desbloquear uma conta específica.
- Causa raiz: estado de carregamento global da ação.
- Correção recomendada: guardar o `id` em andamento.
- Critério de aceite: só o botão tocado mostra o spinner.
- Dependências: nenhuma
- Origem: C3-016 (C3)

### AUD-106 — O formulário de publicar vaga se perde ao sair da tela ou recarregar, sem aviso

- Área: UX
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: Y21/Y22 (`DECISOES.md:589-596`) fazem o estado da tela morrer ao sair, de propósito; resíduo: a recarga pela câmera do celular. Rebaixado para S3.
- Esforço: M
- Confiança: provável
- Onde: `pages/recruiter/CreateJob.tsx:94` (usa `useScreenUI`, que apaga o estado ao desmontar, `hooks/useStore.ts:49`); `services/store.ts:30-39` (só guarda o id da sessão no aparelho); `CreateJob.tsx:425-429` (sem seta de voltar ao publicar)
- Prova: leitura do código; um toque no menu de baixo, ou o celular descarregar a página ao voltar da câmera, perde título, endereço, descrição de até 1000 letras e fotos.
- Impacto: a empresa preenche tudo de novo; num celular simples, a câmera costuma recarregar a página.
- Causa raiz: estado do formulário só em memória, sem rascunho.
- Correção recomendada: rascunho em `sessionStorage` com try/catch, ou confirmar ao sair.
- Critério de aceite: recarregar a página no passo 2 restaura os campos.
- Dependências: nenhuma
- Origem: C4-003 (C4)

### AUD-109 — Candidato aprovado: "Desfazer aprovação" e "Cancelar" são quase iguais

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/CandidateActions.tsx:114-141,280-293`
- Prova: o segundo abre "Cancelar a contratação?" e avisa o trabalhador com motivo, mas a empresa ainda não contratou (`desfazer_aprovacao` × `cancelar_contratacao`).
- Impacto: a empresa pode avisar o trabalhador de um cancelamento que não precisava existir.
- Causa raiz: duas saídas para o mesmo estado `pre_selecionado`.
- Correção recomendada: uma saída só em `pre_selecionado`.
- Critério de aceite: em `pre_selecionado` há uma única ação de sair.
- Dependências: nenhuma
- Origem: C4-009 (C4)

### AUD-110 — Digitar na busca troca a lista pelo esqueleto

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/Feed.tsx:55-62`, `MobileFeed.tsx:103`
- Prova: a chave da consulta inclui a busca, então chave nova é "loading"; offline aparece `ErrorState` mesmo com `found` pronto no aparelho.
- Impacto: a lista pisca a cada letra digitada; sem internet, perde-se o que já estava na tela.
- Causa raiz: estado "loading" por chave.
- Correção recomendada: só mostrar o esqueleto se `found` for vazio.
- Critério de aceite: digitar mantém a lista anterior até chegar a nova.
- Dependências: nenhuma
- Origem: C4-011 (C4)

### AUD-111 — "Todas · N" em Minhas vagas conta só as páginas carregadas

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/MyJobs.tsx:52-60,82`
- Prova: contagem local.
- Impacto: número menor que o real.
- Causa raiz: contagem sobre o que foi carregado.
- Correção recomendada: "30+".
- Critério de aceite: com mais de 30 vagas mostra "30+".
- Dependências: nenhuma
- Origem: C4-012 (C4)

### AUD-112 — /admin: pequenos furos

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/admin/Admin.tsx:161-168,187-195,281-288,356-361,372,413-421,464`; `supabase/migrations/20261015000100_lanc06_backoffice.sql:287,322,363`
- Prova: os links de selfie e documento valem 5 min, mas a página os guarda para sempre; depois as imagens quebram e "Aprovar" segue ativo. `resolution.replace('_',' ')` mostra o verbo cru "arquivar"; o registro mostra `targetType` cru. Num cartão resolvido de vaga oculta com conta suspensa, só dá para reexibir a vaga. Aprovar empresa ou identidade é um toque só, sem confirmação. Filas limitadas a 200 no servidor, sem aviso de que há mais. A checagem de papel está certa: o front só pergunta `is_staff` e o banco decide.
- Impacto: risco de aprovar uma identidade sem ver a foto (link vencido); fila maior que 200 invisível.
- Causa raiz: tela de equipe sem acabamento.
- Correção recomendada: renovar links ao vencer e desabilitar "Aprovar" sem foto; confirmação ao aprovar; aviso de "há mais"; rótulos legíveis.
- Critério de aceite: com links vencidos o botão fica desativado até renovar.
- Dependências: nenhuma
- Origem: C4-013 (C4)

### AUD-113 — O prazo de 30 dias da vaga sem data não é dito a quem publica

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/CreateJob.tsx:321-327`
- Prova: só diz "fica com a data a combinar"; a vaga some do mural em 30 dias (`TO_ARRANGE_DAYS`, DECISOES U52).
- Impacto: a empresa é surpreendida quando a vaga some.
- Causa raiz: regra não informada.
- Correção recomendada: "fica 30 dias no mural".
- Critério de aceite: texto visível no passo de datas.
- Dependências: nenhuma
- Origem: C4-015 (C4)

### AUD-116 — Número colado com "+55" ou "0" vira outro número e é recusado

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (função executada, `t1.mts`)
- Onde: `utils/format.ts:24-35` (`maskPhone` corta nos 11 primeiros dígitos); usado em `Signup.tsx`, `ChangeWhatsApp.tsx:128`, `PhoneSignIn.tsx:122`
- Prova: `"+55 54 99999-9999"` → `(55) 54999-9999` (inválido); `"5554999999999"` idem; `"054 99999-9999"` → `(05) 49999-9999`; `"(54) 99999-9999"` ok.
- Impacto: quem copia da agenda/WhatsApp vê os dígitos trocarem e "número inválido" sem entender.
- Causa raiz: a máscara corta antes de tirar o prefixo.
- Correção recomendada: tirar prefixo 55 (12–13 dígitos) ou 0 antes de cortar.
- Critério de aceite: teste dos 4 casos → `(54) 99999-9999`.
- Dependências: nenhuma
- Origem: C6-005 (C6)

### AUD-132 — Se salvar o tema falhar, o aviso sempre diz "Sem internet" (mesmo quando a internet está boa)

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: web/src/services/theme.ts:97-100
- Prova: `saveMyTheme(theme).catch(() => { … showToast(serviceError('offline').message + ' O tema não foi salvo.' …) })` — o `catch` não olha o erro: sessão vencida, RPC `set_my_theme` ausente (banco atrasado) ou erro 500 também mostram "Sem internet. Confira sua conexão e tente de novo. O tema não foi salvo."
- Impacto: mensagem enganosa; a pessoa culpa a internet quando o problema é de sessão ou servidor.
- Causa raiz: `catch` sem distinguir o erro.
- Correção recomendada: usar `errorMessage(e)` (services/errors.ts:38).
- Critério de aceite: teste de `setTheme` com RPC falhando com `PGRST202` mostra a mensagem genérica, não a de offline.
- Dependências: nenhuma.
- Origem: C2-018 (C2)

### AUD-144 — Textos que contradizem o contexto

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `/selecionado/BC-4830` (candidatura em análise) tem título "Você avançou" e corpo "Essa tela não está disponível"; `pages/shared/PublicJob.tsx:97` (trabalhador já logado em `/v/<inexistente>` lê "Entre para ver outros bicos")
- Prova: reproduzido no demo.
- Impacto: mensagens erradas confundem.
- Causa raiz: textos reaproveitados sem ramo para o estado.
- Correção recomendada: ramos de texto por estado.
- Critério de aceite: textos coerentes nesses dois casos.
- Dependências: nenhuma
- Origem: B1-009 (B1)

### AUD-146 — Em 360 px o status mais importante é cortado

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: Minhas candidaturas (chip "Pré-selecionado" vira "Pré-seleci…"; o botão redondo do WhatsApp cobre o chip; `$SCRATCH/prints/B1/B1_minhas_cand_m.png`); mural (título do cartão em 2 colunas vira "Garçom para almoço e…"); datas das vagas salvas truncadas
- Prova: prints.
- Impacto: o trabalhador não lê o próprio status.
- Causa raiz: layout com largura fixa.
- Correção recomendada: status em linha própria/duas linhas; não sobrepor o botão.
- Critério de aceite: status completo visível em 360 px.
- Dependências: nenhuma
- Origem: B1-014 (B1); também reportado por: P1-007
- Ocorrências adicionais (mesmo problema, outros lugares):
  - P1-007 (S3): Etiqueta de situação do card cortada: "Pré-selec…" — onde: `components/JobTile.tsx:93-104` (`max-w-[calc(100%-3.5rem)]` com botão no canto; texto 11 px na linha 97); `pages/worker/MyApplications.tsx:217-228`

### AUD-147 — Ao errar o formulário, o foco não vai para o primeiro erro e a mensagem do título fica escondida sob a barra fixa

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/CreateJob.tsx:148-163,174-209` (nada chama `focus()`/`scrollIntoView` no primeiro campo com erro)
- Prova: `/criar-vaga` a 360x800, rolar até o fim e tocar "Continuar" vazio: `document.activeElement` continua o botão; o primeiro erro ("Dê um título…") fica a 38 px do topo, abaixo da barra fixa "Publicar vaga" (cortado, ver `prints/B2/f1-criar-vazio-m.png`); só aparece "Confira os campos marcados em vermelho" junto do botão.
- Impacto: no celular o erro principal fica acima da dobra; quem não rola de volta acha que o botão não funciona.
- Causa raiz: `setUi({ errors })` sem mover foco/rolagem.
- Correção recomendada: após `setUi({errors})`, focar o primeiro campo inválido (`document.getElementById(...)?.focus({preventScroll:false})` com `scroll-margin-top` da barra).
- Critério de aceite: teste e2e: tocar Continuar vazio e `document.activeElement.id === 'create-job-titulo'`.
- Dependências: nenhuma
- Origem: B2-003 (B2); também reportado por: B1-004
- Ocorrências adicionais (mesmo problema, outros lugares):
  - B1-004 (S3): Foco não vai ao campo com erro nem ao campo do passo novo — onde: `pages/shared/Signup.tsx`, `ChangePassword.tsx`, `ChangeEmail.tsx`, `ChangeWhatsApp.tsx`

### AUD-148 — No desktop o valor "R$ 150" quebra em duas linhas no cartão "Diária que você ofereceu"

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/JobManage.tsx:127-141` (valor em `font-mono text-4xl` ao lado de um texto de até 11 rem dentro da coluna lateral de 22 rem, `:226`)
- Prova: 1280x800, `/vaga-gerenciar/BC-4998`: "R$" numa linha e "150" na de baixo, com o título "DIÁRIA QUE VOCÊ OFERECEU" também quebrado em duas linhas (`prints/B2/f15-d-gerenciar.png`). A 360 px o cartão é largo e não quebra.
- Impacto: o dinheiro da vaga parece estragado no computador; com R$ 1.200 ou mais fica pior.
- Causa raiz: `flex items-end justify-between` sem `whitespace-nowrap` e sem dar prioridade de largura ao valor.
- Correção recomendada: `whitespace-nowrap` no valor e o texto da direita passando para baixo (`flex-wrap`) na coluna estreita.
- Critério de aceite: print a 1280 px com R$ 150 e R$ 5.000 em uma linha só.
- Dependências: nenhuma
- Origem: B2-007 (B2); também reportado por: P1-008
- Ocorrências adicionais (mesmo problema, outros lugares):
  - P1-008 (S3): "Sua vaga": "R$ 150" quebra em duas linhas a 360 px — onde: `pages/recruiter/JobManage.tsx:129-140` (`font-mono text-4xl` ao lado de bloco `max-w-[11rem]`)

### AUD-164 — E-mail "Magic link" fala em excluir a conta, mas qualquer pessoa com a chave pública pode disparar para qualquer e-mail cadastrado

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (comportamento padrão do Supabase Auth; não testado ao vivo por falta de rede)
- Onde: `web/supabase/email-templates/link-de-acesso.html:36-41,95-96`; `web/scripts/configurar-auth.mjs:67-68`; `web/src/services/remote/auth.ts:162` (`signInWithOtp` no navegador)
- Prova: o template do tipo "Magic link" tem o texto fixo "Você pediu para excluir sua conta na Bicos" e assunto "Seu código de verificação da Bicos". O app usa esse e-mail só no passo de segurança da exclusão, mas o endpoint `/auth/v1/otp` é público (o app mesmo o chama do navegador com a chave anônima); sem o captcha do Auth ligado (só liga se `TURNSTILE_SECRET` for dado ao script, linhas 80-85), qualquer um pede o código para o e-mail de outra pessoa e ela recebe um aviso de exclusão que não pediu. `shouldCreateUser:false` ainda costuma devolver erro para e-mail inexistente nessa rota, o que também revela quem tem conta (hipótese a confirmar no painel).
- Impacto: pessoas assustadas com "excluir conta"; ruído para o suporte; possível enumeração de e-mails pelo Auth.
- Causa raiz: um template genérico do Auth reaproveitado para um caso específico.
- Correção recomendada: texto neutro ("Seu código de segurança da Bicos") sem citar exclusão; conferir no painel que o captcha do Auth está ligado em "Enviar OTP/magic link".
- Critério de aceite: o e-mail não menciona exclusão; chamada a `/auth/v1/otp` sem token do captcha devolve 400.
- Dependências: ação do responsável (captcha no Auth).
- Origem: D4-011 (D4)

### AUD-168 — A cidade do mural só aparece dentro da folha "Filtros"

- Área: UX
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (prints 10 e 12)
- Onde: `pages/worker/feed/MobileFeed.tsx:197-207` (logo, sino, busca); cidade só em `FeedSheets.tsx` ("Onde você quer trabalhar")
- Prova: print 10 sem cidade; print 12 mostra "São Paulo, SP — Escolher" só ao abrir Filtros; sem etiqueta quando é a cidade do perfil.
- Impacto: diante de "nenhuma vaga" (AUD-030) ou poucos bicos a pessoa não sabe onde está buscando.
- Causa raiz: a cidade padrão não é "filtro ativo", então fica invisível.
- Correção recomendada: linha "cidade" tocável sob a busca (como o endereço no topo do iFood).
- Critério de aceite: print do mural com a cidade visível e tocável.
- Dependências: nenhuma
- Origem: P1-012 (P1)

## Área: bug (22)

### AUD-086 — Fotos da vaga aceitam qualquer arquivo e qualquer tamanho, e cortam em 6 sem avisar

- Área: bug
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: ao publicar, `uploadMedia` comprime e falha com 'Não conseguimos abrir essa foto', então arquivo falso não sai na vaga; falta só o aviso no seletor. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado (reproduzido) para tipo e corte; provável para tamanho (não gerei arquivo gigante)
- Onde: `web/src/components/PhotoManager.tsx:39-48` (usado em `CreateJob.tsx:223` e `JobManage.tsx:230`); a validação existente está só em `web/src/utils/media.ts:28-41` (`portfolioFileProblem`, portfólio do trabalhador)
- Prova: `/criar-vaga`, `setInputFiles` com `nota.txt` e `falso.png` (texto): cada um vira um quadrado de foto quebrada ("Foto 2", "Foto 3") sem mensagem; `+7 pngs` sobre 3 fotos deixa 6 e descarta 4 sem aviso. Print `prints/B2/f4-fotos-m.png`.
- Impacto: o celular simples pode oferecer "todos os arquivos"; a vaga sai com foto quebrada na capa, ou o usuário acha que as 7 fotos foram enviadas.
- Causa raiz: `onChange(photos.concat(files.map(mediaUrl)).slice(0, max))` sem conferir `file.type`/`size` e sem toast quando corta.
- Correção recomendada: reaproveitar `portfolioFileProblem` (só imagem, até 10 MB) e mostrar toast "Só cabem 6 fotos" quando passar do limite.
- Critério de aceite: teste de componente com `.txt` (recusa com mensagem), imagem de 11 MB (recusa) e 7 imagens (toast).
- Dependências: nenhuma
- Origem: B2-002 (B2); também reportado por: B1-013
- Ocorrências adicionais (mesmo problema, outros lugares):
  - B1-013 (S3): Verificar identidade: arquivo que não é imagem é aceito como selfie sem aviso — onde: `pages/worker/VerifyIdentity.tsx:41-46` (só `URL.createObjectURL`); `services/remote/storage.ts:138-146`

### AUD-088 — "Trocar WhatsApp" manda o código sem conferir se o número já é de outra conta

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (a parte do demo foi reproduzida; a recusa do servidor só no fim vem do código e da migration)
- Onde: `web/src/pages/shared/ChangeWhatsApp.tsx:44-65` (vai direto a `sendWhatsAppCode`), contra `Signup.tsx:344-364` (que chama `isFreeForSignUp('whatsapp')` antes); índice único `accounts_whatsapp_key` em `supabase/migrations/20261020000100_u10_dados_unicos.sql:77`; demo sem checagem em `services/profiles.ts:151-164`
- Prova: no demo, `/whatsapp` como empresa com o número do trabalhador `(11) 9XXXX-XXXX` + código 123456 termina em "WhatsApp trocado e confirmado" (`out/B2/f13.cjs`). No cadastro o mesmo número da empresa dá "Esse WhatsApp já está em outra conta da Bicos".
- Impacto: com o Twilio ligado, o usuário recebe e digita o código de um número que não poderá usar e só descobre o conflito no fim (e gasta um envio de código); no demo a regra de número único some.
- Causa raiz: a checagem de número livre existe só no cadastro.
- Correção recomendada: chamar `isFreeForSignUp('whatsapp', phone)` antes de enviar o código e mostrar a mesma mensagem do cadastro; no demo, recusar número de outra conta em `changeWhatsApp`.
- Critério de aceite: teste de serviço (modo real com fake Supabase e modo demo) e print da mensagem na tela.
- Dependências: nenhuma
- Origem: B2-008 (B2)

### AUD-090 — "Minhas candidaturas", "Candidatos" e "Minhas vagas" só abrem se uma rotina que escreve (`conclude_my_finished_jobs`) der certo antes

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (`$SCRATCH/out/C1/repro/conclui-primeiro.test.ts`)
- Onde: `web/src/services/remote/data.ts:145-148` (`concludeMine`), chamada sem `catch` em `:307` (`loadMyApplications`), `:355` (`loadJobCandidates`), `:363` (`loadHistory`); expostas por `services/applications.ts:113-141`.
- Prova: com o RPC `conclude_my_finished_jobs` devolvendo erro, `loadMyApplications()` rejeita com `falha_demo: Não deu certo agora…` e **nenhuma** leitura da tabela `applications` chega a sair (`reads of applications table = 0`).
- Impacto: um soluço da rotina que conclui diárias (ou uma função ausente num ambiente, como a produção, que está 25 migrations atrás) tira do ar as três telas principais de acompanhamento, mesmo com os dados legíveis. A conclusão automática já roda de hora em hora (`bicos-concluir-diarias`), então a chamada é só um adiantamento.
- Causa raiz: efeito colateral tratado como pré-requisito da leitura.
- Correção recomendada: `await concludeMine().catch(() => undefined)` (ou só tentar uma vez por minuto e não esperar o resultado).
- Critério de aceite: o teste passa a mostrar `loadMyApplications -> ok` e uma leitura da tabela.
- Dependências: nenhuma.
- Origem: C1-004 (C1)

### AUD-094 — Posts do portfólio feitos no mesmo dia aparecem do mais antigo para o mais novo (comparador de ordenação inconsistente)

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: web/src/services/selectors.ts:155-157 (`postsForWorker`); supabaseMappers.ts:394 (`date: row.posted_on`, só o dia)
- Prova: `node -e` com 3 posts do mesmo dia na ordem do servidor (`c,b,a`, mais novo primeiro) e `.sort((a,b)=>(a.date<b.date?1:-1))` devolve `a,b,c,old`; com 12 posts do mesmo dia (`p12…p1`) devolve `p1,p2,…,p12`. O comparador devolve `-1` também quando as datas são iguais, e o V8 inverte os empatados. O servidor já manda `order by created_at desc` (remote/data.ts:436, remote/profiles.ts:102), mas a tela reordena só por dia.
- Impacto: o trabalhador publica um post novo e ele aparece no fim do grupo de hoje, não no topo.
- Causa raiz: comparador sem o caso de igualdade e data sem hora.
- Correção recomendada: não reordenar quando o dia é igual (`a.date === b.date ? 0 : …`) ou guardar `createdAt` completo no post e ordenar por ele.
- Critério de aceite: teste com 3 posts do mesmo dia mantém a ordem de entrada.
- Dependências: nenhuma.
- Origem: C2-011 (C2)

### AUD-098 — "Ver outros bicos" numa vaga encerrada vai ao login e volta para a mesma vaga

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/PublicJob.tsx:174`, `:104`, `:58-61`
- Prova: o ramo `!open` usa `onApply`, que é `enter('/login', card.job.id)` e grava `RETURN_TO='/vaga/BC-n'`; depois do login, `Login.tsx` faz `navigate(back || '/mural')` e cai na vaga fechada.
- Impacto: o botão que deveria levar a outros bicos leva de volta à vaga encerrada.
- Causa raiz: o ramo de vaga fechada reaproveita o fluxo de candidatura.
- Correção recomendada: no ramo `!open`, chamar `enter('/login')` sem `jobId`.
- Critério de aceite: depois do login o usuário chega em `/mural`.
- Dependências: nenhuma
- Origem: C3-005 (C3)

### AUD-099 — Legenda em edição sobrevive ao fechar o visualizador e vai para outro post

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/PostViewer.tsx:25,59,117,130`; `WorkerPosts.tsx:88`
- Prova: `editing` é `useState` do `PostViewer`, que fica sempre montado e só devolve `null` quando fechado; `go()` faz `setEditing(null)`, mas o botão Fechar e a tecla Esc não. Passos: abrir o post A, "Editar legenda", fechar, abrir o post B: o editor abre com a legenda de A e "Salvar" chama `updatePostCaption(B.id, <legenda de A>)`.
- Impacto: a legenda de um post pode sobrescrever a de outro sem a pessoa perceber.
- Causa raiz: estado de edição não é zerado ao fechar.
- Correção recomendada: `useEffect(() => { if (index === null) setEditing(null) }, [index])`.
- Critério de aceite: teste de tela: editar A, fechar, abrir B mostra a legenda de B sem editor aberto.
- Dependências: nenhuma
- Origem: C3-006 (C3)

### AUD-100 — "Publicar trabalho": o erro anterior reaparece ao reabrir a janela

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/WorkerPosts.tsx:89,194-211,266-267`
- Prova: `Composer` fica sempre montado; `fileError` (`useState`) e `publish.error` (`useAction`) vivem nele; `closeAndReset` (l.195) limpa só o `ui`. Escolher um vídeo grande demais, fechar e reabrir mostra a janela vazia com o erro vermelho antigo.
- Impacto: confusão ao reabrir a janela.
- Causa raiz: reset incompleto.
- Correção recomendada: no `closeAndReset`, `setFileError(null); publish.reset()`.
- Critério de aceite: reabrir a janela não mostra erro antigo.
- Dependências: nenhuma
- Origem: C3-007 (C3)

### AUD-102 — Trocar WhatsApp: com captcha ligado, "Reenviar código" falha (latente)

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (captcha e código de WhatsApp estão desligados hoje)
- Onde: `pages/shared/ChangeWhatsApp.tsx:141` (widget só no passo `numero`) e `:87-98` (`resend` no passo `codigo`); `components/Captcha.tsx:82-86` (`getToken` devolve `undefined` sem widget); `supabase/functions/codigo-whatsapp/index.ts:63` (`captchaOk`)
- Prova: ao passar para `codigo` o widget desmonta e `getToken()` volta `undefined`; a função recusa com `captcha` quando a chave existe. Signup, Login e DeleteAccount deixam o widget sempre montado no rodapé.
- Impacto: quando o Turnstile for ligado, o reenvio do código para trocar o WhatsApp quebra.
- Causa raiz: o widget só existe num dos passos.
- Correção recomendada: mover `{captcha.widget}` para o rodapé fixo.
- Critério de aceite: com captcha ligado, reenviar código funciona.
- Dependências: ação do responsável (ligar Turnstile e Twilio) torna o problema real
- Origem: C3-010 (C3)

### AUD-104 — "Desfazer" remoção de experiência apaga o que foi adicionado depois

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/ExperiencesField.tsx:60-68`
- Prova: `onChange(before)` substitui a lista inteira. Remover X, adicionar Y e tocar em "Desfazer" faz Y sumir.
- Impacto: perda do que a pessoa acabou de digitar.
- Causa raiz: desfazer restaura o estado anterior inteiro.
- Correção recomendada: reinserir só o item removido, na posição original.
- Critério de aceite: teste de tela do cenário acima.
- Dependências: nenhuma
- Origem: C3-015 (C3)

### AUD-107 — Busca do mural mostra só a primeira página (30), sem "Carregar mais"

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/MobileFeed.tsx:39-53`, `DesktopFeed.tsx:69-80,101-120`, `FeedSheets.tsx:105`
- Prova: não têm `<LoadMore>`; só o ramo de navegação tem. "N vagas encontradas" e "Ver N vagas" contam só as carregadas.
- Impacto: sem efeito com poucas vagas hoje; com mais de 30 resultados o resto fica inalcançável.
- Causa raiz: paginação só em um dos ramos.
- Correção recomendada: incluir `LoadMore` e usar "30+".
- Critério de aceite: busca com 31 resultados mostra "Carregar mais".
- Dependências: nenhuma
- Origem: C4-005 (C4)

### AUD-108 — Recarregar "Vaga publicada" mostra "vaga não encontrada"

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/JobPublished.tsx:15-17`
- Prova: lê só o store e não chama `loadJob`.
- Impacto: a empresa acha que a vaga não foi criada e pode publicar de novo (ver AUD-027).
- Causa raiz: a tela depende de dado em memória.
- Correção recomendada: chamar `loadJob(id)` na montagem.
- Critério de aceite: recarregar `/vaga-publicada/:id` mostra a vaga.
- Dependências: AUD-027
- Origem: C4-008 (C4)

### AUD-114 — O GPS do `CityPicker` pode trocar a cidade depois de a folha ser fechada; a lista usa `listbox`/`option` sem setas

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `components/CityPicker.tsx`
- Prova: leitura.
- Impacto: cidade muda sozinha; teclado sem setas.
- Causa raiz: resposta atrasada aplicada depois do fechamento.
- Correção recomendada: cancelar ao fechar; implementar setas.
- Critério de aceite: teste de cancelamento.
- Dependências: nenhuma
- Origem: C5-013 (C5)

### AUD-115 — Nenhum `img` tem `onError`; o track do carrossel tem `aria-roledescription` sem `role`

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `components/Avatar.tsx`, `JobCover.tsx`, `PhotoCarousel.tsx`
- Prova: leitura.
- Impacto: avatar e foto quebrados ficam vazios; atributo ARIA inválido.
- Causa raiz: sem fallback de imagem.
- Correção recomendada: `onError` com iniciais/ícone; corrigir ARIA.
- Critério de aceite: imagem quebrada mostra o fallback.
- Dependências: nenhuma
- Origem: C5-014 (C5)

### AUD-117 — Denúncias: alvo livre e denúncia analisada reaberta pelo denunciante

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261013000400_f04_denuncia_bloqueio.sql:51` (`report_content`: `p_target_id` sem formato/tamanho/existência; `on conflict … status='aberta'`)
- Prova: `report_content('perfil', repeat('x',100000), …)` aceito; denúncia `analisada/arquivar` volta a `aberta` ao denunciar de novo.
- Impacto: lixo na fila da equipe e fila reaberta à vontade.
- Causa raiz: sem validação do alvo e `on conflict` reabre.
- Correção recomendada: `char_length(p_target_id) ≤ 64` e alvo existente; reabrir só após 30 dias ou com motivo novo.
- Critério de aceite: testes SQL dos dois casos.
- Dependências: nenhuma
- Origem: D2-013 (D2); também reportado por: D3b-008
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3b-008 (S3): `report_content` aceita `target_id` ilimitado e de alvo inexistente — onde: `migrations/20261013000400_f04_denuncia_bloqueio.sql:12-22,51-72`

### AUD-118 — Aviso "Bico novo" mostra o valor com vírgula americana: R$ 1.500 sai "R$ 1,500"

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261011000700_y28_alerta_bico.sql:66` e `migrations/20261019000100_u01_vaga_simples.sql:149` (versão final): `to_char(new.pay,'FM999G999')`
- Prova: staging `to_char(1200,'FM999G999')` = `1,200`; `lc_numeric` = en_US.UTF-8. A diária vai até R$ 5.000 (W08). O teste y28 não confere o texto.
- Impacto: o trabalhador lê R$ 1,500 (um real e meio) na notificação e no push, em diárias de R$ 1.000 ou mais.
- Causa raiz: o formato de número depende do locale do servidor.
- Correção recomendada: `replace(to_char(...), ',', '.')`.
- Critério de aceite: teste com pay=1500 e `body like '%R$ 1.500%'`.
- Dependências: nenhuma
- Origem: D3a-003 (D3a)

### AUD-122 — Limites de localização diferentes entre as funções: quem mora em Fernando de Noronha não consegue cadastrar o endereço; UF e cidade da empresa não são conferidas

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (lista de cidades do app + CHECK no staging)
- Onde: longitude máxima `-34` em `20261021000600_u51_endereco.sql:22,74` (`addresses_lon_check`, `save_address`) e em `finish_sign_up` (`20261020000200_u12…:30`, `u51:136`, `u62:30`, `u67:28`); longitude máxima `-28` em `job_from_draft` (`u01:61`, `u48:291`, `u52:93`); `u67:36` (`v_city !~ ', [A-Z]{2}$'`)
- Prova: `web/src/data/cidades.ts` tem 5.571 cidades; a única fora de `lon <= -34` é "Fernando de Noronha, PE (-3,84; -32,41)". No staging `pg_constraint`: `addresses_lon_check = CHECK (lon >= -74 AND lon <= -34)`. Para essa cidade a vaga é aceita (`-28`), mas o trabalhador recebe "Não achamos esse endereço no mapa" em `save_address` e não completa o perfil. Em `finish_sign_up` da empresa (U67) basta o texto terminar em ", XX": "abc, ZZ" é gravado em `companies.location`, enquanto `save_address` confere os 27 UFs.
- Impacto: cerca de 3 mil moradores da ilha não conseguem se cadastrar como trabalhador; o mural da empresa pode abrir numa "cidade" que não existe (o app cai na cidade padrão, sem quebrar).
- Causa raiz: o mesmo limite (caixa do Brasil) foi copiado em cinco lugares com valores diferentes, e a cidade da empresa é texto livre com só o final conferido.
- Correção recomendada: uma função `public.in_brazil(lat, lon)` (`lon <= -28`) usada por `save_address`, `finish_sign_up`, `job_from_draft` e pelo CHECK de `addresses`; em `finish_sign_up`, conferir o UF contra a mesma lista de 27 siglas.
- Critério de aceite: teste SQL que grava endereço em Noronha (-3.85, -32.42) e recusa "abc, ZZ".
- Dependências: nenhuma.
- Origem: D3c-005 (D3c)

### AUD-127 — "Hoje", "vaga vencida" e "diária começou" usam a data do aparelho; o servidor usa Brasília

- Área: bug
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: Brasília não tem horário de verão e o dano só existe com relógio/fuso errado do aparelho. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado na demonstração com relógio emulado; provável em produção (confirma M1-H6)
- Onde: `src/utils/dates.ts:11-16` (`todayISO`); `src/utils/jobInfo.ts:231-234` (`isExpired`); `src/pages/worker/feed/Feed.tsx:68` (o mural esconde "vencidas" por conta própria); `src/services/applications.ts:186-188` (`jobStarted`); `src/pages/recruiter/CandidateActions.tsx:146`; no servidor, `supabase/migrations/20261009000200_bicos_v2_rules.sql:105` (`bicos_today()` = `America/Sao_Paulo`)
- Prova: `clock.cjs`: mesma lista de vagas (carregada às 12h de 19/10), só o relógio muda depois: certo → 26 vagas ("Hoje · 7h–17h"); +1 dia → 21; +3 dias → 19; −7 dias e 01/01/2020 → 26, mas com rótulos errados ("Seg, 19 out de 2026"). No instante 01:30 UTC (22:30 em Brasília de 19/10), `todayISO` dá `2026-10-19` com `TZ=America/Sao_Paulo` e `2026-10-20` com `TZ=UTC` ou `Asia/Tokyo`.
- Impacto: quem tem hora ou fuso errado vê vagas sumirem do mural ou com rótulo trocado. A empresa vê (ou deixa de ver) "Marcar diária como concluída" no dia errado, enquanto o servidor decide por Brasília. É o mesmo erro do O2-001, do lado do produto.
- Causa raiz: duas fontes de "hoje": o aparelho e `bicos_today()`.
- Correção recomendada: um único "hoje" no cliente = data de Brasília (`Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'})`), de preferência corrigida pelo cabeçalho `Date` do servidor.
- Critério de aceite: `TZ=UTC` e `TZ=Asia/Tokyo` às 22:30 de Brasília dão o mesmo `todayISO` que `America/Sao_Paulo`.
- Dependências: O2-001
- Origem: Q1-005 (Q1); também reportado por: O2-001
- Ocorrências adicionais (mesmo problema, outros lugares):
  - O2-001 (S2): 5 testes de candidatura falham entre 21h e 23h59 no horário de Brasília (e o dia todo em fusos à frente de UTC) — onde: `web/src/__tests__/applications.test.ts:96` (`expire`), `:239` (Y01), `:254` (Y04), `:269` (Y07), `:305` (hire/conclude)

### AUD-128 — Favicon e ícone da tela inicial quebram em rotas com mais de um segmento (`/v/:id`, o link compartilhado)

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/index.html:27-29` (`href="./icons/…"`)
- Prova: `icons.cjs`. Em `/mural` o ícone resolve para `/icons/favicon-32.png`. Em `/v/BC-4821` resolve para `/v/icons/favicon-32.png`, `/v/icons/icon.svg` e `/v/icons/apple-touch-icon.png`. O host devolve HTML 200 para qualquer caminho.
- Impacto: quem abre a vaga pelo WhatsApp fica sem ícone na aba. Adicionar à tela inicial dali no iPhone gera ícone genérico.
- Causa raiz: caminho relativo no `<head>`.
- Correção recomendada: `href="/icons/…"`, ou `%BASE_URL%icons/…`.
- Critério de aceite: `icons.cjs` mostra `/icons/…` em todas as rotas.
- Dependências: nenhuma
- Origem: Q1-008 (Q1)

### AUD-130 — Falha de rede ao chamar uma Edge Function (com o aparelho "online") não vira `offline`: a pessoa vê "Não deu certo agora"

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: web/src/services/remote/client.ts:41-45 (`isNetworkFailure`) e :138-161 (`invokeFunction`)
- Prova: `repro-edge-function-offline.test.ts` (nesta pasta): `functions.invoke` devolve o erro que o supabase-js dá quando o `fetch` cai — `name: 'FunctionsFetchError'`, `message: 'Failed to send a request to the Edge Function'` (node_modules/@supabase/functions-js/dist/main/types.js:43). A regex `/Failed to fetch|NetworkError|Load failed|fetch failed|AuthRetryableFetchError|network/i` não casa com isso. Saída: `RESULT code= falha_demo message= Não deu certo agora. Tente de novo em instantes.` e a asserção `expected 'falha_demo' to be 'offline'` falha. Só cai em `offline` se `navigator.onLine === false`, o que não acontece com sinal fraco ("lie-fi").
- Impacto: login por CPF/CNPJ, verificação de cadastro, código de WhatsApp, cobrança e exclusão de conta mostram a mensagem genérica em vez de "Sem internet. Confira sua conexão…", e as telas que reagem a `isOfflineError` (estado "offline" com botão de tentar de novo) não aparecem.
- Causa raiz: a detecção é por texto da mensagem e não conhece os erros próprios do functions-js.
- Correção recomendada: em `invokeFunction`, tratar `result.error.name === 'FunctionsFetchError'` (e `FunctionsRelayError`) como `offline`; ou incluir `FunctionsFetchError` na regex.
- Critério de aceite: o teste de reprodução passa (`code === 'offline'`).
- Dependências: nenhuma.
- Origem: C2-009 (C2); também reportado por: C2-013
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C2-013 (S3): "Sem conexão com a Bicos… o app abre sozinho" é falso quando o aparelho está online e o servidor só demorou (>10 s) — onde: web/src/services/remote/session.ts:528-534 (`withTimeout(enterSession(user), 10000)` → `goOffline()`) e :541-550; web/src/App.tsx:119-130 (texto "Assim que a internet voltar, o app abre sozinho.")

### AUD-131 — Se o download do supabase-js falhar uma vez, `getSupabase()` guarda a promessa rejeitada e o app não se recupera sem recarregar

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: web/src/services/supabase.ts:30-49; web/src/main.tsx:33-38; web/src/App.tsx:122-130; web/src/components/ErrorBoundary.tsx:20-31
- Prova: `client = config ? import('@supabase/supabase-js').then(...) : …` fica em cache mesmo rejeitada; todo `db()` seguinte devolve a mesma rejeição. Em `main.tsx` a falha vira `setBootStatus('offline')`; "Tentar de novo" chama `retryStart()` → `restore()` → `await db()` → rejeita de novo, fora do `try` (session.ts:482), sem mudar estado. A única saída automática é `vite:preloadError` → `reloadOnceForNewVersion`, no máximo 1 vez por minuto (ErrorBoundary.tsx:26). O chunk (`index-DaueY-7D.js`, 224 KB) é baixado só na primeira visita; depois fica no cache do service worker.
- Impacto: na primeira visita, com sinal fraco, dois erros de download seguidos deixam a tela "Sem conexão" com um botão que nunca funciona.
- Causa raiz: promessa de inicialização preguiçosa sem limpar em caso de erro (o `firebase.ts:35-37` faz certo).
- Correção recomendada: `client = undefined` no `.catch` de `getSupabase`.
- Critério de aceite: teste: `import()` falha na 1ª chamada e funciona na 2ª; a 2ª chamada de `getSupabase()` resolve.
- Dependências: nenhuma.
- Origem: C2-017 (C2)

### AUD-141 — Nenhuma chamada a provedor externo tem prazo máximo; o app também não corta a espera

- Área: bug
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: `fetch` sem prazo confirmado, mas a plataforma encerra com 504 e o app não gira 'para sempre'. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `fetch` sem `AbortSignal` em `_shared/captcha.ts:23` (Turnstile), `_shared/mercadopago.ts:31`, `_shared/firebase.ts:40` (JWKS), `_shared/monitoring.ts:27` (Sentry, e é `await`ado antes de devolver o 500), `codigo-whatsapp/index.ts:27`, `verificar-cnpj/index.ts:48`; cliente: `web/src/services/remote/client.ts:142` (`functions.invoke` sem `timeout`)
- Prova: `grep -rn "AbortSignal\|timeout\|AbortController" web/supabase/functions` não devolve nada; no cliente, `invokeFunction` não passa prazo. Com o provedor lento (ou o Sentry fora), a função só termina no limite da plataforma e o botão fica girando — o que o CLAUDE.md §6 proíbe.
- Impacto: uma lentidão do Turnstile trava login e cadastro; do Twilio, o passo do código; do Sentry, qualquer resposta de erro.
- Causa raiz: nenhum padrão de prazo nas chamadas de saída.
- Correção recomendada: `AbortSignal.timeout(8000)` em cada `fetch` das funções (captcha e Twilio com falha fechada; BrasilAPI → `pendente`; Sentry → desiste em 2 s sem bloquear a resposta) e `timeout` no `invoke` do cliente com mensagem de "sem sinal".
- Critério de aceite: teste com provedor que não responde: a função devolve em até 10 s com o erro tratado.
- Dependências: nenhuma.
- Origem: D4-007 (D4); também reportado por: C5-003, C5-015
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C5-003 (S2): `QueryView`/`runQuery` sem prazo: pedido travado deixa o esqueleto para sempre — onde: `services/queries.ts:63-79`; `components/QueryView.tsx`
  - C5-015 (S3): O cartão Mercado Pago não tem prazo para o SDK e não manda o erro ao Sentry — onde: `components/MercadoPagoCardForm.tsx`

### AUD-142 — O avisador de erros usa `crypto.randomUUID()` sem proteção: em navegador antigo ele próprio dá erro e nada chega ao Sentry

- Área: bug
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (confirma C2-H5)
- Onde: `src/services/monitoring.ts:124` (`event_id`); chamado por `reportError` (`:143`), `window.onerror` (`:161`) e `src/components/ErrorBoundary.tsx:57`; `vite.config.ts:156` (`target:'es2020'`)
- Prova: `sentry.cjs` com o build `dist-c2` (DSN configurado). Com `crypto.randomUUID` presente: 1 pedido ao Sentry. Ausente (Safari < 15.4, WebView Chrome < 92): 0 pedidos e `TypeError: crypto.randomUUID is not a function` ×2.
- Impacto: nos aparelhos mais velhos, onde mais se esperam erros, a equipe fica cega.
- Causa raiz: `es2020` promete Chrome 80/Safari 13.1, mas a API só existe desde Chrome 92/Safari 15.4.
- Correção recomendada: `crypto.randomUUID?.() ?? <hex de getRandomValues>` e `try/catch` em `reportError`.
- Critério de aceite: o mesmo script mostra 1 pedido com `randomUUID` ausente.
- Dependências: AUD-195
- Origem: Q1-012 (Q1)

## Área: LGPD (19)

### AUD-057 — Status da verificação de identidade (`recusado`, `em_analise`) legível por qualquer conta logada

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (grant e política no catálogo)
- Onde: `web/supabase/migrations/20261013000700_f07_identidade.sql:106` (`grant select (identity_status) on public.workers to authenticated`); política `workers` `using (true)`; também `companies.verification_status` e, nas denúncias, `reports.resolved_by`/`resolution` (só para quem denunciou)
- Prova: `has_column_privilege('authenticated','public.workers','identity_status','select')` = true; a política de `workers` não filtra linhas; valores permitidos: `nao_enviado | em_analise | verificado | recusado`. O motivo (`identity_reason`) está fechado.
- Impacto: qualquer conta logada descobre quem enviou documento para análise e quem foi recusado, por consulta direta, embora a tela só mostre o selo "verificado". `reports.resolved_by` mostra ao denunciante o id de quem da equipe tratou a denúncia (o id é o mesmo do perfil público dessa pessoa).
- Causa raiz: o grant foi dado à coluna inteira; a tela só precisa de `verified`.
- Correção recomendada: tirar `identity_status` do `select` de `authenticated` (o dono já lê por `my_identity()`), e `resolved_by`/`resolution` do `select` de `reports`.
- Critério de aceite: `select identity_status from workers` falha com 42501 para outra conta; a tela do perfil e a do dono continuam funcionando.
- Dependências: conferir `src/services/remote/merge.ts:25`, que hoje pede `identity_status` na lista pública.
- Origem: D1-008 (D1)

### AUD-060 — O servidor aceita qualquer "versão" de termos e de consentimento

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261015000200_lanc07_aceites.sql:98` (`accept_terms`) e `:120` (`submit_identity`); `create_account_for` (terms_version do metadata, até vazia)
- Prova: `accept_terms('99.9')` grava `terms_version=99.9` e linhas em `terms_acceptances`.
- Impacto: a prova de aceite depende do cliente.
- Causa raiz: a versão vigente não existe no servidor.
- Correção recomendada: versão vigente em `app_config` e exigir igualdade.
- Critério de aceite: `accept_terms('99.9')` → BC422.
- Dependências: nenhuma
- Origem: D2-010 (D2); também reportado por: D3b-009
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3b-009 (S3): Consentimento é o que o aparelho disser: `submit_identity`/`accept_terms` aceitam qualquer versão e caminho — onde: `migrations/20261015000200_lanc07_aceites.sql:98-147`

### AUD-064 — Link público: IP guardado como sha256(ip|data) sem segredo, limite burlável por IPv6, uma escrita por visita anônima, política não cita

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (código); IPv6 provável
- Onde: `migrations/20261016000200_lanc10_link_publico.sql:57-67`; `web/src/services/legal.ts:121,156`
- Prova: o slug de 12×31 (~59 bits) não é enumerável, então o limite é só defesa extra; o hash do IP sem segredo é reversível por força bruta (espaço de IPv4 pequeno).
- Impacto: dado pessoal (IP) tratado sem estar na política; o limite de 60/10 min é fácil de contornar com IPv6.
- Causa raiz: hash sem segredo e sem agrupar IPv6.
- Correção recomendada: HMAC com segredo do Vault, agrupar IPv6 por /64, citar na política.
- Critério de aceite: política cita o tratamento; o hash muda com o segredo.
- Dependências: texto jurídico (ação do responsável)
- Origem: D3b-007 (D3b)

### AUD-069 — Pagamentos: a Política diz que guarda "por obrigação fiscal", mas excluir a conta apaga `boost_payments` na hora; o prazo está em branco

- Área: LGPD
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: U24 (2) escolhe apagar os pagamentos porque o comprovante fica no Mercado Pago; o conflito é com o texto da Política, a resolver na revisão jurídica. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:155,157` (`Pagamentos: {{PRAZO_PAGAMENTOS}}, por obrigação fiscal`), `web/docs/LGPD.md:33` (base art. 7, II, "5 anos?"), `web/supabase/migrations/20261020000300_u24_exclusao_completa.sql` (`delete from public.companies` → `boost_payments_company_id_fkey ON DELETE CASCADE`), `web/docs/DECISOES.md` U24 ponto (2)
- Prova: FK `boost_payments.company_id → companies ON DELETE CASCADE` e `boost_payments.job_id → jobs ON DELETE CASCADE` (consulta a `pg_constraint` no staging); `anonymize_account` apaga `jobs` e `companies` da empresa. A decisão U24 documenta que "o comprovante fiscal fica no Mercado Pago". A Política, porém, anuncia que a Bicos guarda o registro do pagamento pelo prazo fiscal. Duas coisas não podem ser verdade ao mesmo tempo. `payment_webhook_events` (id do evento e do pagamento no Mercado Pago) não tem expurgo nem dono e fica depois da exclusão.
- Impacto: ou a empresa não consegue provar a receita do impulso em fiscalização (se a obrigação existe), ou a Política diz que retém o que apaga. Em qualquer caso o texto está errado.
- Causa raiz: a regra de exclusão total (pedido do responsável, U24) e o mapa da LGPD (L07) foram escritos em momentos diferentes.
- Correção recomendada: o contador responde se a Bicos tem de guardar o registro de cada cobrança (valor, data, id do Mercado Pago, CNPJ/CPF do pagador); se sim, manter uma tabela mínima `payments_ledger` sem vaga nem nome, com prazo fiscal, fora da cascata, e declarar; se não, trocar o texto por "o comprovante fica com o Mercado Pago".
- Critério de aceite: Política e banco dizem a mesma coisa; teste SQL de exclusão conferindo o que sobra de pagamento.
- Dependências: ação do responsável (contador/advogado).
- Origem: D5-009 (D5)

### AUD-070 — Histórico sem prazo de apagamento: decisões da equipe (`staff_actions`), denúncias resolvidas, avisos e eventos de pagamento ficam para sempre; as decisões da equipe sobrevivem à exclusão

- Área: LGPD
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:157` (`{{PRAZO_AUDITORIA}}`), `web/docs/LGPD.md:32`, `web/supabase/migrations/20261015000100_lanc06_backoffice.sql:58` (`staff_log` grava `target_id` e `reason` livres), cron `bicos-*` (nenhum expurga essas tabelas)
- Prova: `select cron.job` no staging: 7 jobs, nenhum limpa `staff_actions`, `reports`, `notifications`, `application_events`, `payment_webhook_events`, `cron_alerts`. `anonymize_account` não toca em `staff_actions` (só a FK `staff_id` vira NULL ao sair um membro da equipe): depois que a pessoa exclui a conta, ficam linhas com o uuid dela e o motivo escrito pela equipe (campo livre, pode ter nome ou fato). Staging: `staff_actions` = 265 linhas (todas de teste: suspender/reativar/aprovar).
- Impacto: dado pessoal sem prazo de guarda (art. 6, III e art. 15–16); a Política diz "apagamos na hora" mas isso não vale para o registro da equipe.
- Causa raiz: auditoria foi pensada como "para sempre"; nunca se definiu o prazo.
- Correção recomendada: definir com o advogado (sugestão: 5 anos para `staff_actions` por defesa em processo, art. 7, VI; 1 ano para denúncias resolvidas; avisos lidos há mais de 1 ano) e criar cron de expurgo; no texto da exclusão, dizer que o registro de moderação fica pelo prazo X; pedir à equipe para não escrever dado pessoal no motivo (placeholder/validação).
- Critério de aceite: cron de expurgo no staging; Política com prazos; teste SQL.
- Dependências: ação do responsável (advogado).
- Origem: D5-010 (D5)
- Revisão adversária: Cético B: parcialmente decisão aberta da empresa e do advogado (X30; `LEGAL_REVIEWED=false`), não omissão do código.

### AUD-071 — Retirar o consentimento da selfie/documento não tem caminho no app nem ferramenta da equipe; a Política promete "a qualquer momento"

- Área: LGPD
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: a Política dá o canal (Ajuda/e-mail) e a LGPD pede procedimento facilitado, não botão; falta ferramenta de equipe e documentação. Rebaixado para S3.
- Esforço: M
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:130,197-202` (`IDENTITY_CONSENT.points`: "pela Ajuda ou pelo e-mail de privacidade"), `web/src/pages/shared/Help.tsx` (sem pergunta sobre selfie/consentimento), `web/src/pages/shared/Privacy.tsx` (só exportar e excluir), RPCs de equipe (`admin_decide_identity`, `admin_identity_queue`, `set_identity_status`: nenhuma apaga as fotos ou o selo a pedido)
- Prova: `grep -rn "withdraw_identity\|retirar_consent\|revoke_consent" web/supabase/migrations web/src` = vazio; lista de funções do `public` no staging não tem nenhuma de retirada. O único caminho é escrever ao suporte, e a equipe teria de apagar os arquivos à mão no painel do Storage e rodar SQL para tirar o selo (sem trilha em `staff_actions`, porque o painel não passa por `staff_log`). O art. 8, §5 pede procedimento gratuito e facilitado, e o art. 18, IX permite revogar a qualquer tempo.
- Impacto: quem se arrepende de ter mandado a foto do rosto e do documento não tem botão; depende de alguém lembrar de apagar.
- Causa raiz: o consentimento foi implementado (L07) só na entrada.
- Correção recomendada: botão "Retirar minha selfie e meu documento" em Configurações › Privacidade e dados (visível se há envio), que chama um RPC `withdraw_identity()`: apaga as linhas e os arquivos (ver AUD-001), tira o selo e grava o motivo. Mostrar o e-mail do encarregado nessa tela.
- Critério de aceite: teste SQL e e2e: enviar, retirar, conferir `storage.objects`, `identity_submissions` e `workers.identity_status`.
- Dependências: AUD-001.
- Origem: D5-011 (D5)

### AUD-072 — O gatilho do app antigo continua copiando nome e e-mail de cada cadastro novo para `profiles`; as 7 tabelas antigas seguem guardadas sem uso, fora da Política e da exportação

- Área: LGPD
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: já tratado em `LGPD.md:60-62` e `pendentes/LEIA.md` ('só com o pode'); confirmado no staging (gatilho ativo; `profiles` com 12 linhas). Rebaixado para S3 / ação do responsável.
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/legado/000_baseline.sql:356,395` (`criar_perfil_ao_cadastrar`, gatilho `on_auth_user_created`), `web/supabase/pendentes/20261015000900_lanc07_apagar_app_antigo.sql` (não aplicado), `web/docs/LGPD.md:40,60-62`, `web/supabase/migrations/…` (funções `document_login_email`, `signup_taken` ainda consultam `profiles`)
- Prova: staging: `information_schema.triggers` lista `on_auth_user_created … EXECUTE FUNCTION criar_perfil_ao_cadastrar()`; `profiles` tem 12 linhas, igual a `auth.users` (12): cada conta nova duplica nome e e-mail. Produção: `profiles` = 4 linhas, 3 com `documento_cifrado`, 1 com WhatsApp, 1 com foto; `vagas` = 3, `consentimentos` = 2; tabelas fechadas por RLS sem política (nada sai pela API) e as RPCs antigas não são executáveis por `authenticated` (testado com `has_function_privilege`), então não há vazamento — o problema é guarda sem finalidade. A Política não menciona essas tabelas, a exportação não as traz, e `docs/LGPD.md` já reconhece "dado duplicado sem finalidade".
- Impacto: dados pessoais (inclusive CPF cifrado de 3 contas reais) guardados depois que a finalidade acabou (art. 15, I e art. 16): se alguém pedir acesso, não está na exportação; se pedir exclusão, a cascata de `auth.users` apaga, mas a existência dessas cópias não é informada.
- Causa raiz: o apagamento do app antigo ficou em `pendentes/` à espera de "pode" e backup (`scripts/exportar-app-antigo.sh`).
- Correção recomendada: decidir (sócios) e executar o `pendentes/…_lanc07_apagar_app_antigo.sql` em staging e depois em produção (com backup antes, como manda CLAUDE.md §9); até lá, tirar o gatilho (`drop trigger on_auth_user_created`) para parar de copiar dados novos.
- Critério de aceite: `select count(*) from information_schema.tables where table_name in ('profiles','vagas','candidaturas','avaliacoes','vagas_salvas','publicacoes_trabalhador','consentimentos')` = 0; cadastro novo não cria linha antiga.
- Dependências: ação do responsável ("pode" e backup). Hipótese ligada: base legal e prazo para continuar guardando (nenhum).
- Origem: D5-012 (D5)

### AUD-073 — Transferência internacional sem base declarada: 6 operadores listados fora do Brasil (e pelo menos 4 não citados) e nenhuma prova de contrato com cláusulas-padrão da ANPD

- Área: LGPD
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: em parte duplicata de AUD-016/AUD-017/AUD-014; resíduo: incluir Google/Mercado Pago/OSM na lista de operadores e o DPA. Rebaixado para S3.
- Esforço: M
- Confiança: confirmado (texto); contratos não verificáveis
- Onde: `web/src/services/legal.ts:147-148` (`{{BASE_TRANSFERENCIA_INTERNACIONAL}}`), `web/docs/LGPD.md:42-56` (tabela de operadores e "conferir com o advogado")
- Prova: a Política lista Supabase (empresa nos EUA), Cloudflare (mundial), Twilio (EUA), Sentry (EUA), Brevo (França), Google (EUA) e diz "A transferência segue o art. 33 da LGPD ({{BASE…}})" — campo em branco. Ficam de fora da lista, mas recebem dado do usuário: Firebase/Google reCAPTCHA (AUD-017), OpenStreetMap tiles/OSRM (AUD-014; Alemanha/Reino Unido), GitHub Pages (hospeda o site de teste; EUA). A Resolução CD/ANPD nº 19/2024 exige que a transferência use cláusulas-padrão (ou outra hipótese do art. 33) e que o contrato com cada operador as inclua; não há no repositório contrato, DPA nem registro de aceite deles (`grep -riE "\bdpa\b|cláusulas" web/docs` acha só a nota do `LGPD.md:55` e o item pendente `web/docs/CHECKLIST-LANCAMENTO.md:49` "Assinar os termos de tratamento (DPA) com Supabase, Cloudflare, Twilio, Sentry, Brevo" — sem Google/Firebase, Mercado Pago, OpenStreetMap).
- Impacto: toda coleta de dado pessoal passa por operador estrangeiro sem base legal de transferência declarada; fiscalização da ANPD pode exigir.
- Causa raiz: depende do advogado e da assinatura dos DPAs com os provedores (todos oferecem DPA/SCC online).
- Correção recomendada: aceitar os DPAs/SCCs de Supabase, Cloudflare, Twilio, Sentry, Brevo, Google (Firebase), Mercado Pago; registrar data e versão em `web/docs/LGPD.md`; preencher o campo da Política com a hipótese (cláusulas-padrão, art. 33, II, "b"/Res. 19/2024) e listar os operadores que faltam.
- Critério de aceite: tabela de operadores no `docs/LGPD.md` com coluna "DPA aceito em"; Política sem campo em branco.
- Dependências: ação do responsável (advogado, contas nos provedores). AUD-016.
- Origem: D5-013 (D5)

### AUD-074 — Relatórios de erro (Sentry): a Política diz "sem dados pessoais", mas o mapa interno admite IP; a retenção de 30 dias e a opção de não guardar IP não estão comprovadas

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `web/src/services/legal.ts:30,147,157` ("relatórios de erro sem nome, e-mail, documento ou telefone"; "Relatórios de erro: 30 dias"), `web/docs/LGPD.md:36,50` ("erro sem dado pessoal (pode haver IP)"), `web/src/services/monitoring.ts` (envia direto ao endpoint `store`, com limpeza de e-mail, CPF/CNPJ, telefone, uuid, token), `web/supabase/functions/_shared/monitoring.ts`
- Prova: o código do front e das funções limpa bem o texto (regexes testados), mas quem recebe a requisição HTTP no Sentry vê o IP do navegador; o Sentry guarda esse IP por padrão em eventos recebidos pelo `store` sem `user.ip_address` explícito, a menos que o projeto tenha "Prevent Storing of IP Addresses" ligado — o repositório não documenta que isso foi feito (`grep -ri "ip address\|Prevent Storing" web/docs` = vazio). A retenção do Sentry também depende do plano, não do código.
- Impacto: pequena, mas o texto afirma mais do que o sistema garante.
- Causa raiz: configuração externa não documentada.
- Correção recomendada: ligar "Prevent Storing of IP Addresses" (e "Data Scrubber") no projeto Sentry, registrar a retenção real em `docs/SUPABASE.md` e dizer na Política "pode registrar o endereço IP, que apagamos em 30 dias".
- Critério de aceite: print/nota da configuração do Sentry em `docs/`; Política igual ao mapa.
- Dependências: ação do responsável (acesso ao Sentry).
- Origem: D5-014 (D5)

### AUD-075 — Coleta que a Política não descreve ou descreve só em parte

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: lista abaixo
- Prova: 1. `public_link_hits.ip_hash` (hash de IP + data de quem abre o link público de vaga, mesmo sem conta; 1 dia): `20261016000200_lanc10_link_publico.sql:37-60`; a seção 2 só cita IP "nas tentativas de login". Falta em `docs/LGPD.md`. 2. `auth_attempts.key` guarda **o número de telefone** (`zap:<fone>`, `zap-conferir:<fone>`) e o IP (`ip:`, `zap-ip:`, `firebase-ip:`, `cadastro-ip:`) em claro, e hashes de CPF/e-mail/telefone (`doc:`, `cadastro:`) — `entrar-com-documento/index.ts:44-45`, `codigo-whatsapp/index.ts:57-64`, `verificar-cadastro/index.ts:56-68`, `entrar-com-firebase/index.ts:55`. Prazo de 1 dia confere (`purge_auth_attempts`, cron `bicos-limpar-tentativas`, confirmado no staging), mas o telefone/CPF-hash não está descrito. 3. Sessão do Supabase Auth: `auth.sessions` e `auth.refresh_tokens` guardam `ip`, `user_agent` e (no `auth.users`) metadados do cadastro enquanto a sessão vive (colunas conferidas no staging); a Política não cita. 4. `push_subscriptions.user_agent` (até 300 caracteres, `save_push_subscription`): coberto por "registro do aparelho", sem dizer que inclui o modelo/navegador. 5. O aparelho guarda uma **cópia da conta** (`localStorage` `bicos.conta`: e-mail, WhatsApp, documento mascarado, papel, suspensão; `web/src/services/remote/session.ts:144-165`), o telefone digitado no login por SMS (`sessionStorage` `bicos-celular`, `auth.ts:526`) e o papel do Google (`bicos-google-papel`); a seção 9 só fala de "sessão e preferências (cidade, filtros)". A cópia sai no `leaveSession`, mas não se a sessão simplesmente expirar em aparelho compartilhado. 6. Serviços de push do navegador (Google FCM, Apple, Mozilla): o `endpoint` em `push_subscriptions` aponta para eles e é por eles que passa o texto de cada aviso (cifrado) — são destinatários não nomeados; o push está desligado no lançamento (L12), mas o código e a tabela existem (`enviar-push`, `save_push_subscription`). 7. `reports.details`, `reviews.comment`, `application_events.reason`, `job_invites`: texto livre dos usuários, coberto de forma genérica ("denúncias, avaliações…"), sem aviso para não escrever dado sensível/de terceiros.
- Impacto: transparência incompleta (art. 9), sem dano direto.
- Causa raiz: a Política foi escrita a partir do mapa `docs/LGPD.md`, que também não lista esses itens.
- Correção recomendada: acrescentar os itens 1–6 às seções 2, 5 e 9 e ao `docs/LGPD.md`.
- Critério de aceite: cada tabela/chave acima aparece no mapa e na Política; `legal.test.ts` continua verde.
- Dependências: AUD-016 (revisão do advogado).
- Origem: D5-015 (D5); também reportado por: C2-014
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C2-014 (S3): Política de privacidade não descreve o login por celular via Firebase/reCAPTCHA nem o que fica guardado no aparelho — onde: web/src/services/legal.ts:147 e :177; web/src/services/remote/firebase.ts:1-12 e :214-226; web/src/services/remote/session.ts:144-169; web/src/services/features.ts:28-32

### AUD-076 — "Apagamos na hora" não diz nada sobre cópias de segurança; e hoje o plano Free nem tem cópia

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `web/src/services/legal.ts:155`, `web/docs/DECISOES.md` X30 (hospedagem Free, "backup manual antes de qualquer mudança")
- Prova: o texto promete eliminação imediata. Quando o projeto passar para o Pro (decisão X30, "antes de receber pessoas reais"), o Supabase mantém cópias diárias por alguns dias (prazo a confirmar no plano contratado) e o dado excluído continua nelas até vencer; a decisão X30 também registra que um `pg_dump` manual seria guardado fora (GitHub) só com aprovação. Hoje (Free) é o contrário: sem cópia, uma exclusão por engano ou falha não tem volta (risco de perda de dados, tratado por outras frentes).
- Impacto: a promessa absoluta fica imprecisa; não é descumprimento se o texto avisar.
- Causa raiz: texto escrito antes da decisão de plano.
- Correção recomendada: acrescentar "Cópias de segurança são apagadas em até N dias" na seção 6; ao restaurar um backup, reaplicar as exclusões pedidas desde a data dele (procedimento em `docs/SUPABASE.md`).
- Critério de aceite: texto da Política e procedimento de restauração documentados.
- Dependências: plano contratado (ação do responsável).
- Origem: D5-016 (D5)

### AUD-077 — Depois que o trabalhador exclui a conta, o primeiro nome dele continua nos avisos da empresa (e vice-versa)

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: funções `transition_application`, `confirm_presence`, `answer_invite`, `admin_suspend_account` (usam `first_name(...)` dentro de `notify(...)`; consulta em `pg_proc.prosrc` no staging), `anonymize_account` (apaga só os avisos da própria conta)
- Prova: `notifications` tem FK com `ON DELETE CASCADE` só para o `worker_id`/`company_id` dono do aviso. `anonymize_account` de um trabalhador chama `application_step(..., 'desistir')`, que gera "<primeiro nome> não vai poder ir…" para a empresa; esse aviso fica na caixa da empresa depois que o trabalhador é apagado.
- Impacto: mínimo (primeiro nome + título da vaga), mas contraria "apagamos na hora seus dados".
- Causa raiz: avisos são texto pronto, sem ligação com a pessoa citada.
- Correção recomendada: trocar o primeiro nome por "O trabalhador" nos avisos gerados durante a exclusão, ou aceitar e dizer na Política que avisos já entregues à outra parte não são apagados.
- Critério de aceite: teste SQL: excluir um trabalhador e `select … from notifications where body ilike '%<nome>%'` = 0.
- Dependências: nenhuma.
- Origem: D5-017 (D5)

### AUD-078 — A exportação devolve o CPF/CNPJ em claro sem pedir a senha de novo (a exclusão pede)

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261021000600_u51_endereco.sql:205` (`'documento', v_doc` via `pgp_sym_decrypt`), `web/src/services/remote/actions.ts:140-153` (nenhuma verificação), comparar com `delete_my_account` (`session_authenticated_at() < now() - 5 minutes` → BC401)
- Prova: leitura das duas funções no staging; `export_my_data` só chama `auth.uid()`.
- Impacto: quem pegar um celular com a Bicos aberta baixa o CPF completo, o WhatsApp, o endereço e o histórico da pessoa com um toque.
- Causa raiz: a exportação não foi tratada como operação sensível.
- Correção recomendada: exigir login recente (mesma regra de 5 minutos da exclusão) ou pedir a senha/código na tela antes de gerar o arquivo.
- Critério de aceite: teste SQL: `export_my_data` com sessão de 1 hora falha com BC401.
- Dependências: nenhuma.
- Origem: D5-018 (D5)

### AUD-079 — Todo membro da equipe (inclusive "moderador") enxerga a selfie e a foto do documento; a Política diz "equipe de verificação"

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: política de Storage "Equipe lê as fotos de identidade" (`is_staff()`), `staff_members.role in ('admin','moderador')` (CHECK), `admin_identity_queue` (`staff_guard()` sem distinguir papel), `web/src/services/legal.ts:129`
- Prova: no staging, `pg_policies` de `storage.objects` lê `bucket_id = 'identidade' AND is_staff()`; `is_staff()` = existe linha em `staff_members` (qualquer papel). Ver a imagem (URL assinada) não gera linha em `staff_actions`; só a decisão é registrada.
- Impacto: moderadores de conteúdo (denúncias) também acessam dado biométrico; sem trilha de quem viu.
- Causa raiz: papel único de acesso.
- Correção recomendada: papel `verificador` separado, ou limitar a política a `role = 'admin'`; registrar a abertura da imagem (RPC que gera a URL assinada e grava em `staff_actions`).
- Critério de aceite: teste SQL com usuário `moderador` recebendo negado no bucket `identidade`.
- Dependências: nenhuma.
- Origem: D5-020 (D5)

### AUD-080 — Os direitos do titular existem no texto, mas o app só tem "exportar" e "excluir": não mostra o canal do encarregado nem como corrigir CPF, pedir anonimização ou se opor

- Área: LGPD
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: em parte duplicata de AUD-016 e AUD-071; resíduo: tela de Privacidade sem link para a Política nem e-mail do encarregado. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/pages/shared/Privacy.tsx` (só dois cartões), `web/src/services/legal.ts:163-164` ("corrigir, pedir anonimização ou eliminação, saber com quem compartilhamos, retirar consentimentos… Pelo app ou pelo {{DPO_EMAIL}}"), `web/src/pages/shared/Help.tsx`
- Prova: `grep -rniE "encarregado|\bdpo\b|privacidade@" web/src --include=*.tsx` (fora de `legal.ts`) = nenhuma ocorrência. O CPF/CNPJ não tem tela de correção (`grep -rn "change_document"` = vazio; o documento só nasce em `create_my_account`); WhatsApp e nome têm. A tela "Privacidade e dados" não tem link para a Política, nem lista de com quem os dados são compartilhados, nem e-mail do encarregado, nem "retirar consentimento" (AUD-071), nem "revisar decisão" (a suspensão por moderação não tem tela de contestação; o texto dos Termos §7 manda "falar com o suporte").
- Impacto: o prazo de resposta de 15 dias (art. 19, II) só corre se a pessoa conseguir pedir; quem não acha o e-mail desiste ou usa o WhatsApp do suporte, onde o pedido fica sem registro.
- Causa raiz: o canal depende do campo `{{DPO_EMAIL}}` (AUD-016) e nenhuma tela o usa.
- Correção recomendada: na tela Privacidade e dados, acrescentar: link para a Política, "Falar com o encarregado" (`mailto:` com o assunto pronto), "Pedir correção do CPF" e "Retirar a selfie". Registrar cada pedido (e-mail dedicado + planilha com data de recebimento e resposta) para provar o prazo de 15 dias.
- Critério de aceite: a tela mostra os 4 itens; `legal.test.ts` cobre o mesmo e-mail nos dois lugares.
- Dependências: AUD-016 (e-mail do encarregado), AUD-071.
- Origem: D5-022 (D5)

### AUD-081 — Não há plano de resposta a incidente de segurança, mas a Política promete avisar a pessoa e a ANPD

- Área: LGPD
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: confirmado que nenhum documento trata de incidente; é lacuna de processo, a fazer antes de ter dados reais. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/services/legal.ts:171` ("Se houver um incidente que possa causar risco a você, avisamos você e a ANPD"), `web/docs/` (nenhum documento trata de incidente)
- Prova: `grep -rniE "incidente|vazamento|ANPD" web/docs/*.md` fora de `LGPD.md` = vazio; não existe roteiro de quem decide, o que registrar, como avisar as pessoas e em quanto tempo (a regulamentação da ANPD sobre comunicação de incidente fixa prazo de poucos dias úteis — conferir com o advogado o número vigente).
- Impacto: num vazamento real, a equipe de três sócios perde dias decidindo o que fazer, e o prazo legal passa.
- Causa raiz: foco técnico das rodadas anteriores; documento de resposta nunca pedido.
- Correção recomendada: uma página `docs/INCIDENTE.md` (1 tela): quem é o encarregado, como confirmar o incidente (Sentry, logs do Supabase), contenção (rodar a chave `service_role`, desligar a função), registro (data, dados, quantidade de titulares), modelo de aviso à ANPD e aos titulares, contato do advogado. O advogado revisa.
- Critério de aceite: documento existe e é referenciado no `CHECKLIST-LANCAMENTO.md`; simulação de mesa feita uma vez.
- Dependências: ação do responsável (nomear o encarregado, AUD-016).
- Origem: D5-023 (D5)

### AUD-082 — Dados pessoais dos sócios num repositório público

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/site.yml:40`; `staging.yml:178,190`; `web/docs/SUPABASE.md:163`; `web/docs/STAGING.md:17`; `web/supabase/functions/.env.staging.example:21`; `web/src/services/features.ts:47`; `web/src/services/payments.ts:283`; `web/e2e/apoio.ts:28`
- Prova: repositório público (private=false). Aparecem o celular do suporte (que o CLAUDE.md chama "o mesmo da produção") em 2 workflows; o Gmail de desenvolvimento em 10 pontos — padrão do E2E (staging.yml:190), `SUPPORT_EMAIL` do app (features.ts:47), texto em payments.ts:283 — e SUPABASE.md:163 manda usar esse Gmail como `VAPID_SUBJECT`, o que o commit 0cd502e acabou de tirar do código; e-mail do dono da organização Supabase (STAGING.md:17). O histórico guarda o `archive/` inteiro (192 arquivos; `git show 4d9ea34^:archive/…`). Busca de padrões de segredo (JWT service_role, sbp_, ghp_, chaves Brevo, Mercado Pago, chave privada, whsec_, sntrys_) no histórico inteiro: 0 resultados; a árvore só tem identificadores públicos (anon do staging, chave pública do Firebase).
- Impacto: facilita phishing e engenharia social contra quem administra as contas.
- Causa raiz: e-mail/telefone de teste virou padrão de configuração.
- Correção recomendada: trocar por endereços da empresa (suporte@, dev@nivotech.com.br); `E2E_EMAIL_BASE` sem padrão; corrigir SUPABASE.md:163; decidir se o telefone do suporte pode ser público já.
- Critério de aceite: `git grep` por esses valores = 0 fora de `.env` locais.
- Dependências: ação do responsável (escolher os endereços)
- Origem: O1-014 (O1); também reportado por: B1-008
- Revisão adversária: Cético B: frágil em parte: o WhatsApp do suporte vai ao pacote público de propósito (CLAUDE.md §7.7); só o e-mail da organização em `STAGING.md:17` e o Gmail de desenvolvimento são dados dos sócios.
- Ocorrências adicionais (mesmo problema, outros lugares):
  - B1-008 (S3): Suporte é um Gmail fixo no código; `/ajuda` só tem esse `mailto:` — onde: `services/features.ts:47` (`[e-mail pessoal da equipe]`); `pages/shared/Help.tsx`

### AUD-129 — Fim de sessão por outro caminho que não o botão "Sair" deixa o aparelho recebendo notificações da conta antiga

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: web/src/services/remote/auth.ts:107-114 (só `signOut()` chama `disablePush`); web/src/services/remote/session.ts:454-468 (`sessionEnded`), :433-438 (`dropBrokenSession`), :569-571 (evento `SIGNED_OUT`) — os três chamam `leaveSession()` sem `disablePush`; web/src/services/push.ts:84-88 e supabase/migrations/20261014000300_x03_push.sql:27-49
- Prova: `grep -rn disablePush web/src` → fora da definição (push.ts:91) e do botão de Configurações (NotificationSettings.tsx:103), só `remote/auth.ts:110`, dentro de `signOut()`. A assinatura do aparelho (`push_subscriptions.endpoint`) continua ligada à conta antiga no servidor e no navegador. Quando outra pessoa entra no mesmo aparelho, `syncPushSubscription` (chamado em `loadSession`, session.ts:307) vê `pushState()==='ligado'` e `save_push_subscription` faz `on conflict (endpoint) do update set account_id = excluded.account_id`: o aparelho passa a receber os avisos da nova conta sem ela ter ligado nada. Entre uma coisa e outra, os avisos da conta antiga continuam chegando na tela de bloqueio.
- Impacto: sessão expirada/revogada ou aba que sai em outro lugar deixa títulos de avisos ("Maria foi aprovada…") aparecendo no aparelho de quem não está mais logado. Hoje push está desligado no lançamento (L12), então o risco é futuro.
- Causa raiz: `disablePush` está só no caminho do botão.
- Correção recomendada: chamar `disablePush` (com timeout curto e sem esperar o servidor) dentro de `leaveSession`, e na entrada pedir confirmação (ou não religar) se a assinatura pertencia a outra conta.
- Critério de aceite: teste com falso Supabase: depois de `sessionEnded()` a chamada `delete_push_subscription` foi feita ou `sub.unsubscribe()` executado.
- Dependências: push ligado (ação do responsável: VAPID).
- Origem: C2-008 (C2)

### AUD-181 — O staging acumula lixo de teste e dado de gente real, sem rotina de limpeza

- Área: LGPD
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: staging `setyxomsbfrkneqqfoam`; `web/e2e/limpeza.ts`; `anonymize_account` (Y15, anterior ao U24)
  - Prova (contagens no staging): 223 linhas em `workers` e 30 em `companies` sem conta, todas "Conta excluída", de 19 e 20/10 (resto da anonimização anterior ao U24); 12 linhas em `profiles` legada (o gatilho copia nome e e-mail); 12 contas, 11 delas `@gmail.com`, criadas até 28/10, com 11 vagas e 3 candidaturas. Produção está limpa: 1 trabalhador e 3 empresas, 0 órfãos.
- Prova: —
- Impacto: o CLAUDE.md proíbe dado real no staging, mas ali há e-mails reais sem prazo de apagamento; as linhas órfãs também são lidas por qualquer conta logada (AUD-021).
- Causa raiz: sem rotina de limpeza do staging.
- Correção recomendada: `delete from workers/companies` dos órfãos "Conta excluída"; um cron (ou passo do `staging.yml`) que apague contas de teste com mais de N dias; esvaziar `profiles` legada no staging.
- Critério de aceite: `select count(*)` dos órfãos = 0 e uma rotina agendada registrada.
- Dependências: nenhuma (relacionado a AUD-072, AUD-024)
- Origem: HUNT-007 (HUNTER)

## Área: acessibilidade (18)

### AUD-145 — Sem `h1` em várias telas

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `/splash`, `/perfil`, `/trabalhador/:id`, `/construtora/:id` e telas de erro de vaga/avaliação
- Prova: inspeção do DOM.
- Impacto: leitor de tela sem título de página.
- Causa raiz: nome em `<span>`.
- Correção recomendada: `h1` nessas telas.
- Critério de aceite: axe sem violação de `page-has-heading-one`.
- Dependências: nenhuma (relacionado a AUD-150)
- Origem: B1-011 (B1)

### AUD-149 — Alvos de toque pequenos nas telas de entrada e leitura

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (valores de classe)
- Onde: `pages/shared/Login.tsx:174` ("Esqueci minha senha", `h-9`, sem `tap-target`) e `:191` (`h-10`); `PhoneSignIn.tsx:141` e `WhatsAppCode.tsx:64` (`h-9`); `VerifyEmail.tsx:305` (`h-10`); `Notifications.tsx:45` (`h-9`); "Denunciar" em `ReviewsScreen.tsx:106-112` e `WorkerPosts.tsx:166-172` (`text-xs`, sem altura nem padding, ~16 px); o × de `ExperiencesField.tsx:103-112` (28 px); olho de `PasswordInput` em `components/Input.tsx` (`w-9 h-9`), usado em Login, Cadastro, Trocar senha e Excluir conta
- Prova: a convenção X05 (`styles/base.css:266-277`) é `tap-target` com mínimo de 44 px; esses elementos não usam a classe.
- Impacto: erro de toque nos pontos de recuperação de senha e na ação de segurança "Denunciar", para quem usa celular simples.
- Causa raiz: a classe `tap-target` não foi aplicada.
- Correção recomendada: `relative tap-target` ou `min-h-11` nesses botões.
- Critério de aceite: axe ou Playwright com alvo de 44 px ou mais nessas telas.
- Dependências: nenhuma
- Origem: C3-008 (C3); também reportado por: C5-009, B1-005, B2-006, P1-009
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C5-009 (S3): Botões abaixo de 44 px sem `tap-target` — onde: olho da senha 36 px (`components/Input.tsx`), "Colar código" 40 px (`CodeInput.tsx`), painel de notificações 32 px (`NotificationsPanel.tsx`), toast 36 px (`ToastHost.tsx`), "Trocar" 36 px, entre outros
  - B1-005 (S3): Alvos de toque < 44 px nas telas do trabalhador (medidos em 360 px) — onde: Denunciar 59×16; Remover experiência 28×28 e Editar 247×26 (`/perfil/editar`); Adicionar experiência 36×36; Mostrar senha 36×36; "Esqueci minha senha" 148×36; "Criar minha conta" (login) 126×40; Tema claro/escuro 37×34; Filtros 90×36; Mais perto/Maior valor/Mais cedo 104×40; Salvar vaga, Remover dos salvos, Excluir post, Falar no WhatsApp 40×40; "Marcar todas como lidas" 208×36; chips de avaliação ×36; Sair 50×40; Trocar e-mail 87×36
  - B2-006 (S3): Vários alvos de toque abaixo de 44 px, sem a área expandida do `.tap-target` — onde: "Denunciar" das avaliações (`/avaliacoes/*`, 59x16 px), "Ver seus bicos" (95x20, `DeleteAccount.tsx:170-176`), "Mostrar senha" (36x36, `/configuracoes/senha|email|excluir-conta`), tema Claro/Escuro (37x34, `/configuracoes`), "Marcar todas como lidas" (208x36), "Ver avaliações" (90x40), abas "Todas · N / Abertas / Cheias" e passos "1 Serviço e local / 2 Valor e pessoas" (40 px de altura); Aprovar/Recusar candidato (40x40, lado a lado, `CandidateRow`, com `.tap-target` de 44 px que se sobrepõe)
  - P1-009 (S3): Alvos de toque abaixo de 48 px em controles frequentes — onde:

### AUD-150 — Foco/nome acessível ausentes (checkbox, "não lida", selo, progresso)

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (leitura de código)
- Onde: `components/Checkbox.tsx:17-26` (usado em Signup 18+/termos, AcceptTerms, DeleteAccount); `pages/shared/Notifications.tsx:75-77`; `WorkerProfileScreen.tsx:114-118`; `components/FlowLayout.tsx:47-59`; `CompanyProfileScreen.tsx:110`; `WorkerProfileScreen.tsx:125`
- Prova: o input do checkbox é `sr-only peer` e a caixa desenhada não tem `peer-focus-visible`; o `:focus-visible` global (`base.css:45`) cai no input invisível. `<span aria-label="Não lida">` sem `role` não é lido. O selo de verificado no avatar é só um ícone. "Passo n de N" não é `aria-live` e a barra não tem `role=progressbar`. Os nomes nos perfis são `<span>`, sem `h1`.
- Impacto: quem navega por teclado não vê onde está o foco nos termos do cadastro; leitor de tela perde o selo e o progresso.
- Causa raiz: componentes sem estados de acessibilidade.
- Correção recomendada: `peer-focus-visible:ring-4`; `role="img"` ou texto `sr-only` na bolinha; `aria-label` no selo; `progressbar` e `aria-live`; `h1` nos nomes.
- Critério de aceite: axe sem violação nessas telas e foco visível no checkbox.
- Dependências: nenhuma
- Origem: C3-011 (C3)
- Revisão adversária: Cético B: duplicata parcial de AUD-043 (foco do checkbox); fica o nome acessível de 'não lida', selo e progresso.

### AUD-151 — Os dois campos de horário do passo 2 de publicar vaga não têm nome acessível

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/recruiter/CreateJob.tsx:341-363`; `components/Input.tsx`; `web/scripts/a11y-check.mjs:39`
- Prova: "Horário" é um `<span>` e `Input.tsx` não aceita `aria-label`. O axe do CI só abre `/criar-vaga` no passo 1.
- Impacto: leitor de tela anuncia dois campos sem nome.
- Causa raiz: componente sem suporte a `aria-label` e CI sem cobrir o passo 2.
- Correção recomendada: `aria-label` nos dois campos e axe no passo 2.
- Critério de aceite: axe sem violação no passo 2.
- Dependências: nenhuma
- Origem: C4-006 (C4)

### AUD-152 — Escolhas visuais sem estado para leitor de tela

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `pages/worker/feed/MobileFeed.tsx:67-78` (ordenar); `pages/recruiter/BoostJob.tsx:93-110` (plano); `pages/worker/VerifyIdentity.tsx:37-59` (foto da identidade fica sem nome); abas `role="tab"` sem painel nem setas em `Admin`, `MyJobs`, `CreateJob`, `BoostPayment`
- Prova: o `Tag` já tem `aria-pressed`; esses não usam.
- Impacto: quem usa leitor de tela não sabe qual opção está escolhida.
- Causa raiz: sem componente de escolha segmentada acessível.
- Correção recomendada: um componente `Segmented` com `aria-pressed`/`radiogroup`.
- Critério de aceite: axe sem violação e estado anunciado.
- Dependências: nenhuma
- Origem: C4-007 (C4)

### AUD-153 — `Button loading` perde o nome acessível, encolhe e fica desativado

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (renderização)
- Onde: `components/Button.tsx`
- Prova: renderização de servidor com o componente real.
- Impacto: leitor de tela não anuncia o botão durante o carregamento; o layout pula.
- Causa raiz: o rótulo sai do DOM no estado de carregamento.
- Correção recomendada: manter o rótulo (visualmente oculto) e a largura.
- Critério de aceite: nome acessível preservado em `loading`.
- Dependências: nenhuma
- Origem: C5-005 (C5)

### AUD-154 — `PhotoSlot` com foto escolhida tem campo de arquivo sem nome; remover do `PhotoManager` tem 28 px

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `components/PhotoSlot.tsx`, `PhotoManager.tsx`
- Prova: leitura e medida de classes.
- Impacto: nome ausente e alvo de toque pequeno.
- Causa raiz: falta de `aria-label` e `tap-target`.
- Correção recomendada: `aria-label` e `tap-target`.
- Critério de aceite: axe e alvo ≥ 44 px.
- Dependências: nenhuma
- Origem: C5-006 (C5)

### AUD-155 — `Rating showValue={false}` não tem texto equivalente

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `components/Rating.tsx`; `pages/shared/ReviewsScreen.tsx:89`
- Prova: leitura.
- Impacto: o leitor de tela não lê a nota.
- Causa raiz: estrelas só visuais.
- Correção recomendada: `aria-label="Nota 4,5 de 5"` ou texto `sr-only`.
- Critério de aceite: a nota é anunciada.
- Dependências: nenhuma
- Origem: C5-007 (C5)

### AUD-156 — Erro não ligado ao campo em `Select`, `CodeInput` e `AboutField`; o CEP aponta para um id que some

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `components/Select.tsx`, `CodeInput.tsx`, `AboutField.tsx`, `AddressFields.tsx:125,148`
- Prova: sem `aria-invalid`/`aria-describedby`; o id do erro do CEP não existe no DOM em alguns estados.
- Impacto: o leitor de tela não associa o erro ao campo.
- Causa raiz: associação não implementada.
- Correção recomendada: `aria-invalid` e `aria-describedby` com id estável.
- Critério de aceite: axe e teste de leitura da árvore de acessibilidade.
- Dependências: nenhuma
- Origem: C5-008 (C5)

### AUD-157 — Contrastes abaixo de WCAG AA

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (cálculo em `contrast.py`)
- Onde: botão WhatsApp 4,31:1; botão accent 3,98:1; placeholder 3,11:1; borda de campo e trilho do Switch 1,67:1; linha de candidato apagada 2,54:1 (`styles/tokens.css` e componentes)
- Prova: `$SCRATCH/out/C5/comandos.txt`.
- Impacto: leitura difícil sob sol, justamente o uso do público-alvo.
- Causa raiz: tokens de cor escolhidos sem checar contraste.
- Correção recomendada: ajustar tokens para ≥ 4,5:1 (texto) e ≥ 3:1 (componentes).
- Critério de aceite: teste automatizado de contraste dos tokens.
- Dependências: nenhuma
- Origem: C5-010 (C5); também reportado por: C6-003, P1-010, C5-018
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C6-003 (S3): No tema escuro o contorno de foco dos botões e o foco padrão têm 2,7–2,9:1 — onde: `styles/tokens.css:92,166` (`--border-focus` = `--blue-500` = `#1d4bed` também no escuro), `styles/base.css:45-48`, `components/Button.tsx:63` (`outline-brand-500`)
  - P1-010 (S3): Letra pequena e contraste < 7:1 nos detalhes do card e na tela de entrada — onde: `components/JobTile.tsx:113` (13 px), `:97` (11 px); `pages/shared/Splash.tsx:9` (`text-white/85`); `pages/worker/feed/MobileFeed.tsx:174-180`
- Prova (claro): título e valor 18,5:1; distância/horário/"por diária" 5,84:1 a 13 px (`#5C6672`); aba inativa 5,0:1 a 14 px; hora da notificação 5,33:1 a 12 px; Splash 5,05:1; botão primário 6,4:1; fatos da vaga 8,04:1.
  - C5-018 (S3): Textos de 10 a 11 px em pontos importantes — onde: situação da candidatura, selos, "Novo" (`components/Badge.tsx`, `Tag.tsx` e telas)

### AUD-158 — Toast some em 4 s, inclusive erro e "Desfazer", sem pausar

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `services/toast.ts`; `components/ToastHost.tsx`
- Prova: leitura.
- Impacto: pessoas que leem devagar perdem a mensagem de erro.
- Causa raiz: tempo fixo.
- Correção recomendada: pausar ao toque/foco e prolongar erros.
- Critério de aceite: erro permanece até a pessoa fechar ou 10 s.
- Dependências: nenhuma
- Origem: C5-011 (C5)
- Revisão adversária: Cético B: mantido com correção: o toast padrão dura 4 s (`toast.ts:33`), mas os 'Desfazer' duram 7 s (`decisionToasts.ts:10`).

### AUD-159 — `NotificationsPanel` não move nem devolve o foco; selo do sino fora do nome acessível; "Não lida" em `span` com `aria-label`

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `components/NotificationsPanel.tsx`
- Prova: leitura.
- Impacto: navegação difícil por teclado/leitor de tela.
- Causa raiz: painel sem gestão de foco.
- Correção recomendada: mover o foco ao abrir e devolver ao fechar; incluir a contagem no nome do botão.
- Critério de aceite: teste de foco.
- Dependências: nenhuma
- Origem: C5-012 (C5); também reportado por: C6-008
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C6-008 (S3): Menu da conta e abas com semântica incompleta — onde: `layouts/AppNav.tsx:288-304` (`role="menu"`/`menuitem`), `:113-132` e `:205-227` (abas são `<button>` com `navigate`), `:237-242` (`aria-haspopup="dialog"`), `:60-65` (Esc global)

### AUD-160 — `alertdialog` sem `aria-describedby`; erro do `SignOutDialog` entra no lugar da descrição, sem `role="alert"`

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `components/Modal.tsx`, `SignOutDialog.tsx`
- Prova: leitura.
- Impacto: a descrição do diálogo não é anunciada.
- Causa raiz: associação ausente.
- Correção recomendada: `aria-describedby` e `role="alert"` no erro.
- Critério de aceite: leitor anuncia título e descrição.
- Dependências: nenhuma
- Origem: C5-016 (C5)

### AUD-161 — `h3` fixo em `EmptyState`, `ErrorState` e `ReviewUnavailable`; `JobNotFound` é tela sem saída

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (a ausência de menu nessas telas não foi conferida em navegador)
- Onde: `components/EmptyState.tsx`, `ErrorState.tsx`, `NotFound.tsx`
- Prova: leitura.
- Impacto: hierarquia de títulos quebrada; tela de "não encontrado" sem caminho de volta.
- Causa raiz: nível de título fixo.
- Correção recomendada: nível configurável e botão "Voltar ao mural".
- Critério de aceite: axe sem violação de ordem de título; saída visível.
- Dependências: nenhuma
- Origem: C5-017 (C5)

### AUD-162 — Com "reduzir movimento" o ícone de carregando fica parado

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `styles/base.css:117-124` (`animation-duration: 0.01ms !important` sem mexer na repetição), `:91-93`, `:110-115`
- Prova: `reduced.mjs`: normal → ângulos `[0,9,17,26,34,43,51,60]`, 0,7 s infinito; `reducedMotion: reduce` → duração `1e-05s` e ângulos `[0,72,72,72,72,72,72,72]` (parado num arco). O esqueleto fica na cor base.
- Impacto: "carregando" vira desenho parado; não dá para distinguir de travado.
- Causa raiz: a regra de movimento reduzido zera a duração em vez de trocar a animação.
- Correção recomendada: no `@media` dar ao spinner rotação lenta/pulso e `animation-iteration-count: 1` ao resto.
- Critério de aceite: com `reduce` o spinner muda de estado em 2 s.
- Dependências: nenhuma
- Origem: C6-004 (C6); também reportado por: Q1-010
- Ocorrências adicionais (mesmo problema, outros lugares):
  - Q1-010 (S3): "Reduzir movimento" deixa o brilho do esqueleto piscando (animação infinita de 0,01 ms); a abertura em HTML não tem a regra — onde: `src/styles/base.css:117-123` (`animation-duration:.01ms!important` sem `animation-iteration-count:1`); `web/index.html:95-103` (`.boot-spin` sem `@media`)

### AUD-169 — Com fonte a 200 %, a barra de baixo vira "I…", "V…", "P…" e os títulos das vagas ficam com uma palavra

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (print)
- Onde: `src/layouts/AppNav.tsx:131` (`truncate` no rótulo das abas); `src/components/JobTile.tsx` (título `truncate`)
- Prova: `zoom.cjs` (`html{font-size:200%}`, 360×800). Não há rolagem horizontal em 12 telas × 3 modos, o que é bom. Mas `prints/Q1/zoom-texto200-_minhas_vagas.png` mostra a barra com "I…", "V…", "P…", "P…" e cartões "Limpeza …" / "Controle …".
- Impacto: baixa visão e trabalhadores mais velhos com "fonte maior" perdem o nome das abas e das vagas (WCAG 1.4.4).
- Causa raiz: `truncate` em rótulos curtos.
- Correção recomendada: rótulos em 2 linhas (`line-clamp-2`) e grade de 1 coluna quando o `font-size` do `html` > 20 px.
- Critério de aceite: o mesmo print com os rótulos legíveis.
- Dependências: AUD-157
- Origem: Q1-009 (Q1)

### AUD-170 — Todo botão de salvar vaga se chama só "Salvar vaga" (26 iguais no mural)

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `src/components/SaveFlag.tsx:5-12`; `src/components/JobTile.tsx:110`
- Prova: `kbd.cjs`, Tab no mural: `8:button "Salvar vaga"`, `9:button "Garçom para casamento…"`, `10:button "Salvar vaga"`, `11:button "Auxiliar de cozinha…"`, e assim por diante. O botão vem antes do título e sem contexto.
- Impacto: no TalkBack/VoiceOver ninguém sabe qual vaga está salvando (WCAG 2.4.6).
- Causa raiz: nome acessível genérico.
- Correção recomendada: `Salvar vaga: ${título}` e `Remover dos salvos: ${título}`.
- Critério de aceite: nomes únicos no `ariaSnapshot` do mural.
- Dependências: nenhuma
- Origem: Q1-011 (Q1)

### AUD-184 — Acessibilidade e desempenho no CI medem a demonstração, e duas telas varridas pelo axe são "Página não encontrada"

- Área: acessibilidade
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: o erro de rota procede (`a11y-check.mjs:27,33` abre `/candidaturas` e `/salvas`), mas corrigir duas strings conserta; 'mede a demonstração' repete AUD-189/AUD-190. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `web/scripts/a11y-check.mjs:27,33`; `web/src/routes.ts:154-155`; `.github/workflows/web.yml:47-48,89-109`; `web/vite.config.ts:155`; `web/scripts/lighthouse-check.mjs:6`; `web/docs/RELATORIO-FINAL.md:21-23`
- Prova: a11y-check.mjs abre `/candidaturas` e `/salvas`; as rotas reais são `/minhas-candidaturas` e `/vagas-salvas` (routes.ts:154-155). Reproduzido com dist-demo e o login do script (`$SCRATCH/o1work/pw/rotas.cjs`): "/candidaturas -> Página não encontrada", "/salvas -> Página não encontrada", "/minhas-candidaturas -> Minhas candidaturas", "/vagas-salvas -> Vagas salvas". O script não confere que a tela abriu. web.yml:92 roda `vite preview` sem `--outDir`, servindo `dist/` = `build:demo` (vite.config.ts:155; o build real do CI vai para `dist-real`). Lighthouse, axe (claro/escuro) e sem-rolagem medem a demonstração; nada do modo real (widget Turnstile, botão Firebase, passo do código de 6 números, `/v/:slug`, `/cadastro/*` com erro do servidor, `/admin`) passa pelo axe. Metas Lighthouse 85/95/95 (lighthouse-check.mjs:6) vs. medido 96/100/100: 11 pontos de folga; sem meta de SEO.
- Impacto: as telas mais usadas do trabalhador depois do mural (candidaturas e vagas salvas) nunca foram varridas pelo axe do CI; o "axe em 14 telas" dá mais confiança do que merece.
- Causa raiz: rotas renomeadas sem atualizar o script; o script não valida o que carregou.
- Correção recomendada: corrigir os 2 caminhos; falhar se o h1 for "Página não encontrada" ou a URL final divergir; servir também o build real (modo staging/E2E) e incluir páginas públicas; subir meta de desempenho para ~90.
- Critério de aceite: renomear uma rota sem mudar o script deixa o CI vermelho; o axe lista as páginas públicas.
- Dependências: nenhuma
- Origem: O1-005 (O1); também reportado por: Q1-007
- Ocorrências adicionais (mesmo problema, outros lugares):
  - Q1-007 (S3): O Lighthouse do CI mede só `/`, com metas frouxas, e deixa passar telas abaixo da própria meta — onde: `.github/workflows/web.yml:89-98` (uma URL); `web/scripts/lighthouse-check.mjs:7` (`TARGETS` 85/95/95, sem LCP/TBT/bytes)

## Área: testes (11)

### AUD-177 — Testes SQL sem as regras mais importantes de autorização, Storage e pagamento

- Área: testes
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado
- Onde: `tests/z01_candidaturas.sql`, `tests/seguranca.sql:38`, `tests/l22_desfazer_recusa.sql`, `tests/z12_fotos.sql:22-24`, `tests/z02_pagamentos.sql`, `tests/x01_mural.sql`, `tests/y01_y04_ciclo.sql`, `tests/l10_cnpj.sql`, `tests/l11_validacao_perfil.sql`, `tests/l13_conta_google.sql`, `tests/f12_presenca.sql`, `tests/y24_verificacao.sql`
- Prova: sem teste: `transition_application` chamada por OUTRA empresa em vaga alheia; `submit_application` com perfil incompleto, empresa chamando, prazo vencido, vaga cheia; `withdraw_application` após a decisão; `delete_my_account` de empresa e sem confirmar compromissos; políticas de Storage do z12 (só confere a ausência de `SELECT`), logo da empresa e mais de 8 fotos; z02: `fail_boost_payment`, `get_payment` virando "expirado", preços 1200/2800, impulsionar vaga já impulsionada/cheia; x01: `p_quando`, `p_oficio`, ordens cedo/valor, vaga cheia/vencida, visitante; y01: `update_job` (menos vagas que aprovados, aviso, reabrir recusados), "a combinar" contratado; l10: caminho positivo de `company_cnpj_for_check`; l11: `companies_name_length`; l13: WhatsApp inválido, nome curto, termos vazios; l22: recusa automática não desfaz; f12: `confirm_presence` após o prazo, por não-trabalhador, e o cron; y24: aviso de reprovada.
- Impacto: uma regressão no IDOR entre empresas ou nas políticas de Storage passa no CI sem ninguém ver.
- Causa raiz: os testes cobrem o caminho feliz de cada rodada.
- Correção recomendada: `authz_cruzado.sql` com 2 empresas e 2 trabalhadores; teste de Storage com `insert into storage.objects` como authenticated; completar os demais itens.
- Critério de aceite: cada item acima com teste negativo.
- Dependências: nenhuma
- Origem: D3a-007 (D3a); também reportado por: D3c-008, D3b-010
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3c-008 (S3): Lacunas nos testes SQL u* (regras importantes sem caso negativo, ou com dado que o app não grava) — onde: ver lista; arquivos em `web/supabase/tests/`
  - D3b-010 (S3): Testes SQL: regras sem teste negativo, teste sem asserção, três que quebram com segredos reais — onde: `tests/f10_perfil_profissional.sql:8`; `tests/lanc09_pg_net.sql:10-11`; `tests/lanc12_vigia_cron.sql:20,37,55`; `tests/x03_push.sql:40`; `CLAUDE.md` §5

### AUD-178 — Testes que só passam em banco vazio e mexem no banco inteiro

- Área: testes
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `tests/x01_mural.sql:26-29,45` (array exato e `count(*)=5` sobre todas as vagas); `tests/y01_y04_ciclo.sql:42,49-50,62,67` (`conclude_finished_jobs()` sem argumento; contagem de avisos por título sem filtrar a conta); `tests/f12_presenca.sql:31-32` (`remind_presence() = 1` global)
- Prova: leitura dos testes.
- Impacto: ficam vermelhos sem causa assim que o staging/E2E tiver dados; uma vaga real vencida é travada e alterada dentro da transação do teste. Contradiz o "pode rodar até na produção" do CLAUDE.md §5.
- Causa raiz: asserções globais em vez de filtradas pelos ids do teste.
- Correção recomendada: filtrar pelos ids do teste e usar `conclude_finished_jobs(p_worker, p_company)`; corrigir a frase do CLAUDE.md §5.
- Critério de aceite: rodar a suíte num banco com dados de exemplo continua verde.
- Dependências: nenhuma
- Origem: D3a-008 (D3a); também reportado por: D3a-009
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3a-009 (S3): Testes e conferências que descrevem comportamento antigo ou não rodam o que dizem — onde: `tests/y16_y17_documento.sql:39-43` (refaz o UPDATE da migration dentro do teste); `tests/z06_endereco.sql:1,11-34` (afirma "endereço só da dona e dos escolhidos", mas `has_column_privilege('authenticated','jobs','street','select')` é true no staging desde o U53; o front ainda chama `get_job_addresses`, `web/src/services/remote/data.ts:93,109`); `tests/z08_app_antigo.sql:23-24` ("até a remoção pendente do L07": o L07 não removeu o gatilho); `APLICAR.md:129` (#6 espera `street select -- false`, a

### AUD-182 — O E2E nunca executa de verdade 5 das 10 Edge Functions, simula o Google com `createUser` e finge o CNPJ e o mapa; também não tem visitante nem pagamento (aspecto novo de AUD-054 e AUD-189)

- Área: testes
- Severidade: S3 baixo
- Esforço: ?
- Confiança: —
- Onde: `web/e2e/fluxos/08-cadastro-google.spec.ts:49-66`; `web/e2e/apoio.ts:245-269`; `web/e2e/fluxos/` (todos os specs); `web/e2e/local/servidor.mjs:11`
- Prova: `grep` pelo nome da função em `web/e2e`: `codigo-whatsapp`, `criar-cobranca`, `webhook-pagamento`, `enviar-push` e `limpar-arquivos` aparecem em 0 arquivos. `entrar-com-firebase` só aparece em comentário. O spec 08 reproduz o que a função faz com `admin.auth.admin.createUser({ app_metadata: { provider: 'google', via: 'firebase' } })`. Verificação do token, `generateLink`, X31 (`confirmProvenEmail`) e o ramo do celular nunca rodam. `apoio.ts:258-269` intercepta `verificar-cnpj` no navegador e sempre devolve `pendente/indisponivel`. O caminho "ATIVA vira verificada" não é testado; o spec 07 aprova a empresa à mão. `apoio.ts:245-253` zera ViaCEP, Nominatim, Photon e BrasilAPI CEP. A cadeia de geocodificação nunca roda. Nenhum spec abre `/v/:id` sem login (por isso AUD-007 passou), impulsiona vaga, cria alerta ou convite, ou cobre `nao_compareceu` e `desistiu`. O spec 04 apaga as datas da vaga com `admin().update` e chama `conclude_finished_jobs` com service_role, então o cron real e a regra de +2 dias não são exercitados. O proxy do E2E local só serve `entrar-com-documento`, `excluir-conta` e `verificar-cnpj`.
- Impacto: as áreas com mais dinheiro e mais risco (pagamento, login pelo Google, celular, link público) não têm nenhuma prova automática. AUD-039/002 e AUD-007 ficaram sem teste porque ninguém passa por ali.
- Causa raiz: —
- Correção recomendada: spec de visitante em `/v/:id` e `/ajuda`; spec de impulso com um servidor falso do Mercado Pago, que assina o webhook com HMAC e confirma o `boost_ends_at`; testes de `entrar-com-firebase` chamando `verifyFirebaseToken` com `fetcher` e JWKS injetados, que a função já aceita; `verificar-cnpj` com `BRASILAPI_URL` apontando para um servidor falso (a função já lê essa variável); subir mais funções no `servidor.mjs`.
- Critério de aceite: o `web.yml` roda um spec de pagamento e outro de visitante; cada função tem ao menos uma chamada real no E2E ou um teste unitário.
- Dependências: —
- Origem: HUNT-008 (HUNTER)

### AUD-183 — O corpo demo deixa passar o que o banco recusa (candidatura, convite, presença, aviso, cadastro, avaliação)

- Área: testes
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado (leitura dos dois lados; definições do banco no staging)
- Onde: demo `web/src/services/applications.ts:282-316` (`submitApplication`) e `:502-530` (`confirmPresence`); `invites.ts:55-84` (`inviteWorker`); `alerts.ts:121-143` (`saveJobAlert`); `auth.ts:161-176` (`isFreeForSignUp`) e `:205-218` (`createAccount`); `reviews.ts:101` (tags); `payments.ts:44-50` (`boostBlocker`). Banco: `submit_application`, `limit_application_spam`, `refuse_blocked_application`, `refuse_suspended_application`, `confirm_presence`, `invite_worker`, `refuse_blocked_invite`, `save_job_alert`, `signup_taken`, `submit_review`.
  - Prova (função × demo × banco):
    - candidatura: demo não exige perfil completo, nem checa bloqueio, conta suspensa, vaga oculta, limite de 30 por dia e 3 por vaga por dia; banco recusa todos (BC409/BC401, texto "Complete seu perfil antes de se candidatar", "Não é possível se candidatar a essa vaga.", "Você já se candidatou… muitas vezes hoje").
    - convite: demo não tem o limite de 20 por dia, nem recusa trabalhador "Conta excluída" nem bloqueio; banco tem os três.
    - confirmar presença: banco recusa bico que já passou ("Esse bico já passou."); demo confirma; a notificação do banco leva a data ("· 12/11"), a do demo não.
    - aviso de bico novo: demo só confere cidade/UF e raio; banco exige lat/lon dentro do Brasil e ofício existente (BC422). O limite de 5 por dia é por dia UTC no demo (`at.slice(0,10)`) e por dia de Brasília no banco (`notified_on`).
    - cadastro: `isFreeForSignUp`/`createAccount` do demo contam contas ainda não confirmadas como "já existe"; o banco (`signup_taken`) só considera conta com e-mail confirmado ("uma conta nunca confirmada libera o documento").
    - avaliação: o demo grava as etiquetas como vieram (`tags: input.tags`); o banco descarta as que não estão na lista permitida.
    - vaga oculta: `boostBlocker`/`jobState` do demo não conhecem `hidden_at`; o banco trata vaga oculta como fechada (`job_is_open`).
    - Nenhum teste compara o corpo demo com o RPC: `remote.test.ts` só confere a forma das chamadas com um falso Supabase cujos RPCs são funções escritas à mão (`fakeSupabase.ts`), e os testes SQL não rodam o front.
- Prova: —
- Impacto: um bug de regra (por exemplo, o limite de candidaturas ou o bloqueio) não aparece no modo demonstração nem nos testes de serviço; só aparece com o banco. O demo mostra à equipe um comportamento mais folgado que o real.
- Causa raiz: as regras vivem duas vezes (TypeScript do demo e SQL), e só a tabela de status tem teste de paridade.
- Correção recomendada: (a) levar para o demo as regras baratas (perfil completo, bloqueio, convite 20/dia, presença de bico passado, tags permitidas, conta não confirmada não segura documento); (b) acrescentar um teste de contrato que roda os mesmos cenários nos dois modos, ou, no mínimo, uma lista de mensagens/condições por função em `CONTRATO-BACKEND.md` conferida por teste; (c) não precisa replicar spam/suspensão no demo se ficar documentado.
- Critério de aceite: cenários `candidatar com perfil incompleto`, `candidatar a empresa bloqueada`, `convidar 21 vezes`, `confirmar presença de bico passado` dão o mesmo código (`conflito`/`nao_autorizado`) nos dois modos em teste.
- Dependências: nenhuma.
- Origem: M1-003 (M1); também reportado por: O2-008
- Ocorrências adicionais (mesmo problema, outros lugares):
  - O2-008 (S3): O Supabase falso e o modo demo aceitam o que o servidor real recusaria; a fidelidade só é provada em outro lugar — onde: `web/src/__tests__/fakeSupabase.ts:157-162,66-78,29-52`; testes do modo demo (`applications.test.ts`, `services.test.ts`, `payments.test.ts`, `contacts.test.ts`, `reviews.test.ts`, `deleteAccount.test.ts`, `session.test.ts`); `web/src/types/database.generated.ts` (`feed_jobs`/`public_job_card` retornam `Json`, `transition_application` recebe `p_action: string`)

### AUD-189 — As telas só são abertas no build de demonstração (axe e rolagem); o modo real só é visto pelo E2E pós-merge, sem visitante, sem rede ruim e só em Chromium Pixel 7

- Área: testes
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: observação de cobertura (Vitest em `environment: 'node'`), não defeito; o E2E real tem 8 fluxos e há Lighthouse com rede estrangulada. Rebaixado para S3.
- Esforço: M
- Confiança: confirmado (cobertura medida)
- Onde: `web/vite.config.ts` (`test.environment: 'node'`, `include: ['src/**/*.test.ts']`); `web/e2e/playwright.config.ts:19-21` (`devices['Pixel 7']`); `web/e2e/fluxos/*`
- Prova: cobertura v8 da suíte inteira, numa cópia em `$SCRATCH/out/O2/cov` (`comandos.md`): linhas 37,7% (8.962/23.767), ramos 77,5%. Por pasta: `src/pages` 3,3% (9.350 linhas), `src/components` 6,8% (3.835), `src/hooks` 0% (290), `src/layouts` 0% (392), `App.tsx` 0%, `main.tsx` 0%, contra `src/services` 84,6% (7.461), `src/utils` 78,3%, `routes.ts` 95%. Telas grandes com 0%: `Signup.tsx` (542), `CreateJob.tsx` (485), `Admin.tsx` (402), `BoostPayment.tsx` (402), `JobManage.tsx` (364), `JobDetail.tsx` (302), `Login.tsx` (233), `PublicJob.tsx` (156). Nos serviços do modo real: `remote/applications.ts` 50%, `remote/profiles.ts` 52%, `remote/jobs.ts` 52%, `remote/storage.ts` 55% (ramos 30%: envio de foto, HEIC, nova tentativa do U69), `remote/actions.ts` 56%.
  O E2E (só pós-push no `staging.yml`) usa um perfil único: Chromium, Pixel 7, `locale pt-BR`, rede sem estrangulamento. O CI abre telas de verdade só nos scripts `a11y-check.mjs` e `sem-rolagem.mjs`, e no build de DEMONSTRAÇÃO (dados falsos, `web.yml` › `checks`), sem conferir comportamento. No E2E real, os únicos passos sem sessão são `/login`, `/escolha-perfil` e o cadastro: não há teste de visitante abrindo `/v/<slug>` ou `/ajuda` — foi assim que o AUD-007 (tela de erro para quem não tem conta) passou com CI verde. Também sem E2E: offline/PWA instalado, impulsionar, foto de perfil/portfólio pela tela, editar vaga, cancelar contratação, filtros do mural pela tela (só `feed_jobs` por RPC), código do WhatsApp, push.
- Impacto: o público-alvo (celular simples, internet ruim) é exatamente o que não é testado; um erro de tela, de foco ou de rolagem só aparece para o usuário. AUD-007 e C5-020 são sintomas disto.
- Causa raiz: a suíte rápida foi montada só para serviços; o E2E é caro (precisa de staging, e-mail e chaves) e roda depois do merge.
- Correção recomendada: (1) um Playwright "sem backend" no job `checks` (sem segredos): build real (`--mode staging` já existe) com `page.route` respondendo ao Supabase; casos: visitante em `/v/<slug>`, `/ajuda`, `/login`, `/mural` sem conta, rede offline (`context.setOffline`) e 3G lento; (2) perfil extra no `playwright.config.ts` (Android pequeno 360×640 com `cpuThrottling` + WebKit); (3) testes de componente com jsdom para `Modal/Sheet/Button/Input` (ver C5-020); (4) subir um piso de cobertura no CI (hoje não há medição).
- Critério de aceite: o caso "visitante abre o link público" falha no commit anterior ao conserto do AUD-007 e passa depois; relatório de cobertura publicado no CI com piso por pasta.
- Dependências: AUD-007, C5-020 (este achado é o lado de testes dos dois)
- Origem: O2-003 (O2); também reportado por: C5-020, C6-010
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C5-020 (S3): Nenhum teste de comportamento dos componentes — onde: `web/src/__tests__/` (sem testes de componentes); `useModal` não testado; `web/scripts/a11y-check.mjs`
  - C6-010 (M): (melhoria agora) Teste de visitante no modo real — onde: `web/e2e/fluxos` (8 roteiros; nenhum abre `/v/…`, `/ajuda` ou `/completar-cadastro` sem sessão); `src/__tests__` (nada de `AppShell`)

### AUD-190 — O job `e2e` do `web.yml` passa vazio e duplica o do `staging.yml`; LEIA.md, E2E.md e relatorio.ts descrevem o que não roda

- Área: testes
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: o job `e2e` sem segredos é intencional e anunciado no comentário do workflow (`web.yml:142-161`); o que existe é documentação desatualizada (LEIA.md '13 testes'). Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml:142-207`; `.github/workflows/staging.yml:128-201`; `web/e2e/LEIA.md:4,21-27`; `web/docs/E2E.md:3,7`; `web/e2e/relatorio.ts:8-16`; `web/e2e/local/servidor.mjs:11`
- Prova: run `40117686113` (`web`, master, 24/10): job `e2e` com conclusão `success`, mas só "Segredos do staging" executou; checkout, npm, build e "E2E (Playwright)" ficaram `skipped` (faltam os segredos `E2E_*`). Run `40117427320` (`staging`, 1f202ee): o `e2e` rodou de verdade (`E2E (Playwright)` 17:51:28→17:55:17, sucesso), buscando as chaves em tempo de execução pela API do Supabase. Ou seja: o E2E real só acontece no `staging.yml`; o do `web.yml` é um verde vazio. A documentação (`LEIA.md` "No staging (CI, job e2e)") descreve o do `web.yml` (segredos `E2E_SUPABASE_URL`, `E2E_ANON_KEY`…). Além disso: `LEIA.md` diz "Sete arquivos" e lista oito; `E2E.md` (gerado) diz "13 testes… 16/10/2026" e não tem o fluxo 8, porque `relatorio.ts` só conhece f1–f7 (hoje há 15 testes); o comentário de `staging.yml:128` ainda diz "os 13 testes"; `servidor.mjs` (E2E local) só sobe 3 funções, mas os fluxos 1 e 2 chamam `verificar-cadastro` — o roteiro "local" do `LEIA.md` não passa mais. Se os segredos `E2E_*` forem criados um dia, os dois jobs rodam ao mesmo tempo contra o mesmo staging.
- Impacto: dá a impressão de "E2E verde em todo push" quando ele só roda quando o `staging.yml` é acionado (caminhos `web/src/**`, `web/e2e/**`, migrations, funções) e nunca antes do merge; a equipe pode apagar o job errado ou confiar em documento defasado.
- Causa raiz: dois workflows nasceram para o mesmo fim em momentos diferentes (L03 e R08); o relatório e a documentação não acompanharam os fluxos novos.
- Correção recomendada: apagar o job `e2e` do `web.yml`; atualizar `LEIA.md` para o fluxo do `staging.yml`; incluir `f8` em `relatorio.ts`; trocar "13 testes" por contagem calculada; ou remover a seção "Local" se não for mais mantida.
- Critério de aceite: só um job `e2e`; `E2E.md` gerado lista os 8 fluxos e a contagem real.
- Dependências: nenhuma
- Origem: O2-004 (O2); também reportado por: O1-004
- Ocorrências adicionais (mesmo problema, outros lugares):
  - O1-004 (S2): CI que fica verde sem rodar nada: job e2e do web.yml e passos de segredos do staging.yml — onde: `.github/workflows/web.yml:142-164`; `staging.yml:37-46,69-78,139-148`; `CLAUDE.md:40,179-181`

### AUD-191 — O E2E deixa lixo e mexe em dados que não são dele no staging

- Área: testes
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/e2e/fluxos/04-diaria-avaliacao.spec.ts:46`; `web/e2e/fluxos/07-equipe.spec.ts:144-154`; `web/e2e/limpeza.ts:17-30`; `web/e2e/apoio.ts:59-64`; `web/e2e/playwright.config.ts:17`
- Prova: consulta no staging (somente leitura): `public.staff_actions` tem 265 linhas (aprovar_identidade 70, reativar_conta 65, suspender_conta 65, aprovar_construtora 65; de 19/10 a 24/10) — o registro de auditoria do fluxo 7 sobrevive à exclusão das contas, uma leva por execução. Contas de teste: 0 restantes (`auth.users where email like '%+e2e-%'` = 0), então a limpeza de contas funciona. Outros pontos: (1) o fluxo 4 chama `conclude_finished_jobs()` sem filtro (linha 46) — conclui/encerra qualquer vaga vencida do staging, não só a do teste (mesma causa do AUD-178, agora no E2E); (2) `limpeza.ts` engole erros (`.catch(() => undefined)`) e imprime "N contas de teste apagadas" mesmo quando nenhuma foi apagada; (3) o estado entre fluxos fica em `e2e/resultados/estado.json` e nada o apaga antes da próxima execução local (`estado()` reaproveita o arquivo; só `globalTeardown`, sem `globalSetup`); (4) cada execução dispara 3 e-mails reais (2 confirmações de cadastro e 1 recuperação de senha) para a caixa `nivotech.dev+e2e-…@gmail.com`, usando a cota do Brevo.
- Impacto: o staging acumula registros de auditoria falsos e o E2E pode alterar vagas de exemplo usadas por outras pessoas; erros de limpeza passam em silêncio.
- Causa raiz: a limpeza apaga contas (cascata) mas não o log de equipe; a conclusão por cron global foi usada como atalho para "o tempo passa".
- Correção recomendada: usar `conclude_finished_jobs` com filtro (como sugerido no AUD-178) ou conferir só a vaga do teste; no `limpeza.ts` contar sucessos e falhar (ou avisar) se algum `deleteUser` der erro, e apagar `staff_actions` das contas do teste pela service_role; `globalSetup` que apaga `estado.json`.
- Critério de aceite: depois de uma execução, `select count(*) from staff_actions` volta ao valor de antes; a limpeza sai com erro se uma conta não foi apagada.
- Dependências: AUD-178
- Origem: O2-005 (O2)

### AUD-192 — Os testes Vitest não restauram globais/ambiente sozinhos: uma asserção que falha contamina os testes seguintes

- Área: testes
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (verificado por leitura; as execuções com ordem embaralhada passam enquanto nada falha)
- Onde: `web/vite.config.ts` (`test:` sem `unstubGlobals`, `unstubEnvs`, `restoreMocks`); `web/src/__tests__/remote.test.ts:655,931,1030,1230,1242,1311,1489` (cada `vi.stubGlobal/stubEnv` é desfeito na última linha do próprio teste); o `describe('remote: data and actions', …)` (linhas 503-1333) não tem `afterEach`; `firebaseSignIn.test.ts:93` (tem `afterEach`, bom)
- Prova: em `remote.test.ts` os testes de pagamento fazem `vi.stubEnv('VITE_PAGAMENTOS','mercadopago')` (1193) e só chamam `vi.unstubAllEnvs()` na linha 1230, depois de 8 `expect`; se um deles falhar, `FEATURES.payments` fica ligado para o teste 1233 (que espera desligado) e para `fetch`/`navigator` dos seguintes. Há também esperas por relógio: `setTimeout(r, 40)` (1073), `setTimeout(r, 0)` ×4 (974, 1100, 1419, 1420), e um teste com `.catch(() => undefined)` (1444). Resultado das execuções: com 5 sementes de `--sequence.shuffle`, 2 repetições, 5 fusos e 2 combinações embaralhado+fuso, os mesmos testes passam ou falham pelo mesmo motivo (AUD-127) — não achei dependência de ordem hoje.
- Impacto: quando um teste real quebrar, aparecerão vários vermelhos de causa única, escondendo o culpado.
- Causa raiz: limpeza manual no fim do teste em vez de `afterEach`/opção do runner.
- Correção recomendada: `test: { unstubGlobals: true, unstubEnvs: true, restoreMocks: true }` no `vite.config.ts` e trocar as esperas fixas por `vi.waitFor`.
- Critério de aceite: forçar uma falha no meio do teste de pagamento não derruba o teste 1233.
- Dependências: nenhuma
- Origem: O2-006 (O2)

### AUD-193 — Asserções frouxas, ramos condicionais e um arquivo com nome enganoso

- Área: testes
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/src/__tests__/supabase.test.ts:187-196`; `contacts.test.ts:105-106`; `services.test.ts:404`; `applications.test.ts:304-308`; `remote.test.ts:975,1444`; `utils.parity.test.ts:1-3`; `address.test.ts:70`
- Prova: (1) `supabase.test.ts:195` `expect(typeof typed).toBe('function')` é só um marcador: o `expectTypeOf` dentro de `typed` nunca roda (só o `tsc` o vê); (2) `contacts.test.ts:106` `if (!app) return;` — o teste W09 passa sem afirmar nada se a semente deixar de ter candidatura aprovada; (3) `services.test.ts:404` `if (other) expect(...)`; (4) `applications.test.ts:305` a verificação Y02 ("só a partir do dia") está dentro de `if (start > hoje)` — hoje roda (a semente BC-4995 começa em hoje+3: confirmado com sonda em 29/10), mas some sem aviso quando a semente mudar; (5) `remote.test.ts:975` `toBeTruthy()` no `readAt`; contagem geral: `toBeTruthy` 4, `toBeDefined` 4, `toBeGreaterThan(0)` 7; (6) `remote.test.ts:1444` o `completeGoogleSignUp` falha em silêncio (`.catch(() => undefined)`) e o teste só olha as chamadas anteriores. Nenhum `skip/only/todo` no repositório (verificado por busca). O arquivo `utils.parity.test.ts` se chama "paridade", mas desde a limpeza de 26/10 os valores são fixos e não há mais o app antigo para comparar (cabeçalho do arquivo): ainda servem como teste de regressão de máscaras, dinheiro e datas (são correspondências exatas, nada gerado em tempo de execução), mas o nome promete uma comparação que não existe, e o conjunto de CPF/CNPJ (`:101-110`, 3 CPFs e 2 CNPJs válidos) não é o mesmo conjunto usado nos testes SQL `cpf_valid/cnpj_valid` e no gerador do E2E (`apoio.ts:101-127`) — são três implementações sem vetores em comum.
- Impacto: pequeno; os testes parecem cobrir mais do que cobrem.
- Causa raiz: —
- Correção recomendada: trocar `if (...) return` por `expect(app).toBeDefined()` + falha explícita; renomear para `format.test.ts`; criar uma tabela única de vetores de CPF/CNPJ (JSON) lida pelo Vitest, pelo E2E e colada no teste SQL.
- Critério de aceite: nenhum `if` envolvendo `expect`/`return` precoce nos testes; um conjunto de vetores usado nas três camadas.
- Dependências: nenhuma
- Origem: O2-007 (O2)

### AUD-194 — O harness dos testes SQL: `fails()` só confere o SQLSTATE e `run.mjs` sai com 0 sem `DATABASE_URL`

- Área: testes
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/tests/_helpers.sql:84-98`; `web/supabase/tests/run.mjs:41-44`; `.github/workflows/web.yml:124-127`
- Prova: (1) `pg_temp.fails(sql, sqlstate)` compara só o código: dos 194 usos, 26 esperam `BC409`, 56 `BC422`, 19 `BC401`, 76 `42501`; só 4 linhas de todo o diretório conferem `sqlerrm`. Como um mesmo `BC409` vale para "vaga cheia", "prazo vencido", "já candidatou", "tem equipe", um teste pode continuar verde porque outra regra recusou (ex.: `z01_candidaturas.sql:107,138` esperam `BC409` para motivos diferentes). (2) `run.mjs` sem `DATABASE_URL` só imprime o SQL e `process.exit(0)` (linhas 41-44, 57): se a variável vier vazia no CI, o passo "Testes SQL" fica verde sem rodar nada; (3) `strip()` tira qualquer linha `begin;`/`rollback;` mas nada impede um `commit;` (hoje nenhum arquivo tem). O que está certo, provado: executei `ok`/`fails` num Postgres embutido (PGlite, `comandos.md`): `ok(false)` e `ok(NULL)` falham; `fails` falha quando o SQL tem sucesso, quando dá outro SQLSTATE; o `run.mjs` conta falha se o `psql` sair ≠ 0 ou se faltar o marcador final.
- Impacto: a rede de segurança do banco é mais frouxa do que o número de asserções (368 `ok`, 194 `fails`) sugere.
- Causa raiz: —
- Correção recomendada: `fails(sql, sqlstate, trecho_da_mensagem default null)` e usar nos testes de BC409/BC422; em `run.mjs` sair 2 se `DATABASE_URL` vazio e `CI=true`; recusar arquivo com `commit`.
- Critério de aceite: teste que muda a regra recusante e mantém o código passa a falhar.
- Dependências: AUD-177, AUD-177 (cobertura negativa que falta)
- Origem: O2-009 (O2)

### AUD-197 — `seguranca.sql` e a documentação afirmam proteção que não existe mais (endereço, nota, selo, impulso "não saem por select")

- Área: testes
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/tests/seguranca.sql:1-2,21-22` (cabeçalho "nenhuma conta comum lê … endereço da obra"; teste de `get_job_addresses` = 0 linhas); `CLAUDE.md` §4 "grants por coluna (WhatsApp, endereço, documento, nota, selo e impulso não saem por `select`)"; `web/docs/SUPABASE.md:51-53` ("não saem nem mudam por select/update")
- Prova: no staging `rating`, `review_count`, `verified`, `identity_status`, `boost_ends_at` e (desde U53) `cep,street,number,complement,lat,lon` estão no `select` de `authenticated` (consulta de `has_column_privilege`); só WhatsApp (workers/companies), `document_hash`/`document_cipher`, `suspended_reason`, `cnpj_check`, `identity_reason`, `hidden_*` ficam fechados. O teste de `get_job_addresses` passa mesmo com o endereço aberto por `select`, então não protege nada.
- Impacto: quem confia no teste/doc acredita que o endereço está fechado; uma regressão em colunas realmente sensíveis pode passar despercebida.
- Causa raiz: U53 mudou o grant sem atualizar teste/doc; nota/selo/impulso nunca foram escondidos do `select` (são exibidos), eles só não podem ser ALTERADOS.
- Correção recomendada: reescrever o cabeçalho e a asserção do teste (colunas realmente fechadas: `whatsapp`, `document_*`, `hidden_*`, `cnpj_check`, `identity_reason`, `suspended_reason`; colunas que não podem ser alteradas: `rating`, `verified`, `boost_ends_at`…) e corrigir CLAUDE.md/SUPABASE.md.
- Critério de aceite: o teste falha se alguma dessas colunas fechadas virar legível por `authenticated`/`anon`.
- Dependências: AUD-002 (se o endereço voltar a fechar, o teste atual volta a fazer sentido).
- Origem: D1-002 (D1)

## Área: segurança (10)

### AUD-056 — Nenhum teto de arquivos por conta no Storage (plano Free: 1 GB)

- Área: segurança
- Severidade: S3 baixo
- Esforço: M
- Confiança: provável (política e limites lidos no catálogo; envio em massa não executado)
- Onde: `storage.buckets` e `storage.objects` do staging e da produção (idênticos): `portfolio` 50 MB por arquivo, `avatars`/`vagas`/`identidade` 10 MB; políticas de INSERT só conferem a pasta `<uid>/` e o lado da conta
- Prova: `select id, file_size_limit, allowed_mime_types from storage.buckets` e `pg_policies` de `storage.objects` (sem contagem nem cota). A limpeza diária só apaga o que não está em uso depois de 1 dia e, na produção, ainda está desligada (`CLEANUP_SECRET` pendente, CLAUDE.md §4).
- Impacto: uma conta grátis pode encher o armazenamento (vídeo de 50 MB repetido ~20 vezes basta) e fazer o envio de fotos falhar para todo mundo.
- Causa raiz: o Supabase Storage não tem cota por usuário e o banco só valida pasta e tipo.
- Correção recomendada: gatilho em `storage.objects` (ou RPC de envio) que limite N arquivos por pasta; reduzir o limite de vídeo; ligar a limpeza na produção.
- Critério de aceite: o 21º arquivo da mesma pasta é recusado.
- Dependências: "ação do responsável" para ligar `CLEANUP_SECRET` (produção).
- Origem: D1-007 (D1)

### AUD-058 — Bloquear uma conta não corta contato nem contratação já aprovada

- Área: segurança
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: `DECISOES.md:849-850` diz que contratação já confirmada não é desfeita pelo bloqueio (existem cancelar e desistir). Resíduo: a empresa bloqueada ainda avança de `pre_selecionado` para `contratar`. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261013000400_f04_denuncia_bloqueio.sql:74` (`block_account` só apaga `enviada/em_analise` e convites); `get_contact` e `transition_application` não consultam `blocked_between`
- Prova: trabalhador aprovado bloqueia a empresa → status segue `pre_selecionado`; a empresa bloqueada ainda lê o contato (nome + 11 dígitos) e ainda consegue `contratar`.
- Impacto: quem se sente ameaçado bloqueia e continua exposto.
- Causa raiz: o bloqueio só limpa o que ainda não foi aprovado.
- Correção recomendada: `block_account` cancela também pre_selecionado/contratado (ação do sistema, reabre a vaga como na R03) e `get_contact`/`transition_application` recusam com BC404 se `blocked_between`.
- Critério de aceite: após bloquear, `get_contact` e `contratar` falham.
- Dependências: nenhuma
- Origem: D2-004 (D2); também reportado por: D3b-001
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3b-001 (S2): Bloquear conta não corta o contato: `get_contact` segue devolvendo o WhatsApp dos dois lados — onde: `migrations/20261013000400_f04_denuncia_bloqueio.sql:74-94` (`block_account` só apaga enviada/em_analise); `get_contact` vigente (`migrations/20261017000100_r03_suspensao_completa.sql:103-138`) sem `blocked_between`

### AUD-059 — Leituras sem checar vínculo: `worker_track_record`, `job_stats` e erro que revela candidatura

- Área: segurança
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/supabase/migrations/20261013000200_f10_perfil_profissional.sql:26`, `…z01_rpcs_candidatura.sql:71`, `…u48_publico_geral.sql:522` (`transition_application` busca a candidatura antes de conferir o dono)
- Prova: empresa sem relação: `worker_track_record(array[w])` → 1 linha (faltas/desistências); trabalhador estranho lê `holding=1 pending=0 total=1` de vaga alheia; estranho chamando `transition_application` recebe BC401 se a candidatura existe e BC404 se não (descobre quem se candidatou onde, sabendo o uuid).
- Impacto: o histórico de faltas de qualquer trabalhador fica visível a qualquer empresa.
- Causa raiz: as funções não conferem vínculo antes de devolver dado.
- Correção recomendada: restringir a candidatos das vagas da empresa; `job_stats` só do dono; conferir o dono antes de ler a candidatura.
- Critério de aceite: empresa estranha → 0 linhas / mesmo BC401 nos dois casos.
- Dependências: nenhuma
- Origem: D2-008 (D2)

### AUD-062 — Auditoria da equipe mutável e com lacunas

- Área: segurança
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado
- Onde: `migrations/20261015000100_lanc06_backoffice.sql:27-40,65-83,517-519`
- Prova: `pg_trigger` em `staff_actions` vazio; `staff_id … on delete set null`; `add/remove_staff_member`, `set_identity_status` e `set_company_verification` chamadas direto não gravam; abrir selfie/documento (policy + URL assinada) não deixa rastro de quem abriu.
- Impacto: a trilha de auditoria pode ser alterada e não prova quem viu documentos.
- Causa raiz: sem gatilho de imutabilidade e sem registro nos caminhos diretos.
- Correção recomendada: gatilho que recusa update/delete, guardar o e-mail da pessoa, registrar entrada/saída da equipe e abertura de foto. Ver AUD-070 e AUD-079.
- Critério de aceite: update/delete em `staff_actions` falha; abrir um documento gera linha.
- Dependências: AUD-070
- Origem: D3b-004 (D3b)

### AUD-063 — Papel admin × moderador não faz diferença

- Área: segurança
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261015000100_lanc06_backoffice.sql` (`is_staff`, `staff_guard`, `add_staff_member`)
- Prova: `grep moderador` só acha a coluna e `add_staff_member`; `is_staff`/`staff_guard` só veem se a linha existe.
- Impacto: um moderador suspende, decide identidade e lê o log como se fosse admin. (Mesmo problema de D2-015.)
- Causa raiz: o papel nunca é lido.
- Correção recomendada: usar o papel nas RPCs ou remover a coluna.
- Critério de aceite: teste de papel.
- Dependências: nenhuma (consolidar com D2-015)
- Origem: D3b-005 (D3b); também reportado por: D2-015
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D2-015 (S3): Papéis da equipe sem efeito — onde: `staff_members.role` ('admin'|'moderador') não é lido por nenhuma das 176 funções; `staff_guard` só pergunta `is_staff()`; `company_members` (F18) é preenchida por gatilho mas nenhuma RPC/política a usa (`my_company_id()` = `accounts.company_id`)

### AUD-065 — Produção roda Edge Functions de antes do L05: captcha passa sem segredo, CORS cai para "*", 2 funções nem existem

- Área: segurança
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: a produção não está no ar e `CLAUDE.md`/`SUPABASE.md` já dizem que as funções estão na versão anterior; só republicam com 'pode'. Vira S3 de pré-lançamento (republicar antes de abrir).
- Esforço: P
- Confiança: confirmado
- Onde: produção `ppnxdajiihsjaojxokzh` (get_edge_function: `entrar-com-documento` v2, as outras 7 em v1, todas de 09–12/10); repo `web/supabase/functions/_shared/{captcha,http,monitoring}.ts`; `web/docs/SUPABASE.md:28,93`; `CLAUDE.md` §4 ("todas publicadas")
- Prova: `list_edge_functions` na produção devolve 8 funções (faltam `verificar-cadastro` e `entrar-com-firebase`; o staging tem as 10, versões 81–151). Código publicado em `_shared/captcha.ts`: `const secret = Deno.env.get('TURNSTILE_SECRET'); if (!secret) return true;` (o repo recusa: `captcha.ts:12-16`). `_shared/http.ts` publicado: `'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*'` (o repo exige APP_ORIGIN: `http.ts:12-20`). `enviar-push` publicado: `VAPID_SUBJECT ?? 'mailto:[e-mail pessoal da equipe]'` (e-mail pessoal vai ao serviço de push; o repo já removeu). `_shared/monitoring.ts` publicado sem o scrub de JWT/token (o do repo tem). Se `TURNSTILE_SECRET` não existir nos Secrets da produção (CLAUDE.md §4 diz "Turnstile desligado"), `entrar-com-documento` aceita login sem captcha, só com o limite 5/documento e 20/IP. Também o staging está atrás do commit auditado: `verificar-cadastro` v103 (publicada em 24/10, do `master` em 5bddd2c) não tem o captcha do X32 (`cadastro-desafio-ip` não aparece no código publicado), porque o staging é publicado a partir do `master` e X30–X32 estão só na branch de auditoria.
- Impacto: no dia em que a produção abrir ao público, o login por CPF/CNPJ não tem captcha e as funções aceitam chamada de qualquer site; o cadastro não tem a checagem de "já existe conta" nem o login do Google/celular, que o app novo espera.
- Causa raiz: publicação em produção só com "pode" e nunca feita depois da rodada L05–X32; não há checagem automática da defasagem; a doc diz "todas publicadas".
- Correção recomendada: no lançamento, na ordem: (1) segredos (`APP_ORIGIN`, `TURNSTILE_SECRET`, `FIREBASE_PROJECT_ID`…), (2) publicar as 10 funções do `master` (`supabase functions deploy`, as sem JWT com `--no-verify-jwt`), (3) conferir com `get_edge_function`. Corrigir `SUPABASE.md` §4 e `CLAUDE.md` ("todas publicadas" é falso para 2). Incluir no CI/staging um passo que compare a lista de funções do repo com a do projeto.
- Critério de aceite: `list_edge_functions` na produção lista as 10 funções com `verify_jwt` igual à tabela de `SUPABASE.md` §4; chamada sem token do captcha a `entrar-com-documento` devolve 400 `captcha`; chamada com `Origin` estranho não recebe `Access-Control-Allow-Origin` dele.
- Dependências: ação do responsável (Turnstile, Firebase, domínio final em APP_ORIGIN); "pode" para publicar.
- Origem: D4-002 (D4)

### AUD-066 — Notificação por push: endpoint de inscrição é qualquer `https://…` (SSRF cego) e o clique abre URL absoluta

- Área: segurança
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: RPC `save_push_subscription` (só valida `^https://` e tamanho); `web/supabase/functions/enviar-push/index.ts:84-90`; `web/public/push-sw.js:25`
- Prova: qualquer conta logada grava `https://qualquer-host/...` (inclusive hosts internos ou lentos) e `webpush.sendNotification` faz POST nele a cada aviso daquela conta (a conta provoca avisos para si, p. ex. candidatando-se); 404/410 apagam a inscrição, o que revela ao dono se o alvo respondeu assim. O `web-push` também não tem `timeout` configurado (AUD-200). No service worker, `new URL(data.url.replace(/^\//,''), scope)` aceita `https://outro-site` como URL absoluta e `clients.openWindow` abre. Hoje o `url` vem de `notifications.target` gerado pelo banco, então depende de outro erro para ser explorado.
- Impacto: baixo hoje; vira um ponto de partida para varredura de rede a partir do IP do Supabase e para abrir sites de terceiros se algum `target` vier de texto de usuário.
- Causa raiz: sem lista de serviços de push conhecidos; o SW confia no campo.
- Correção recomendada: na RPC e na função, aceitar só hosts de push conhecidos (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`, `*.push.apple.com`, `web.push.apple.com`); no SW, recusar `url` cuja origem difira de `self.location.origin`; passar `timeout` ao `web-push`.
- Critério de aceite: `save_push_subscription('https://169.254.169.254/x',…)` falha com BC422; SW com `url:'https://evil.test'` abre `/`.
- Dependências: nenhuma.
- Origem: D4-009 (D4)

### AUD-067 — Entrar por celular (Firebase) abre a conta pelo WhatsApp digitado no cadastro, mesmo sem confirmação do número

- Área: segurança
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `web/supabase/functions/entrar-com-firebase/index.ts:74-87`
- Prova: no ramo `phone`, a conta é achada por `.eq('whatsapp', phone).not('email_confirmed_at','is',null)` sem exigir `whatsapp_verified_at`; depois a função grava `whatsapp_verified_at = now()` na conta. Com o código do WhatsApp desligado (Twilio, `CLAUDE.md` §4), nenhum número de conta foi comprovado. Quem tem o telefone digitado por engano por outra pessoa, ou um número reciclado pela operadora, recebe a sessão daquela conta (nome, candidaturas, contatos liberados).
- Impacto: raro, mas é acesso a conta de terceiro por coincidência de número, e o servidor ainda aceita o caminho mesmo sem botão (basta o provedor Telefone estar ligado no Firebase e o SMS do Brasil liberado).
- Causa raiz: a prova do SMS vale no momento do login, mas o vínculo número→conta não foi provado.
- Correção recomendada: exigir `whatsapp_verified_at is not null` no ramo de celular (ou manter o ramo desligado por padrão até o código do WhatsApp ser obrigatório).
- Critério de aceite: teste com token `phone` e conta com `whatsapp_verified_at` nulo → 404 `sem-conta`.
- Dependências: ação do responsável (decidir quando ligar SMS/Twilio).
- Origem: D4-010 (D4)

### AUD-068 — No servidor a senha só precisa de 8 caracteres de qualquer tipo; "letras e números" e a checagem de senha vazada não existem lá

- Área: segurança
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (configuração lida no script; o painel não pôde ser lido)
- Onde: `web/scripts/configurar-auth.mjs:39` (`password_min_length: 8`, sem `password_required_characters`); `web/docs/SUPABASE.md:78-79`; `get_advisors` (WARN `auth_leaked_password_protection` na produção e no staging)
- Prova: o script de Auth só fixa o tamanho mínimo; o advisor confirma a proteção contra senha vazada desligada nos dois projetos. A regra "pelo menos 8 caracteres, com letras e números" (mensagem de `auth.ts:432`) vive no app: quem chama `/auth/v1/signup` ou `updateUser` direto com a chave pública (o app roda no navegador, logo a chave é pública) pode criar `12345678`.
- Impacto: contas com senha trivial entram na base sem passar pelo app; junto com AUD-005 (limites burláveis) facilita adivinhar senha por e-mail.
- Causa raiz: regra de senha só no cliente.
- Correção recomendada: incluir `password_required_characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789'` no `configurar-auth.mjs`; ligar a proteção contra vazadas quando houver plano Pro.
- Critério de aceite: `POST /auth/v1/signup` com `aaaaaaaa` devolve `weak_password`.
- Dependências: ação do responsável (plano Pro para a parte de vazadas).
- Origem: D4-013 (D4)
- Revisão adversária: Cético B: parcialmente decisão documentada (proteção de senha vazada exige Pro, ADVISORS.md); resta só a regra 'letras e números' valer apenas no cliente.

### AUD-140 — Login por CPF/CNPJ: a resposta demora 140 vezes mais quando o documento existe, e 5 pedidos travam o login por documento de qualquer pessoa

- Área: segurança
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (medido no staging; o efeito de ponta a ponta pela rede não foi medido)
- Onde: RPC `document_login_email` (staging); `web/supabase/functions/entrar-com-documento/index.ts:43-56`; `web/docs/DECISOES.md:319-340` (Z07)
- Prova: a RPC sai logo quando não acha o documento e só roda `crypt()` (bcrypt) quando acha. Medido no staging (bloco `do $$` que termina em `raise exception`, nada gravado): sem conta 0,55 ms por chamada; bcrypt de conta existente 77,84 ms por chamada. A Z07 promete "Ninguém descobre quem tem conta pelo CPF/CNPJ" com uma resposta só, mas o tempo entrega a informação (diferença de dezenas de ms é medível com poucas repetições; o limite é 20 por IP, burlável pelo AUD-005). Além disso, o contador 5-por-documento (linhas 44-45) conta a tentativa de qualquer pessoa: 6 pedidos com captcha em 15 minutos deixam "muitas-tentativas" para o dono do CPF, e `rate_limit_hit` insere antes de contar, então quem continua tentando mantém o bloqueio. O dono ainda entra por e-mail. (O hash sem segredo das chaves do contador é o mesmo problema do AUD-019.)
- Impacto: baixo hoje, porque U10 já responde sim/não ao mesmo dado (`verificar-cadastro`). Mas a doc afirma o contrário, e um atacante pode atrapalhar o login por documento de uma pessoa específica.
- Causa raiz: a RPC retorna cedo; o contador é por valor sem distinguir quem pede.
- Correção recomendada: na RPC, fazer um `crypt()` contra um hash fixo falso quando a conta não existe (tempo igual); contar tentativas FALHAS por documento+IP (não só por documento); atualizar a Z07 dizendo que U10 abriu essa informação de propósito.
- Critério de aceite: 50 chamadas de cada tipo medidas pela função têm medianas dentro de 10% uma da outra.
- Dependências: AUD-005.
- Origem: D4-006 (D4)

## Área: processo (9)

### AUD-092 — Textos legais mudaram em 21/10 sem mudar `version` nem `updatedAt` (continuam "2.0 / 15/10/2026")

- Área: processo
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: web/src/services/legal.ts:26-27, :101-102, :206; commits d065387 (U48), aa87ea2 (U51), a5c76d7 (U53)
- Prova: `git log -p -- web/src/services/legal.ts | grep -E "^[+-]\s+(version|updatedAt):"` só mostra a criação (`version: '2.0'`, `updatedAt: '2026-10-15'`); os três commits de 21/10 alteraram o corpo (dados de endereço, endereço visível a quem tem conta, "público geral") sem tocar esses campos. Além disso `TERMS_VERSION = TERMS.version` (l.206) é o único campo que dispara novo aceite; `PRIVACY.version` pode divergir sem efeito.
- Impacto: hoje sem efeito (4 contas de teste, textos ainda "rascunho"). Depois do lançamento, uma mudança de texto sem bump não pede novo aceite e a data mostrada ("atualizada em 15/10/2026") fica falsa.
- Causa raiz: a versão é manual e nada no CI liga mudança de texto a bump.
- Correção recomendada: fixar versão/data na revisão do advogado; teste que guarda um hash do corpo + versão (falha se o corpo muda e a versão não); usar `max(TERMS.version, PRIVACY.version)` ou exigir que sejam iguais.
- Critério de aceite: o teste legal falha ao editar um parágrafo sem mudar `version`.
- Dependências: ação do responsável (advogado) para o texto final.
- Origem: C2-004 (C2)
- Revisão adversária: Cético B: decisão documentada (`DECISOES.md:2152-2154`: 'a versão não mudou… quando o advogado revisar, decidir se sobe a versão').

### AUD-139 — Alerta de cron não enviado ao Sentry conta como "já alertado" por 24 h e nunca é reenviado

- Área: processo
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261016000300_lanc12_vigia_cron.sql:124-131` (o dedupe ignora `sent`)
- Prova: a produção não tem `bicos_sentry_dsn` nem `bicos_heartbeat_url` (count = 0), então cada falha vira linha `sent=false` que silencia o dia seguinte.
- Impacto: uma rotina quebrada (como a limpeza de identidades, AUD-006) fica meses sem ninguém saber.
- Causa raiz: o dedupe considera tentativas não enviadas.
- Correção recomendada: dedupe só entre `sent=true` e reenviar as pendentes.
- Critério de aceite: com DSN ausente e depois configurado, o alerta pendente é enviado.
- Dependências: ação do responsável (criar DSN/heartbeat)
- Origem: D3b-006 (D3b)

### AUD-143 — Sem versão mínima: o app aberto em segundo plano pode ficar semanas na versão antiga falando com RPCs novas

- Área: processo
- Severidade: S3 baixo
- Esforço: M
- Confiança: provável (lido; ciclo do SW não simulado)
- Onde: `vite.config.ts:103` (`registerType:'prompt'`); `src/services/pwa.ts:14-22`; `dist-demo/sw.js` (`skipWaiting` só em `message`); a decisão de pedir confirmação é boa (`DECISOES.md:909`), falta a rede de segurança
- Prova: a atualização depende do toque em "Atualizar" (aviso de 24 h) ou de fechar todas as janelas. Não há `min_version` em `app_config` nem versão enviada ao servidor. O banco muda por migration (`feed_jobs` ganhou parâmetros em `lanc13`/`u65`).
- Impacto: depois de mudar uma RPC, parte dos usuários vê erro genérico até atualizar.
- Causa raiz: sem contrato de versão entre app e banco.
- Correção recomendada: `min_web_release` em `app_config`; se o `RELEASE` do app for menor, mostrar "Atualize para continuar" e chamar `update(true)`; no mínimo, `registration.update()` quando o app volta ao primeiro plano depois de > 24 h.
- Critério de aceite: com `min_web_release` maior, a tela de atualização aparece e um toque recarrega na versão nova.
- Dependências: nenhuma
- Origem: Q1-017 (Q1)

### AUD-180 — Os artefatos do E2E (relatório e rastros do Playwright) ficam em repositório público, sem retenção curta

- Área: processo
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `.github/workflows/web.yml:198-207` (também sobe `web/e2e/resultados/artefatos`); `.github/workflows/staging.yml:193-200` (sobe `web/e2e/resultados/relatorio`); `web/e2e/playwright.config.ts` (`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`)
- Prova: o repositório é público (`private: false`). Existem artefatos `e2e-staging` não expirados de 4–5,4 MB (dias 22 e 24/10), contra ≈1 MB nos runs verdes: indica anexos de falha. O relatório HTML do Playwright e os `trace.zip` guardam cabeçalhos `Authorization`, o corpo de `/auth/v1/token` (com `refresh_token`), e-mails das contas de teste (base `nivotech.dev+…@gmail.com`) e capturas de tela. Não foi possível baixar para confirmar o conteúdo (o download passa pelo Azure Blob, bloqueado pelo proxy).
- Impacto: qualquer pessoa logada no GitHub pode baixar tokens de contas de teste e o e-mail pessoal do sócio. As contas de teste são apagadas no teardown, o que limita o dano, mas o e-mail e os dados de tela ficam.
- Causa raiz: artefatos de teste tratados como privados num repositório público.
- Correção recomendada: `retention-days: 3`; subir só o resumo (sem `artefatos`/trace) em repositório público; `trace: 'off'` ou `'on-first-retry'` com mascaramento; usar um e-mail de projeto em `E2E_EMAIL_BASE`.
- Critério de aceite: nenhum artefato público contém `trace.zip`; `retention-days` definido nas duas ações.
- Dependências: nenhuma (relacionado a AUD-082)
- Origem: HUNT-006 (HUNTER)

### AUD-185 — O `--mostrar` do configurar-auth.mjs não mostra o estado atual, mas o roteiro usa isso como "desfazer" do Auth

- Área: processo
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: procede (`configurar-auth.mjs:90-97` só imprime o que enviaria), mas é erro de documentação num roteiro ainda não executado; o estado atual é recuperável pelo painel. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `web/scripts/configurar-auth.mjs:10,90-103`; `web/docs/IMPLANTACAO.md:96`
- Prova: IMPLANTACAO:96 "Desfazer: configurar-auth.mjs com os valores anteriores (o --mostrar antes de aplicar imprime o estado atual)". No script, `--mostrar` (:97) só imprime o objeto `config` que SERIA enviado (:90-96); não há `GET /v1/projects/<ref>/config/auth` em lugar nenhum e o `PATCH` (:99-103) sobrescreve Site URL, uri_allow_list, SMTP, templates e captcha sem guardar o que havia.
- Impacto: erro na configuração do Auth da produção (Site URL, SMTP, captcha) derruba cadastro e login para todos e não há como voltar ao estado anterior.
- Causa raiz: o script grava mas nunca lê.
- Correção recomendada: antes do PATCH fazer `GET …/config/auth`, salvar em arquivo fora do repositório (a API não devolve segredos) e imprimir o diff "atual → novo"; documentar que o rollback é reaplicar esse arquivo.
- Critério de aceite: `--mostrar` com token imprime atual → novo por campo; o roteiro cita o arquivo de backup.
- Dependências: nenhuma (ponto bom no mesmo script: recusa produção sem `CONFIRMO_PRODUCAO=sim`, :25)
- Origem: O1-007 (O1)

### AUD-186 — O "backup manual antes de qualquer mudança" do X30 é uma frase: sem script, sem teste de restauração e sem cópia da chave que decifra os CPFs

- Área: processo
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: backup manual antes de mexer na produção é decisão X30 e o IMPLANTACAO §1 trava o início com 'Plano Pro + backup manual'; a produção tem 4 contas e 0 vagas. Ensaio de restauração e cópia da chave do Vault são melhoria antes do lançamento. Rebaixado para S3.
- Esforço: M
- Confiança: confirmado (ausência); consequência sobre o Vault em "Hipóteses"
- Onde: `web/docs/DECISOES.md:2488-2495`; `web/docs/IMPLANTACAO.md:9-19,143-146`; `web/scripts/exportar-app-antigo.sh:17-21`; `web/docs/LGPD.md:65`
- Prova: `ls web/scripts` não tem script de backup da produção; exportar-app-antigo.sh só exporta as 7 tabelas do app antigo. O único comando está em IMPLANTACAO:14 (`pg_dump -Fc` com a senha dentro da URL) e a "conferência" (:19) é `pg_restore -l | head` — lista, não restaura. Nenhum documento manda guardar `nivotech_documento_key` fora do Vault (LGPD.md:65 só diz "não pode ser apagada"); sem ela `accounts.document_cipher` é ilegível. O arquivo do exportar-app-antigo.sh tem dados pessoais e é criado com a permissão padrão (sem `umask 077`, :20).
- Impacto: se uma migration destrutiva (u32, u63, u12) der errado no Free (sem backup diário), a restauração nunca foi ensaiada e pode não recuperar os documentos.
- Causa raiz: o X30 trata backup como regra de conduta, não como procedimento verificável.
- Correção recomendada: `scripts/backup-producao.sh` (pg_dump + data/hora + `umask 077` + conferência de tamanho), ensaio de restauração no staging registrado em documento, e registrar onde a chave do documento fica guardada fora do Supabase (cofre dos sócios).
- Critério de aceite: o roteiro chama o script; existe registro "restaurado no staging em <data>, N tabelas, CPF decifrado ok".
- Dependências: ação do responsável (cofre; decisão Pro do X30)
- Origem: O1-009 (O1)

### AUD-187 — Dependências e actions: 9 vulnerabilidades em ferramentas de desenvolvimento sem `npm audit` no CI, sem Dependabot, actions por tag, Node 22 abaixo do que o Firebase pede

- Área: processo
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `.github/workflows/web.yml` (sem audit; `uses: …@v4`); `web/package.json:25-26`; `.github/` (sem `dependabot.yml`); `web.yml:101`
- Prova: `npm audit` (cópia de package.json+lock): 9 vulnerabilidades (1 baixa, 3 moderadas, 3 altas, 2 críticas): tinypool (crítica, gadget de RCE no executor do vitest), vite 7.0–7.3.6 (alta; servidor de desenvolvimento), source-map-js, zod, serialize-javascript, fast-uri, postcss-selector-parser, @vitest/mocker. `npm audit --omit=dev` = 0 (`f1/audit.log`): nada disso vai ao usuário. `npm audit fix` resolve a maioria sem quebrar. Actions por tag (checkout@v4, setup-node@v4, upload-artifact@v4, setup-deno@v2, deploy-pages@v4), não por SHA. `npm ci` (`f1/npm-ci.log`) avisa EBADENGINE: @firebase/app@0.16.3 e @firebase/auth@1.13.7 pedem Node >=24.12.0; o CI usa Node 22; sem `engines` nem `.nvmrc`. O axe é instalado fora do lock (web.yml:101). web.yml e staging.yml não declaram `permissions:`.
- Impacto: baixo hoje; vira dívida porque nada avisa quando uma dependência de produção ganhar uma falha.
- Causa raiz: sem rotina de atualização nem verificação automática.
- Correção recomendada: passo `npm audit --omit=dev --audit-level=high` no CI; Dependabot semanal (npm e actions); `permissions: contents: read` nos 2 workflows; `engines`/`.nvmrc` coerentes com o Firebase.
- Critério de aceite: CI falha com dependência de produção vulnerável; `npm ci` sem EBADENGINE.
- Dependências: nenhuma
- Origem: O1-013 (O1)

### AUD-188 — Scripts de deploy: a trava de produção do deploy.sh é uma variável de ambiente, publica o que está no disco e não confere que o build é o da produção

- Área: processo
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/scripts/deploy.sh:17-19,23-24,27,33`; `web/scripts/sentry-sourcemaps.mjs:21-25`; `web/scripts/staging/aplicar-banco.sh:19-21,71-75`; `web/scripts/exportar-app-antigo.sh:13-16,20`
- Prova: `deploy.sh producao` só exige `CONFIRMO_PRODUCAO=sim`; roda typecheck e `vite build` (sem lint/testes); a conferência "não é demonstração" (:27) aceita QUALQUER `https://x.supabase.co` — um `.env.production.local` apontando ao staging passa (IMPLANTACAO:106 pede conferir `ppnxdajiihsjaojxokzh` à mão); `wrangler … --commit-dirty=true` publica alterações não commitadas e o release do Sentry usa o HEAD, que então não corresponde ao código; nenhuma tag registra o que foi publicado. O Vite lê `.env.local` em qualquer modo e pode misturar valores se faltar chave no `.env.production.local`. `aplicar-banco.sh`: trava por texto em `STAGING_DB_URL` (:19-21); `STAGING_URL` não é conferido; cada migration roda com `psql -f` sem transação (:71) e só entra no histórico depois (:72) — falha deixa o staging pela metade (idempotência: AUD-137). exportar-app-antigo.sh grava dados pessoais sem `umask 077` (:20).
- Impacto: um deploy de produção pode sair do commit errado, com variáveis do staging ou sem testes.
- Causa raiz: scripts escritos para quem sabe o que faz.
- Correção recomendada: `deploy.sh producao`: `git status --porcelain` vazio, commit conferido, `npm run lint && npm test`, exigir o ref da produção no JS, tag `deploy-AAAAMMDD-HHMM`, `--commit-dirty=false`; `umask 077` no export.
- Critério de aceite: rodar com `.env.production.local` do staging aborta; árvore suja aborta.
- Dependências: AUD-053
- Origem: O1-016 (O1)

### AUD-201 — O checklist de lançamento não tem dono nem prazo em nenhum item, e o estado "feito/falta" está desatualizado

- Área: processo
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: 'Ação do responsável' já é o dono por desenho (CLAUDE.md §9); faltam prazos e há trechos velhos. Rebaixado para S3 (higiene de documentação).
- Esforço: P
- Confiança: confirmado
- Onde: `web/docs/CHECKLIST-LANCAMENTO.md` (linhas 18,20,47-48,77,83,139-140,223); `web/docs/DECISOES.md:2484-2501`; `web/docs/VOLUME.md:47`; `web/docs/TESTE-MANUAL.md`
- Prova: as tabelas têm só "Feito pela IA | Ação do responsável"; mais de 70 itens `[ ]` sem responsável nem data. Os gatilhos do X30 — "Pro antes de receber pessoas reais" (só um `[ ]` solto em :77), "advogado revisa" (:47-48,139-140) e "rotacionar o token" (não existe, ver AUD-023) — não têm prazo nem um critério único de "pronto para o público". Estado velho: :18 e :20 ainda pedem senha do banco e token do staging (os segredos existem: os runs passam); :223 diz "Falta (R08): funções no staging, Auth, site de teste, E2E 13/13, volume, teste manual" com o staging já tendo 67 migrations, funções, Auth e site; VOLUME.md:47 diz "o staging ainda não tem o banco montado"; TESTE-MANUAL.md tem a tabela de resultado vazia. Os `{{…}}` dos textos legais bloqueiam inclusive o piloto fechado (.env.example:43-46) e o pedido dos dados aos sócios (:139) não tem dono nem data (ver AUD-016).
- Impacto: ninguém sabe o que bloqueia o lançamento nem quem destrava.
- Causa raiz: o documento é registro de tarefas da IA, não lista de responsabilidades dos sócios.
- Correção recomendada: colunas "Dono" e "Até quando"; seção "Bloqueia o lançamento" no topo (Pro, advogado, dados da empresa, DNS, Brevo SPF/DKIM, Turnstile, Sentry/healthchecks, WhatsApp do suporte); marcar o que já foi feito; registrar a data do teste manual.
- Critério de aceite: cada `[ ]` com nome e data; o topo lista os bloqueadores e é a única definição de "pronto".
- Dependências: ação do responsável (decidir donos)
- Origem: O1-010 (O1)

## Área: banco (8)

### AUD-061 — `cpf_valid`, `cnpj_valid`, `document_valid_for`, `whatsapp_valid` executáveis por visitante

- Área: banco
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261011000300_y16_y17_documento.sql:157-158`, `migrations/20261011000600_y25_whatsapp.sql:138` (só `grant … to authenticated, service_role`, sem `revoke … from public, anon`); regra do CLAUDE.md §4/§6
- Prova: staging `has_function_privilege('anon', …)` = true nas 4 (as outras 59 funções da lista: false).
- Impacto: baixo (funções puras); o ponto é a regra "só `public_job_card` para anon" ficar falsa e haver RPC anônimo sem limite.
- Causa raiz: faltou o `revoke … from public`.
- Correção recomendada: `revoke execute … from public, anon`.
- Critério de aceite: consulta em `pg_proc` devolve só `public_job_card` para anon.
- Dependências: nenhuma
- Origem: D3a-005 (D3a)

### AUD-121 — Constraints `NOT VALID` do L11 nunca validadas

- Área: banco
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261012000300_l11_validacao_perfil.sql:4-13`
- Prova: staging `convalidated=false` em `workers_name_length` e `companies_name_length`; produção `count(*)` fora da regra: 0 de 1 worker e 0 de 3 companies.
- Impacto: uma linha antiga fora da regra faria edições sem relação falharem com 23514.
- Causa raiz: faltou o `validate constraint`.
- Correção recomendada: migration com `validate constraint` nas duas.
- Critério de aceite: nenhuma constraint `*_name_length` com `convalidated=false`.
- Dependências: nenhuma
- Origem: D3a-010 (D3a)

### AUD-124 — `submit_identity` aceita caminhos de arquivo que não existem, sem limite de tamanho, e o trabalhador fica "em análise" sem ter mandado selfie nem documento

- Área: banco
- Severidade: S3 baixo
- Esforço: ?
- Confiança: —
- Onde: função `public.submit_identity` (`web/supabase/migrations/20261013000700_f07_identidade.sql`); tabela `identity_submissions`
- Prova: no staging, num bloco desfeito, um trabalhador com `identity_status='nao_enviado'` chamou `submit_identity('<uid>/'||repeat('x',3000000), '<uid>/'||repeat('x',3000000), 'v1')`. Resultado: `msg=sem erro status=em_analise submissoes=1 tamanho_path=3000037`. A função só confere o prefixo `<uid>/`: não confere se o objeto existe no bucket `identidade`, se selfie e documento são arquivos diferentes, nem o tamanho do texto. Depois disso `submit_identity` recusa com BC409 ("já está em análise") até a equipe decidir.
- Impacto: qualquer trabalhador entra na fila da equipe sem selfie nem documento, e a fila (`admin_identity_queue`) devolve caminhos de MBs. O status "em análise" aparece para todos (AUD-057). Quem tentar de má-fé trava a própria correção até a equipe recusar. A equipe gasta tempo com imagem quebrada.
- Causa raiz: —
- Correção recomendada: na função, exigir `char_length(path) <= 200`, caminhos diferentes, `exists (select 1 from storage.objects where bucket_id='identidade' and name = p_selfie_path)` (o mesmo para o documento) e `owner` igual ao `auth.uid()`; limitar `identity_submissions.selfie_path` e `document_path` por CHECK.
- Critério de aceite: teste SQL em que um caminho inexistente falha com BC422 e um com 3 MB também; o envio real continua passando.
- Dependências: —
- Origem: HUNT-009 (HUNTER)

### AUD-133 — Se a linha `storage_public_base` faltar, a conferência das fotos deixa passar tudo e a limpeza diária apaga todas as fotos

- Área: banco
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável (lido na definição das funções; não reproduzido porque a ferramenta de SQL do staging parou de responder antes do teste)
- Onde: `public.storage_url_ok` (migration `20261010000700_z12_fotos.sql:27`), `public.orphan_storage_objects` (`20261014000400_x09_arquivos_orfaos.sql:37`: `coalesce(…, '')`), `web/supabase/functions/limpar-arquivos/index.ts:25-39` (apaga o que a função devolve, sem conferir proporção)
- Prova: `storage_url_ok` termina em `p_owner is not null and starts_with(p_url, (select value … 'storage_public_base') || …)`; sem a linha, `starts_with(…, NULL)` é NULL, a função devolve NULL e os gatilhos `check_*_v2` fazem `if not storage_url_ok(…)` — `not NULL` é NULL, nada é recusado. Já `orphan_storage_objects` usa `coalesce(…, '')`, então nenhum arquivo bate com a lista de URLs em uso e todos os arquivos dos 3 buckets públicos com mais de 1 dia viram "órfãos". Hoje a linha existe no staging e na produção (conferido por consulta: produção `count(*) filter (where key='storage_public_base') = 1`), e a z12 grava a URL da produção como padrão ("troque no staging").
- Impacto: um projeto novo/restaurado sem essa linha aceita URL externa em foto de perfil e, uma vez configurada a limpeza, apagaria todas as fotos de vagas, avatares e portfólios em até 1 dia.
- Causa raiz: a configuração é uma linha de tabela sem `not null`/validação e as duas funções não tratam "ausente" como erro.
- Correção recomendada: nas duas funções, `raise exception` quando a base for nula/vazia; na Edge Function, abortar se a lista de órfãos for > X % do total; opcional: `check (value ~ '^https://.+/storage/v1/object/public/$')` em `app_config` para essa chave.
- Critério de aceite: teste SQL que apaga a linha e espera erro em ambas as funções.
- Dependências: nenhuma.
- Origem: D1-006 (D1)

### AUD-134 — Ordem de travas inconsistente (vaga↔candidatura, pagamento↔vaga): deadlock possível

- Área: banco
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `transition_application` trava vaga→candidatura; `application_conclude` (`…y01_y04_ciclo_vaga.sql:59`, usada por `conclude_finished_jobs`/`conclude_my_finished_jobs`) trava candidatura→vaga; `confirm_boost_payment` (`…z02_pagamentos.sql:154`) trava pagamento→vaga e `begin_boost_payment` (`…u48…sql:156`) vaga→pagamentos `aguardando`
- Prova: leitura dos corpos das funções (o conector não tem sessões paralelas).
- Impacto: raro 40P01; o webhook é reenviado e a ação do usuário falha.
- Causa raiz: ordens de lock opostas.
- Correção recomendada: "vaga primeiro" em `application_conclude` e `confirm_boost_payment`.
- Critério de aceite: teste com 2 conexões sem 40P01.
- Dependências: nenhuma (soma ao M1-H2)
- Origem: D2-011 (D2)

### AUD-135 — Limites diários (candidaturas 30/dia, convites 20/dia, denúncias 20/dia) não são atômicos

- Área: banco
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `web/supabase/migrations/20261014000200_x15_rls_desempenho.sql:84`, `20261013000300_f13_convite.sql:24`, `20261013000400_f04_denuncia_bloqueio.sql:51`
- Prova: as funções contam e inserem sem lock; candidaturas travam a vaga, não o trabalhador, então vagas diferentes em paralelo não se enxergam.
- Impacto: um script com chamadas simultâneas passa dos limites.
- Causa raiz: contagem sem exclusão mútua.
- Correção recomendada: `pg_advisory_xact_lock(hashtextextended('cand:'||worker_id,0))` no início.
- Critério de aceite: 40 chamadas paralelas → no máximo 30.
- Dependências: nenhuma
- Origem: D2-012 (D2)

### AUD-137 — Migrations "idempotentes" que reescrevem dados/permissões quando rodam de novo

- Área: banco
- Severidade: S3 baixo
- Esforço: P
- Confiança: provável
- Onde: `migrations/20261012000100_l18_pagamento.sql:24` (`update jobs set payment_method='pix_dia' where payment_method is null`); `migrations/20261010000600_z06_endereco.sql:14-19` (`revoke select on jobs` + lista fixa de colunas); `APLICAR.md:13-14` e `:6-7`; `web/scripts/staging/aplicar-banco.sh:60-72` (`psql -f` por arquivo, sem transação única)
- Prova: desde o U01 a vaga pode ficar sem pagamento (`tests/l18_pagamento.sql:24-27` espera null). Reaplicar a l18 troca todas por "PIX no dia", uma promessa que a empresa não fez. Reaplicar o z06 sozinho tira `select` das colunas concedidas depois (`l18:26`, `public_slug`, `weekdays`…) e o mural dá 42501. Não reapliquei no staging.
- Impacto: reaplicar o pacote depois do lançamento altera dado de empresa e pode derrubar o mural. Hoje a produção tem 0 vagas.
- Causa raiz: migrations não são realmente idempotentes em dados e permissões.
- Correção recomendada: l18 com `and created_at < '2026-10-12'`; z06 revogar só se o privilégio de tabela ainda existir; ajustar a frase do APLICAR.md; usar `psql --single-transaction`.
- Critério de aceite: rodar a pilha duas vezes no CI e comparar o estado.
- Dependências: nenhuma
- Origem: D3a-002 (D3a)

### AUD-138 — A migration pendente que apaga o app antigo está desatualizada e quebraria `signup_taken('documento')` e o cron `bicos-limpar-cadastros`

- Área: banco
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético: a migration pendente não está aplicada e o CI pega ao mover o arquivo; a frase 'os outros testes passam' do LEIA está errada. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado
- Onde: `pendentes/20261015000900_lanc07_apagar_app_antigo.sql:28-102`; `migrations/20261020000100_u10_dados_unicos.sql:25`; `migrations/20261021000300_u37_cadastro_google.sql:16` (ambas leem `public.profiles`); `pendentes/LEIA.md:11-13`
- Prova: no staging `pg_proc.prosrc ~ 'public.profiles'` acha `signup_taken` e `purge_unconfirmed_signups` (language sql). A pendente (15/10) só troca 4 funções e dá `drop table profiles … cascade`. Os testes u10 (linhas 20, 25) e u37 (linha 16) chamam essas funções, então a frase "os outros testes passam" do LEIA venceu.
- Impacto: quando o responsável der o "pode" para apagar o app antigo, o cadastro com documento e a limpeza de cadastros não confirmados passam a falhar.
- Causa raiz: a pendente foi escrita antes de U10/U37 e não foi atualizada.
- Correção recomendada: incluir `create or replace` dessas duas funções sem `profiles` e reconferir com `run.mjs --with`.
- Critério de aceite: aplicar a pendente num banco com todas as migrations e rodar todos os testes SQL verde.
- Dependências: "pode" do responsável (ver AUD-072)
- Origem: D3b-002 (D3b); também reportado por: D3b-003
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3b-003 (S3): A migration destrutiva não tem trava de backup nem ordem segura — onde: `pendentes/20261015000900_lanc07_apagar_app_antigo.sql` passo 0; `pendentes/LEIA.md`; `web/scripts/exportar-app-antigo.sh:21-24`

## Área: produto (8)

### AUD-119 — CNPJ alfanumérico (Receita, desde julho/2026) é recusado no cadastro e na verificação

- Área: produto
- Severidade: S3 baixo
- Esforço: M
- Confiança: provável (a regra da Receita, IN RFB 2.229/2024, é externa ao repositório; a falha está provada)
- Onde: `migrations/20261011000300_y16_y17_documento.sql:32-54` (`cnpj_valid` apaga o que não é dígito e exige 14); `migrations/20261012000700_l10_cnpj_receita.sql:18`; `mask_document`; `web/src/utils/document.ts:19`; `grep -ri alfanum` no repositório: nada
- Prova: staging `cnpj_valid('12.ABC.345/01DE-35')` = false (exemplo oficial).
- Impacto: empresa aberta depois de julho/2026 não consegue se cadastrar nem verificar com CNPJ; o problema cresce a cada mês.
- Causa raiz: validação só numérica.
- Correção recomendada: aceitar `[0-9A-Z]{14}` com módulo 11 sobre `ascii(c)-48`; ajustar `mask_document`, `document_hash`, `verificar-cnpj` (BrasilAPI) e o front.
- Critério de aceite: `cnpj_valid('12.ABC.345/01DE-35')` = true.
- Dependências: nenhuma
- Origem: D3a-004 (D3a)

### AUD-120 — Todo cadastro novo nasce com "São Paulo, SP" e coordenadas de SP; na produção as 4 contas ainda têm

- Área: produto
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `migrations/20261010000300_z07_documento_login.sql:149,155`; `migrations/20261011000300_y16_y17_documento.sql:112,118`; a versão final de `create_account_for` no staging ainda tem o texto e -23.5505
- Prova: produção `count(*)`: companies com location 'São Paulo, SP' = 3 de 3; workers com city 'São Paulo, SP' = 1 de 1. O piloto é Caxias do Sul. Pelo U67, empresa que completa sem cidade fica em SP.
- Impacto: quem não escolhe a cidade aparece em São Paulo e vê/aparece no mural errado.
- Causa raiz: padrão fixo gravado no cadastro.
- Correção recomendada: gravar vazio e exigir a cidade em `finish_sign_up`; limpar as contas existentes.
- Critério de aceite: conta nova sem cidade padrão.
- Dependências: nenhuma
- Origem: D3a-006 (D3a)

### AUD-123 — A busca do banco só acha o que está no título, bairro e cidade: os sinônimos são de construção e as vagas novas não têm ofício

- Área: produto
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado (staging: catálogo e função)
- Onde: `20261021000400_u49_busca_vagas.sql:67-70` (texto pesquisado: título, bairro, cidade, UF e `oficios.nome + sinonimos` da vaga) e, copiado, `u52`, `u53`, `u65`; `20261019000100_u01_vaga_simples.sql:12` (`oficio_id` pode ser nulo e o app não envia mais); `docs/DECISOES.md` U48 ("A tabela `oficios` do banco não mudou (só vagas antigas a usam)")
- Prova: staging `select count(*) from oficios` = 14, todos de obra (armador, azulejista, gesseiro, pedreiro, servente "auxiliar de obra" …). A lista nova de serviços (garçom, limpeza/diarista, babá …) existe só em `web/src/data/oficios.ts`. Uma vaga nova ("Diarista para apartamento", sem ofício) só é achada por palavras do título; "faxina", "limpeza" ou "garçonete" não a encontram, e a descrição também não é pesquisada. O DECISOES U49 promete busca "pelo serviço (o título ou o ofício, com sinônimos)", o que só vale para vagas antigas.
- Impacto: o campo de busca (que é o único jeito de achar um serviço depois que o filtro de ofício saiu, U01) deixa de achar vagas que o trabalhador esperaria; fica pior quando o volume crescer.
- Causa raiz: o catálogo de sinônimos ficou no banco e foi esvaziado de uso pelo U01, sem substituto (categoria na vaga ou pesquisa na descrição).
- Correção recomendada: incluir `description` (e `requirements`) no texto pesquisado, ou guardar uma `category` curta na vaga (lista do `data/oficios.ts`) e pesquisar nome e sinônimos dela; migrar o catálogo `oficios` para a lista nova (ids iguais aos do app).
- Critério de aceite: teste SQL em `u49_busca_vagas.sql`: vaga "Diarista para apartamento" aparece para "faxina" e "limpeza".
- Dependências: decisão do responsável (muda o U49); AUD-050 (a mesma função).
- Origem: D3c-007 (D3c)

### AUD-125 — "Não vou poder ir" não tem janela: depois do dia do bico o faltoso troca "falta" por "desistência"

- Área: produto
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (staging, transação desfeita)
- Onde: `tabela TRANSITIONS.desistir` (`web/src/services/applicationMachine.ts:72`) e `application_next_status` (`desistir`: pre_selecionado/contratado, sem data); ramo `desistir` de `transition_application`.
- Prova: contratado numa vaga com `end_date` = ontem; como o trabalhador, `transition_application(job, w, 'desistir', 'nao fui')` → permitido; depois, como a empresa, `marcar_falta` → BC409 "Essa candidatura mudou de situação" (`status` final `desistiu`). Só `contratado` aceita `marcar_falta` (tabela). A empresa só tem do dia do bico até +2 dias para marcar a falta; o trabalhador pode antecipar-se até o sistema concluir.
- Impacto: o registro de falta (peso maior no perfil que a desistência: `worker_track_record` conta os dois separados) fica a critério de quem faltou, se ele agir primeiro; a empresa recebe só "não vai poder ir… a vaga já estava encerrada".
- Causa raiz: `desistir` não depende da data do bico (o front também não esconde o botão depois do dia).
- Correção recomendada: recusar `desistir` quando `job_started(job)` e a data do último dia já passou (ou, a partir do dia do bico, tratar como falta); ou contar `desistiu` depois do dia como falta em `worker_track_record`. Decidir com os sócios; o mínimo é BC409 com mensagem "O bico já passou. Fale com a empresa." para `contratado` depois de `last_day`.
- Critério de aceite: teste SQL em `y01_y04_ciclo.sql`/novo: `desistir` com `end_date < hoje` falha; `marcar_falta` continua possível.
- Dependências: decisão do responsável (regra de produto).
- Origem: M1-002 (M1)

### AUD-163 — Apagar a conta apaga também as denúncias, os bloqueios e o registro de suspensão: quem foi denunciado some e volta limpo com o mesmo CPF

- Área: produto
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: apagar as denúncias da conta excluída é pedido do responsável (U24, `DECISOES.md:1833-1843`). O risco de reincidência sem memória não foi discutido. Rebaixado para S3.
- Esforço: M
- Confiança: provável (código e catálogo; não reproduzido de ponta a ponta para não apagar conta no staging)
- Onde: `web/supabase/migrations/20261021000500_u48_publico_geral.sql:104-108` e `:140-144` (`delete from public.reports … target_type 'perfil'/'post'/'avaliacao'/'vaga'`), mesma regra em `20261020000300_u24_exclusao_completa.sql:39-43,75-79`; `blocks_blocker_id_fkey` e `blocks_blocked_id_fkey` → `auth.users` com `on delete cascade`; `accounts` (com `suspended_at`, `document_hash`) é apagada na mesma função; `delete_my_account` (staging, `prosrc`) não olha `suspended_at` nem denúncias abertas; teste que exige o apagamento: `web/supabase/tests/u24_exclusao_completa.sql:52-53`
- Prova: no staging não existe tabela de "documentos barrados" (lista de 39 tabelas do `public`, só `reports`, `blocks`, `staff_actions`, `terms_acceptances` têm relação). `staff_actions` guarda só o que a equipe fez (`action, target_type, target_id, reason`). `claim_document_for` só confere `accounts` e `profiles`, então o CPF/CNPJ de uma conta apagada fica livre na hora. DECISOES U24 registra como pedido do responsável: "as feitas sobre o perfil … também saem (não há mais o que moderar)".
- Impacto: um golpista denunciado (vaga falsa, cobrança) pode excluir a conta antes de a equipe agir; as denúncias contra ele somem, ninguém que o bloqueou continua protegido, e ele cria outra conta no mesmo minuto. A equipe não consegue saber que é reincidente.
- Causa raiz: a exclusão foi tratada só como direito do titular (LGPD), sem a exceção de prevenção a fraude e segurança (LGPD art. 7º, IX e art. 11, II, g) e sem guardar nenhum rastro mínimo.
- Correção recomendada: ao excluir, manter um registro mínimo e sem dado pessoal em claro: `document_hash` + data + se havia denúncia procedente/suspensão (tabela própria, só `service_role`), e usá-lo no cadastro para avisar a equipe (não precisa barrar sozinho); manter as denúncias abertas/procedentes anonimizadas (sem `reporter_id`) por um prazo; descrever isso na política de privacidade. Alternativa mais simples: recusar `delete_my_account` enquanto houver denúncia aberta contra a conta e pedir contato com o suporte.
- Critério de aceite: teste SQL em que a conta com denúncia procedente é excluída e `signup_taken('documento', …)`/cadastro novo gera marca para a equipe (ou a exclusão é recusada); o texto da política cita o registro mínimo.
- Dependências: decisão do responsável e revisão do advogado (política de privacidade); "ação do responsável".
- Origem: D3c-002 (D3c); também reportado por: D3b-012
- Ocorrências adicionais (mesmo problema, outros lugares):
  - D3b-012 (M): (melhoria futura) Excluir a conta apaga a prova de aceite e as denúncias contra a pessoa, e libera o CPF para novo cadastro — onde: `terms_acceptances … on delete cascade`; `anonymize_account` vigente

### AUD-165 — Nenhuma tela do app avisa contra golpe (dinheiro/PIX antecipado, "taxa")

- Área: produto
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: já existe 'A Bicos não cobra taxa e não entra na negociação' na tela do WhatsApp (`Selected.tsx:94-96`), a pergunta 'A Bicos cobra alguma coisa?' na Ajuda e o motivo 'Golpe' na denúncia; falta o aviso **ativo** ('nunca pague para trabalhar'). O 'nenhuma tela avisa' era exagero. Rebaixado para S3 (continua um ganho rápido).
- Esforço: P
- Confiança: confirmado (busca + leitura)
- Onde: ausência em `pages/worker/JobDetail.tsx`, `ConfirmApplication.tsx`, `ApplicationSent.tsx`, `Selected.tsx:94-97`, `pages/shared/Help.tsx:18-73`; só `services/legal.ts:78` (Termos) e `services/safety.ts:14` (motivo de denúncia)
- Prova: `rg -i "golpe|nunca pague|antecipad|fraude|cuidado"` em pages/components/utils só acha o motivo "Golpe ou pedido de dinheiro". Tela com o WhatsApp liberado (print 30): "Combine ponto de encontro, horário e pagamento direto com a empresa. A Bicos não cobra taxa e não entra na negociação." Ajuda: 12 perguntas, nenhuma de segurança.
- Impacto: o golpe típico (pedem taxa/depósito antes do trabalho) acontece logo depois do WhatsApp liberado, e a pessoa não é avisada nesse momento. Denunciar exige achar a bandeira de 44 px sem texto.
- Causa raiz: a regra está só nos Termos.
- Correção recomendada: linha fixa "Nunca pague para trabalhar. Se pedirem dinheiro antes, não faça e denuncie" com botão "Denunciar" em "Você avançou", no "Aprovado" da empresa e na confirmação; pergunta nova na Ajuda.
- Critério de aceite: texto nos 3 pontos (print) e na Ajuda.
- Dependências: texto aprovado pelos sócios (relacionado a AUD-009)
- Origem: P1-002 (P1)

### AUD-166 — Aprovar e Recusar candidato: dois ícones de 40×40 px, sem texto, lado a lado

- Área: produto
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: `IconButton` usa `tap-target` (área de 44 px, `base.css:268-277`), há `aria-label`, e o erro é recuperável ('Desfazer' de 7 s e `undo_reject` por 10 min). Rebaixado para S3.
- Esforço: P
- Confiança: confirmado (medido)
- Onde: `components/CandidateRow.tsx:107-117` (`IconButton size="sm"`, `gap-1`); `components/IconButton.tsx:11`
- Prova: `t7.cjs`: 6 botões 40×40 (3 candidatos), print 84 (✕ e ✓ sem palavra; nome cortado "Joel Ribei…"). No perfil do candidato a mesma decisão é botão grande com texto (print 85).
- Impacto: toque errado recusa quem se queria aprovar e o trabalhador recebe "Não foi essa vez"; "Desfazer" dura 7 s (`pages/recruiter/decisionToasts.ts`).
- Causa raiz: linha compacta com ações de decisão no peso de ícone de cabeçalho.
- Correção recomendada: botões "Aprovar"/"Recusar" com texto, 48 px e espaço entre eles.
- Critério de aceite: alvos ≥ 48 px e ≥ 8 px de distância (`t7.cjs`).
- Dependências: nenhuma (relacionado a AUD-042)
- Origem: P1-005 (P1)

### AUD-167 — Vocabulário que ainda diverge na tela (lista com arquivo:linha em `termos.md` §2)

- Área: produto
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Signup.tsx:124` ("Cadastro de recrutador"); `layouts/navItems.ts:17` × `pages/worker/MyApplications.tsx:235` × `Help.tsx:48` (aba "Vagas" = "Minhas candidaturas"; o mural é "Início"); `utils/applicationStatus.ts:390-397` × `:449-451` ("Pré-selecionado" × "Aprovado"); `pages/recruiter/JobManage.tsx:153,401,414` ("vaga" = anúncio e = lugar); `ConfirmApplication.tsx:98` ("suas especialidades", que não existem mais); `Selected.tsx:73,160` ("A {nome}" com pessoa física); `Help.tsx:29` ("pedir o link", agora é código); `components/ReviewForm.tsx:254` ("Ok"); cinco nomes para "encerrada" (`JobManage.tsx:411`, `JobClosed.tsx:421`, `layouts/accountMenu.ts:22`)
- Prova: `termos.md`. Cumprido o U48: nenhuma obra/pedreiro/EPI/construtora/ofício visível; só 1 "recrutador" na tela.
- Impacto: pequeno, mas "Vagas" abrindo "Minhas candidaturas" e "Pré-selecionado"/"Aprovado" é o que o suporte vai ouvir.
- Causa raiz: U62/U63 renomearam sem varrer Ajuda e telas vizinhas.
- Correção recomendada: coluna "Sugestão" de `termos.md`.
- Critério de aceite: `rg` nas formas antigas sem resultado.
- Dependências: nenhuma (consolidar com C4-010, C3-012, C6-007)
- Origem: P1-011 (P1); também reportado por: C3-004, C3-012, C4-010, C6-007, B2-004
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C3-004 (S3): Ajuda manda "pedir o link de novo" no e-mail de confirmação, mas desde a U11 é código — onde: `pages/shared/Help.tsx:27-30`; a tela real é `VerifyEmail.tsx:213-216` ("código de 6 números", "Reenviar código")
  - C3-012 (S3): Termos e gênero inconsistentes — onde: `pages/shared/ChooseProfile.tsx:53` ("usar o Bicos"; no resto são 22 ocorrências de "a/na Bicos"); `Signup.tsx:94` (`'Cadastro de recrutador'`; a regra é "empresa" na tela); `Settings.tsx:93` ("O que chega no app e no celular") com push desligado (`NotificationSettings.tsx:56` só mostra "No celular" se `FEATURES.push`)
  - C4-010 (S3): O mesmo status tem quatro nomes e o texto é no masculino — onde: `utils/applicationStatus.ts:19,78`; `pages/recruiter/JobClosed.tsx:36`; `pages/worker/Selected.tsx`; `CandidateActions.tsx:269`
  - C6-007 (S3): Textos: "Conta de recrutador" na tela e "até Hoje/Amanhã" com maiúscula no meio da frase — onde: `layouts/AppNav.tsx:297`; `pages/recruiter/BoostJob.tsx:50`, `JobManage.tsx:242`, `BoostPayment.tsx:129` (usam `dateTimeLabel`, `utils/dates.ts:66-70`)
  - B2-004 (S3): "recrutador" aparece na tela, contra a regra do projeto ("na tela: empresa") — onde: `web/src/pages/shared/Signup.tsx:124` (sobretítulo "Cadastro de recrutador"), `web/src/layouts/AppNav.tsx:297` (menu da conta no desktop: "Conta de recrutador"); regra em `CLAUDE.md` §1 ("Na tela: empresa")

## Área: desempenho (7)

### AUD-136 — Publicar vaga notifica todos os alertas na mesma transação

- Área: desempenho
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado (medido) + extrapolação
- Onde: `web/supabase/migrations/20261019000100_u01_vaga_simples.sql:143` (`notify_job_alerts`, AFTER INSERT em `jobs`)
- Prova: 5.000 alertas na cidade → `publish_job` 1,23 s e 5.000 notificações; `statement_timeout` do authenticated = 8 s ⇒ falha com ~30 mil alertas numa cidade.
- Impacto: em cidade grande, publicar vaga passa a dar erro.
- Causa raiz: fan-out síncrono no gatilho.
- Correção recomendada: fila + cron/Edge Function em lotes (ou limite N por vaga ordenado por distância).
- Critério de aceite: `publish_job` < 200 ms com 30 mil alertas.
- Dependências: nenhuma
- Origem: D2-014 (D2)

### AUD-171 — Lista do IBGE (≈64 KB gz) no pacote principal e prefetch de todas as telas pesam na primeira visita

- Área: desempenho
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado (build real medido)
- Onde: `services/remote/data.ts:10` (import estático de `cityByLabel`) → `services/cities.ts:3` → `data/cidades.ts`; `routes.ts:204-206` + `App.tsx:146-149` (`preloadAllScreens` no ocioso, sem olhar `saveData`)
- Prova: `attr.mjs` no `index-*.js` do build real (198 KB gz): `cidades.ts` 156 KB brutos, `seed.ts` 30 KB (seed já em AUD-172). `preload.mjs` em `/login`, sem SW: 4 arquivos/242 KB gz ao carregar + 93 arquivos/237 KB gz logo depois (inclui telas da empresa e `/admin` para trabalhador).
- Impacto: ≈480 KB baixados antes do primeiro toque, em 3G/dados limitados; a lista só é usada em 3 telas.
- Causa raiz: import estático e prefetch indiscriminado.
- Correção recomendada: busca de cidade assíncrona (`import()`/fatiar por UF); prefetch só do papel da sessão e pulando `saveData`/conexão lenta.
- Critério de aceite: principal < 140 KB gz, sem `cidades` no principal.
- Dependências: AUD-172
- Origem: C6-006 (C6)

### AUD-172 — A versão de produção leva dentro os dados de demonstração e a senha da conta de exemplo

- Área: desempenho
- Severidade: S3 baixo
- Esforço: M
- Confiança: confirmado (build real gerado e examinado)
- Onde: `web/src/services/store.ts:8` e `selectors.ts:3` (`import … data/seed`), `auth.ts:7,44` (`ACCOUNTS`, `DEMO_PASSWORD`), `mode.ts:9` (`IS_DEMO` é `!isSupabaseConfigured()`, calculado em tempo de execução, não uma constante de build); `vite.config.ts:151` só faz `define` no demo.
- Prova: `VITE_… (valores falsos) npx vite build --mode e2e --outDir <scratchpad>/dist-real-m1` (modo que liga o Supabase, igual ao de produção). `grep` no `assets/index-*.js` (653.656 bytes, 202 KB gzip): contém `bicos123`, `trabalhador@bicos.demo`, "Eventos Meridiano", "Restaurante Alvorada", "Padaria Belém" (as empresas do `seed.ts`), num bloco contínuo perto do byte 320.000. Log: `out/M1/build-real.log`.
- Impacto: todo trabalhador baixa, em celular simples e internet ruim, um bloco de dados falsos que nunca usa; a senha do demo (`bicos123`) aparece em texto no pacote de produção (varreduras de segredo vão reclamar; nenhuma conta real a usa).
- Causa raiz: o modo é decidido na execução e o seed é importado no topo, então o empacotador não consegue descartá-lo.
- Correção recomendada: `IS_DEMO` virar constante de build (`define` ou expressão literal de `import.meta.env`) e o seed/contas carregados só com `import()` dentro de `if (IS_DEMO)`; conferir com o mesmo `grep` no CI (falhar se achar `bicos123` no build real).
- Critério de aceite: o `grep` acima não acha `bicos123`, "Meridiano" nem `@bicos.demo` no build real; tamanho do chunk principal menor.
- Dependências: nenhuma.
- Origem: M1-005 (M1); também reportado por: C2-007
- Revisão adversária: Cético B: decisão documentada (dois modos, uma porta; dados e senha de demonstração são públicos, `DECISOES.md:11`); resíduo: o peso no pacote de produção.
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C2-007 (S3): O pacote de produção leva junto os dados de demonstração e a senha de demo (e 4 "imports dinâmicos" não separam nada) — onde: web/src/services/store.ts:8 (`import * as seed`), selectors.ts:3, catalog.ts:4, auth.ts:7; build real: `$SCRATCH/dist-c2` (log em out/C2/build-e2e.log)

### AUD-173 — O service worker baixa 0,88 MB de uma vez na primeira visita (heic2any, mapa, Firebase, tela da equipe, fontes pouco usadas)

- Área: desempenho
- Severidade: S3 baixo — Ajustado na revisão adversária de S2 para S3: Cético B: guardar o shell inteiro no celular é decisão (X02, `DECISOES.md:904-905`); ignorar `heic2any` e `Admin` no pré-cache é ajuste fino e o custo é em segundo plano. Rebaixado para S3.
- Esforço: P
- Confiança: confirmado (medido)
- Onde: `vite.config.ts:127` (`globPatterns: ['**/*.{js,css,html,woff2,svg}','icons/*.png']`, sem `globIgnores`); `:103` (`registerType:'prompt'`); `src/services/pwa.ts:11-23`; `dist-demo/sw.js`
- Prova: `sw.js` tem `precacheAndRoute` com 123 entradas, 3.097 KiB brutos. Carga a frio de `/login` (`cold.cjs`, CPU 4×): antes do `load` são 5–6 pedidos e 211 KB (brotli); aos 25 s são 121 pedidos e 878 KB. Nesses 878 KB entram `heic2any` 257 KB (só serve a quem manda foto HEIC), `MapCanvas` 44 KB, `firebaseSdk` 28 KB, a tela `Admin`, 8 fontes (122 KB, incluindo 2 do Space Mono, usadas só em códigos) e `icons/og.png` 26 KB (só robôs usam). Linha do tempo no servidor: 211 KB em 3 s, 329 KB em 10 s, 878 KB em 15 s.
- Impacto: no 3G (≈ 50 KB/s) são ~17 s de banda e quase 1 MB do pacote de dados, em segundo plano, disputando com a tela que a pessoa abriu.
- Causa raiz: o pré-cache pega todo `**/*.js`, inclusive o que só carrega sob demanda. O prefetch de todas as telas no ocioso (`App.tsx:147-148`) já foi relatado em AUD-171 e soma-se a isso.
- Correção recomendada: `globIgnores` para `heic2any-*`, `MapCanvas-*`, `firebaseSdk-*`, `Admin-*`, `icons/og.png` e `space-mono-*`; `runtimeCaching` `StaleWhileRevalidate` para `/assets/*`.
- Critério de aceite: `cold.cjs` aos 25 s com ≤ 400 KB e ≤ 60 pedidos; o app continua abrindo offline depois da primeira visita.
- Dependências: AUD-171
- Origem: Q1-001 (Q1)

### AUD-174 — O mural espera até 5 idas e voltas ao banco, uma depois da outra, antes de desenhar

- Área: desempenho
- Severidade: S3 baixo
- Esforço: M
- Confiança: provável (lido; latência real não medida)
- Onde: `src/services/remote/data.ts:179-232` (`loadFeed`) e `:304-330` (`loadMyApplications`)
- Prova: a ordem em `loadFeed` é: (1) `rpc feed_jobs`; (2) `companies ∥ job_stats ∥ get_job_addresses`; (3) `jobsById(stale)`, só na 1ª página; (4) de novo `jobsWithContext(fresh)`; (5) `savedIds()`, em `:230`. O `apply()` só roda no fim, em `:231`. `loadMyApplications` encadeia `conclude_my_finished_jobs → applications → events∥workers∥jobs → companies∥stats∥addresses`.
- Impacto: com 150–400 ms de latência são 0,75–2 s de espera antes do primeiro cartão, com o esqueleto na tela.
- Causa raiz: chamadas em série.
- Correção recomendada: `savedIds()` em paralelo com `feed_jobs`; aplicar a 1ª página assim que chegar, e a checagem de "stale" em segundo plano; uma RPC `feed_with_context` leva a 1 viagem.
- Critério de aceite: ≤ 2 viagens em série no teste com `fakeSupabase.ts`.
- Dependências: nenhuma
- Origem: Q1-006 (Q1)

### AUD-175 — PIX: um relógio de 1 s refaz a tela inteira e a consulta a cada 5 s não para com a aba escondida

- Área: desempenho
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (lido)
- Onde: `src/pages/recruiter/BoostPayment.tsx:49-55` (`useSecondsLeft`: `setInterval` sempre ligado, mesmo sem pagamento aguardando) e `:80-85` (`getPayment` a cada 5 s)
- Prova: o `setNow` de 1 s re-renderiza `BoostPayment`, que inclui o formulário do cartão. O polling não olha `document.hidden` nem recua (≈ 360 consultas em 30 min).
- Impacto: bateria e dados de celular simples durante a espera.
- Causa raiz: relógio e polling sem condição.
- Correção recomendada: ligar o relógio só com `status==='aguardando'`, isolar o contador num componente, pausar com `visibilitychange` e recuar (5→15→30 s).
- Critério de aceite: sem re-render do formulário a cada segundo (React Profiler) e 0 consultas com a aba escondida.
- Dependências: nenhuma
- Origem: Q1-014 (Q1)

### AUD-176 — Vídeo de até 50 MB sobe sem compressão, sem prazo e sem como cancelar

- Área: desempenho
- Severidade: S3 baixo
- Esforço: M
- Confiança: provável (lido)
- Onde: `src/services/remote/storage.ts:27` (`MAX_VIDEO_BYTES=50MB`), `:44-62` (XHR sem `timeout`/`abort`; só `onerror`, em `:58`), `:76-87` (vídeo não passa por `compressImage`)
- Prova: 50 MB a 50 KB/s levam ~17 min. Se a rede cair no meio, a barra congela e o botão fica ocupado. A CSP também não tem `media-src` (AUD-034).
- Impacto: publicação do portfólio presa em internet ruim.
- Causa raiz: upload sem controle de tempo e de tamanho.
- Correção recomendada: limite de 20 MB ou 30 s, `xhr.timeout=120000` com mensagem, botão Cancelar com `xhr.abort()`.
- Critério de aceite: com um XHR falso que nunca termina, a tela sai do estado ocupado em 120 s.
- Dependências: AUD-034, AUD-141
- Origem: Q1-015 (Q1)
- Revisão adversária: Cético B: duplicata de AUD-095 (XHR sem timeout nem cancelamento em `storage.ts:40-62`); só soma o limite de 50 MB de vídeo.

## Área: docs (5)

### AUD-195 — Não existe alvo de navegadores: o build promete uma coisa e o código e o CSS exigem outra

- Área: docs
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (lido); efeito em aparelho antigo não testado
- Onde: `web/package.json` (sem `browserslist`); `vite.config.ts:156`; `CLAUDE.md` e `web/docs` não dizem quais celulares são suportados
- Prova: o CSS publicado usa `aspect-ratio` (Safari 15; os cartões usam `aspect-[20/19]`), `gap` em flex (Safari 14.1) e `:focus-visible` (Safari 15.4). O JS usa `randomUUID` (15.4) e `inert` em `BusyOverlay.tsx:22` (Safari 15.5/Chrome 102; sem suporte, o fundo continua clicável). `dist-demo/assets` publica 8 `.woff` (126 KB) que nenhum navegador compatível com `es2020` baixa.
- Impacto: ninguém sabe se iPhone com iOS 14/15 ou Android com WebView velho funciona. Vai aparecer como "o app não abre" no suporte.
- Causa raiz: alvo de navegadores nunca foi definido.
- Correção recomendada: decidir e documentar (ex.: "Chrome/WebView ≥ 100, Safari ≥ 15.4"), pôr em `browserslist` e `build.target`, e rodar o E2E em WebKit no CI.
- Critério de aceite: seção "Navegadores suportados" no README e job WebKit verde.
- Dependências: AUD-142; decisão dos sócios
- Origem: Q1-013 (Q1)

### AUD-198 — Documentos descrevem o banco de antes (staging "sem migrations", 48 arquivos, 42/54 RPCs)

- Área: docs
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `CLAUDE.md` §4 ("Staging … 0 migrations no histórico", "48 arquivos, 09/10 → 16/10", "pendentes na produção: lanc06…lanc13 e as r*", "42 RPCs para authenticated"); `web/docs/ADVISORS.md:13` (54 avisos `authenticated_security_definer_function_executable`); `web/docs/SUPABASE.md:51-53`
- Prova: `list_migrations` do staging = 67 versões, idênticas às 67 do repositório; `get_advisors` do staging = 56 avisos desse tipo; a produção tem 42; faltam na produção 25 migrations (lanc06, 07, 09, 10, 12, 13; r03, r04; u01, 06, 10, 12, 24, 30, 32, 37, 48, 49, 51, 52, 53, 62, 63, 65, 67), fora as duas já aplicadas em pedaços (`bicos_v2_rules`/`bicos_v2_data`).
- Impacto: quem decide a ordem de publicação (ou outra IA) lê um mapa errado do staging e da produção.
- Causa raiz: os números ficam em prosa e não são gerados.
- Correção recomendada: atualizar os três textos e acrescentar ao CI/`conferir-migrations.sh` a contagem esperada (ou remover os números).
- Critério de aceite: os números do texto batem com `list_migrations` e `get_advisors`.
- Dependências: nenhuma.
- Origem: D1-009 (D1); também reportado por: O1-012, O2-010
- Revisão adversária: Cético B: duplicata parcial de AUD-201 (staging 'sem banco'); fica o que é do CLAUDE.md §4: 48 arquivos de migration (hoje 67), 42 RPCs.
- Ocorrências adicionais (mesmo problema, outros lugares):
  - O1-012 (S3): CLAUDE.md descreve o projeto de 17/10 e uma IA nova não consegue operar só com ele — onde: `CLAUDE.md:4-5,134,156,166,179-181,188,223-235`
- Prova (além do que AUD-198 cobre: staging "sem migrations", 48 arquivos, 42 RPCs): (1) cabeçalho "Estado conferido em 17/10 (front-novo-supabase em 1b07bb6, master em dd8d0ad) … Rodada atual: R01–R12"; hoje master=5bddd2c, front-novo-supabase=845c9c8, trabalho em `claude/eloquent-heisenberg-y5hwt6`; as rodadas recentes são U01–U69 e X01–X32 (:188 ainda "L01–L14 nesta rodada"). (2) :134 "Edge Functions … todas publicadas" e :156 "todas as funções
  - O2-010 (S3): Números e promessas dos documentos de teste estão defasados — onde: `CLAUDE.md` §5 ("282 testes Vitest (34 arquivos)", "pode rodar até na produção sem deixar rastro"); `web/e2e/LEIA.md:4`; `web/docs/E2E.md:7`; `.github/workflows/staging.yml:128`

### AUD-199 — Textos e comentários que ficaram para trás depois do U48/U53/U24 (inclui um "construtora" no aviso de suspensão)

- Área: docs
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `20261021000500_u48_publico_geral.sql:70` (`coalesce(…companies.name…, 'construtora')` dentro do aviso "… na construtora foi cancelado pela equipe…", visível no staging em `admin_suspend_account`); `20261021000700_u52_dias_e_local.sql:6` ("o número da casa continua escondido como o resto do endereço") e `20261021000600_u51_endereco.sql:8-10` (ponto "100 a 200 m", sem valor depois do U53 que abre `lat/lon` exatos); `delete_my_account` no staging ("perfil anonimizado, que o histórico do outro lado ainda usa" — o U24 deixou de anonimizar); `anonymize_account` (nome e comentários "As construtoras que ele avaliou"); `web/supabase/tests/u12_perfil_simples.sql:30` ("sem gravar cidade nem endereço" — o U67 grava a cidade da empresa); `web/supabase/tests/u51_endereco.sql:1-2,57-71` (garante o ponto deslocado que o U53 tornou inútil); nomes de fixture "Obra …" em u01, u06, u12, u24, u32, u51
- Prova: varredura de `pg_proc.prosrc` no staging por `construtora|obra|EPI`: só restam nomes internos, comentários e o texto de `admin_suspend_account`. O teste `u48_publico_geral.sql:7-10` procura 15 frases exatas e não inclui `'construtora'` como valor padrão, por isso passa.
- Impacto: o texto "na construtora" hoje não chega a ninguém (o nome da empresa nunca é nulo, então o valor padrão é inalcançável), mas fica como armadilha se o código mudar; quem mantém o banco lê comentários que dizem o contrário do que o código faz (endereço escondido, perfil anonimizado).
- Causa raiz: as migrations só se corrigem por novas migrations (`create or replace` de função inteira), então comentário e texto antigos sobrevivem; o teste de textos confere frases, não padrões.
- Correção recomendada: trocar o valor padrão por 'a empresa'; atualizar os comentários na próxima migration que tocar nessas funções; trocar a lista de frases do teste U48 por uma busca de padrão (`prosrc ~* '\mconstrutora\M'` fora de aspas simples de identificadores internos) com a lista de exceções.
- Critério de aceite: `select proname from pg_proc where prosrc ~ 'Construtora|obra|EPI'` vazio; o teste U48 falha se alguém reintroduzir o texto.
- Dependências: nenhuma.
- Origem: D3c-006 (D3c)

### AUD-200 — Variáveis do Firebase não estão documentadas nos exemplos de ambiente

- Área: docs
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/.env.example` (46 linhas, nenhuma `VITE_FIREBASE_*`); `web/src/env.d.ts:19-22`, `web/src/services/features.ts:15-18` (usam as 4); `web/supabase/functions/.env.staging.example` (sem `FIREBASE_PROJECT_ID`, que `entrar-com-firebase/index.ts:30,36` exige — sem ele a função responde 503 `desligado`); `web/docs/SUPABASE.md:17` ("Todas as variáveis estão explicadas em web/.env.example")
- Prova: `grep -n FIREBASE web/.env.example web/supabase/functions/.env.staging.example` não devolve nada; `VITE_FIREBASE_*` só existem em `env.d.ts`/`features.ts`.
- Impacto: quem montar o ambiente de produção seguindo os exemplos entrega o app sem Google/celular (botão escondido, função em 503) e sem saber por quê. O `.env.staging.example` das funções também traz um e-mail pessoal em `VAPID_SUBJECT=mailto:[e-mail pessoal da equipe]` (e `SUPABASE.md:163` manda usar o mesmo), que vai ao serviço de push do navegador; o código já tirou esse padrão (commit 0cd502e), a doc não.
- Causa raiz: o U28 acrescentou o Firebase sem atualizar os exemplos.
- Correção recomendada: acrescentar `VITE_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID` ao `.env.example` e `FIREBASE_PROJECT_ID` ao `.env.staging.example`; trocar o `mailto:` por um endereço de função (ex.: `suporte@…`) na doc.
- Critério de aceite: o teste que confere `.env.example` (se existir) ou um `grep` no CI falha quando uma variável lida por `env.d.ts` não está no exemplo.
- Dependências: nenhuma.
- Origem: D4-012 (D4)
- Revisão adversária: Cético B: duplicata parcial de AUD-055 (variáveis do Firebase ausentes de IMPLANTACAO e `.env.example`).

### AUD-202 — Documentos da migração antiga e relatórios velhos confundem: mandam rodar comandos que não existem e descrevem telas que saíram

- Área: docs
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `web/docs/VALIDACAO.md:7,13,45,65,73,83`; `MAPEAMENTO.md:7-12`; `RELATORIO_PARIDADE.md` (728 linhas); `RELATORIO-FINAL.md:12-26`; `E2E.md` + `e2e-prints/*`; `CONTRATO-BACKEND.md:49,189`; `README.md:59-64`; `web/README.md:66,77-89`; `LIMPEZA.md:253-256`
- Prova: VALIDACAO.md manda `npm run build && npm run parity` e `scripts/parity/run.mjs` — removidos no commit 4d9ea34. MAPEAMENTO.md §0 "não existe Firebase no repositório" — hoje o login Google/celular usa Firebase (U28). RELATORIO-FINAL.md cita 167 testes, 36 migrations e "aplicar as 36 migrations"; reutiliza IDs L01–L09 que a rodada de lançamento usa de novo. E2E.md é de 16/10 e os 38 prints mostram "completar perfil ofício/especialidade" e "construtora", removidos pelos U12/U48. CONTRATO-BACKEND.md ainda lista `workers.oficio_id`. README.md:61-64 "Falta montar o staging … na branch claude/front-novo-supabase". web/README.md:66 cita script de "paridade" e a tabela :77-89 omite IMPLANTACAO, LIMPEZA, TESTE-MANUAL, PLANO-CADASTRO. LIMPEZA.md:253-256 deixa o D2 (apagar os 4 documentos) "decisão ainda não tomada".
- Impacto: ~1,3 mil linhas de ruído e instruções que falham; RELATORIO-FINAL e E2E.md mostram um produto que não existe mais.
- Causa raiz: documentos de fase mantidos como se fossem vivos.
- Correção recomendada: executar o D2 (apagar ou mover para `docs/historico/` com aviso); não versionar E2E.md/prints gerados (usar o artefato do CI) ou regerar; atualizar README.md e web/README.md.
- Critério de aceite: `links.mjs` sem citações quebradas; nenhum documento manda rodar comando inexistente.
- Dependências: decisão do responsável (D2 do LIMPEZA)
- Origem: O1-015 (O1)

## Área: código (4)

### AUD-101 — Contagem do "reenviar código": três cópias, relógios que nunca param, "0:60" no SMS

- Área: código
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/VerifyEmail.tsx:325-336`, `WhatsAppCode.tsx:27-35,105-108`, `PhoneSignIn.tsx:30-35,168`
- Prova: três implementações e duas cópias de `clock()`; os `setInterval` (1 s, 1 s e 250 ms) continuam rodando depois de zerar e re-renderizam a tela inteira; `PhoneSignIn.tsx:168` monta `0:${padStart(wait)}` com `wait` de até 60 e mostra "0:60".
- Impacto: gasto de bateria/CPU e um texto errado.
- Causa raiz: duplicação sem hook compartilhado.
- Correção recomendada: um hook `useCountdown` que para em zero, e um `clock()` em `utils/`.
- Critério de aceite: um único hook; sem intervalo ativo depois de zerar.
- Dependências: nenhuma
- Origem: C3-009 (C3)

### AUD-126 — Mural no modo real: o app refiltra e reordena o que o servidor mandou com regras ligeiramente diferentes

- Área: código
- Severidade: S3 baixo
- Esforço: M
- Confiança: provável (código dos dois lados; não há vaga real para reproduzir)
- Onde: `web/src/pages/worker/feed/Feed.tsx:67-80` (`open` = todas as vagas do store, `passesFilters`, `orderJobs`), `feedUI.ts:140-162`; servidor: `feed_jobs` (u49/u52/u53/u65, staging).
- Prova: a lista mostrada vem do store inteiro (não da resposta do `feed_jobs`) e aplica de novo: (1) cidade **e** raio (`cityLabel(j) === location && distância <= raio`), enquanto o servidor aplica cidade **ou** raio (`st_dwithin` sem olhar a cidade — DECISOES.md:505 "da cidade escolhida ou do raio"); as opções da tela são 5/10/20 km e "Toda a cidade", então hoje o raio nunca alcança outra cidade e as vagas vizinhas que o servidor manda são jogadas fora (a página de 30 pode vir quase toda descartada, com "Carregar mais" ainda ligado); (2) "Durante a semana"/"Fim de semana": servidor trata `dias` nulo como "qualquer" (`coalesce`), o app exclui `dias` nulo (`feedUI.ts:147-148`); (3) "Hoje"/"Amanhã" e `isExpired` usam a data do aparelho, o servidor usa `bicos_today()` (America/Sao_Paulo); (4) o app põe as vagas da própria empresa na frente (rank 0), o servidor não; (5) a distância e o raio usam o ponto exato no app e o ponto de área arredondado no servidor.
- Impacto: pequeno hoje (poucas vagas, filtros simples), mas o mural pode mostrar ou esconder uma vaga em relação ao que o servidor decidiu, e quem mexer no filtro num lado esquece do outro.
- Causa raiz: a lógica do mural demo (que filtra tudo no aparelho) foi mantida por cima da leitura paginada do servidor (X01).
- Correção recomendada: no modo real, mostrar a lista pela ordem/pelos ids devolvidos por `feed_jobs` (guardar os ids da consulta) e deixar o filtro local só para o demo; ou apagar o filtro por cidade do `passesFilters` quando há raio e documentar que o raio é só dentro da cidade (e então tirar `p_radius_km` do servidor ou juntar `j.city = p_city`).
- Critério de aceite: teste que, com a consulta da tela, compara a lista do app com a ordem de `feed_jobs` para um conjunto de vagas incluindo `dias` nulo e uma vaga de outra cidade dentro do raio.
- Dependências: nenhuma.
- Origem: M1-004 (M1)

### AUD-179 — Pequenas folgas na validação: assinatura do webhook com `ts` não numérico, `APP_ORIGIN` aceita `https://*.com`

- Área: código
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado (executado em Deno 2.9.6)
- Onde: `web/supabase/functions/_shared/mercadopago.ts:76`; `web/supabase/functions/_shared/origin.ts:17-20`
- Prova: (1) `validSignature` com um cabeçalho cujo `ts` é `abc` e HMAC correto devolve `true` (`Math.abs(NaN) > 900` é falso, então a janela de 15 min é ignorada); `ts` de 1 hora atrás devolve `false`. Só quem tem o segredo consegue assinar, então não há ataque de fora; mas o teste de repetição fica sem efeito se o `ts` for sempre inválido. (2) `originsProblem(['https://*.com'])` e `['https://*.pages.dev']` devolvem `null` (aceitos) e `allowedOrigin(['https://*.com'], 'https://evil.com')` devolve `https://evil.com`: um erro de digitação no segredo `APP_ORIGIN` abre o CORS para a internet inteira em vez de recusar subir.
- Impacto: baixo; são armadilhas de configuração e de futuro.
- Causa raiz: validações por regex sem checar `Number.isFinite` nem a profundidade do curinga.
- Correção recomendada: `if (!Number.isFinite(ts)) return false;` e exigir pelo menos 3 rótulos depois de `*.` (ex.: `*.algo.pages.dev`), com teste em `edgeOrigin.test.ts`.
- Critério de aceite: os dois casos acima passam a ser recusados em teste.
- Dependências: nenhuma.
- Origem: D4-008 (D4)

### AUD-196 — Higiene: duplicações e comentários/documentos desatualizados

- Área: código
- Severidade: S3 baixo
- Esforço: P
- Confiança: confirmado
- Onde: (a) três listas de meses: `utils/dates.ts:5`, `format.ts:74`, `jobInfo.ts:161`; (b) duas `fold` diferentes: `utils/text.ts:2` e `addressText.ts:4`; (c) `types/supabase.ts:1-5` diz que o SQL é "rascunho" e que o back end escreve as migrations a partir dele (hoje é o contrário); declara 18 de 39 tabelas e 50 de 147 RPCs; o drift-check (l.613-644) só vê colunas declaradas (faltam ex. `jobs.hidden_at`, `accounts.suspended_at`) e só a existência das RPCs, mas nenhum argumento divergiu (`probe.cjs`); (d) `env.d.ts:3-4` diz que as variáveis são opcionais (só no demo; `npm run build` exige 6; Firebase fora do `.env.example` = AUD-200); (e) `types/models.ts`: exemplos "pedreiro-acabamento"/"Construtora Meridiano" (l.37/44) e comentário solto "F10: the days a worker takes jobs." (l.327); (f) `components/NotFound.tsx` e `PageNotFound` (`App.tsx:21`) são duas telas 404; (g) CLAUDE.md §3 lista 9 status, o código tem 11 (M1-006)
- Prova: leitura e script de comparação com `database.generated.ts`.
- Impacto: uma mudança futura exige lembrar das cópias; cabeçalhos enganam.
- Causa raiz: acúmulo entre rodadas.
- Correção recomendada: um `MONTHS`, renomear uma `fold`, atualizar cabeçalhos, unificar a tela 404.
- Critério de aceite: sem duplicata nem cabeçalho errado.
- Dependências: nenhuma
- Origem: C6-009 (C6); também reportado por: C1-006, C2-015, C4-014, C5-019, D3b-011, D3a-011, M1-006, D5-019
- Ocorrências adicionais (mesmo problema, outros lugares):
  - C1-006 (S3): Documentos e comentários desatualizados nos serviços de conta/candidatura/vaga (higiene) — onde: `web/src/services/account.ts:17` (diz que `exportMyData` "envia uma cópia para o e-mail… uma Edge Function monta e envia"; o código real baixa um JSON no aparelho: `remote/actions.ts:140-153`; o demo não faz nada); `auth.ts:79-83` (dois blocos `/** */` seguidos: o primeiro explica `SignInError` mas fica solto), `auth.ts:134` (campo "F15: recruiter — who talks to the candidates" que não existe mais desde o U63), `auth.ts:380,386` e `applications.ts:125` (parâmetros chamados `_email`, `_newPasswor
  - C2-015 (S3): Código morto e comentários trocados de lugar nos serviços (higiene) — onde: supabaseMappers.ts:66-82, 112-132, 162-213, 368-407, 427-440, 462-541 (`*ToRow`, `databaseFromRows`, `databaseToInserts`, `DatabaseRows`: `grep` fora de supabaseMappers.ts → só `jobToRow` em src; `databaseFromRows/ToInserts` só em 1 teste); supabaseMappers.ts:411 (reexport de `relativeTime` que ninguém importa daqui); payments.ts:28-30 (imports no meio do arquivo e `jobInfo` importado duas vezes), :283 (e-mail hardcoded em vez de `SUPPORT_EMAIL`, features.ts:47); notifications.ts:23-27 (comentár
  - C4-014 (S3): Higiene de código nas telas — onde: `pages/worker/JobDetail.tsx:95` (comentário Z06 invalidado pelo U53) e `:67` (`useAction` com callback vazio); `pages/recruiter/JobManage.tsx:286-294`; `JobClosed.tsx:63` (`as Worker`); `InviteSheet.tsx:65` (um único `loading` para todos os botões "Convidar"); `pages/worker/VerifyIdentity.tsx:43-49,70-74` (vaza `createObjectURL` ao refazer a foto); `CandidateActions.tsx:76-83` (diz "já foram preenchidas" também quando a vaga venceu ou foi encerrada); `services/payments.ts:283` (repete `SUPPORT_E
  - C5-019 (S3): Código morto e comentários desatualizados nos componentes — onde: `Rating editable`, `Input prefix`, `Card lg`, exports do knip (`AVATAR_BORDER`, `StarPicker`, `TileSkeleton`); comentários (`lg`=770 px, não 1024); hex soltos
  - D3b-011 (S3): Comentários e cabeçalhos de migration desatualizados — onde: `migrations/20261017000200_r04_exclusao_pelo_painel.sql` e o comentário de `delete_my_account` (anonimizar; desde U24 apaga); textos "obra/construtora" do r03 (o staging já diz "empresa/local"); `20261013000200_f10_perfil_profissional.sql` (campos que o teste diz terem saído no U33)
  - D3a-011 (S3): Mesmo ID de mudança usado em rodadas diferentes (L10, L11, L13) — onde: `l10_cnpj_receita` × `lanc10_link_publico`; `l13_conta_google` × `lanc13_mural_volume`; `l11_validacao_perfil` × CLAUDE.md §7.7; `APLICAR.md` #12 "(Y24 + L10)", #21 e #42 "(L10)", #22 e #44 "(L13)"; `migrations/20261011000500_y24_verificacao.sql:1` cita um "L10" que só nasce no dia seguinte
  - M1-006 (S3): Documentos e comentários descrevem a máquina de status de um jeito que já não é o do banco — onde: `web/docs/CONTRATO-BACKEND.md:95-96` ("Rotina diária: contratado com `end_date < hoje` vai para concluída") — o banco conclui **2 dias depois** do último dia (`job_last_day + 2 <= hoje`) e roda **de hora em hora** (`bicos-concluir-diarias`, `7 * * * *`), com "a combinar" = criação + 30 dias; `CONTRATO-BACKEND.md:136` (`deleteJob`: "deleted_at = now()") — a RPC recusa se há pré-selecionado/contratado, recusa quem esperava com aviso e fecha a vaga; `web/src/services/applicationMachine.ts:3` cita `
  - D5-019 (S3): Documentos internos desatualizados em relação ao código — onde: `web/docs/LGPD.md:18` ("Data de nascimento / 18+": não se coleta data de nascimento, só uma caixa `maior_de_idade` gravada no metadado do Auth no cadastro por e-mail — `web/src/services/remote/auth.ts:228` — e não gravada no cadastro por Google/celular, onde `create_my_account(p_adult)` só valida e descarta); `LGPD.md:15,21,22,24` falam de "construtoras", "obra", "tipo de obra" (colunas e termos já removidos no U12/U48); `LGPD.md:19,31,32,33,35,55` ainda têm 6 campos `{{…}}` próprios; faltam lin
