# C3 — Telas compartilhadas (web/src/pages/shared, 35 arquivos) (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente C3 (o agente não conseguiu gravar o arquivo). As 35 telas foram lidas por inteiro. Contagem: S0 0, S1 1, S2 2, S3 13, M 3. Caminhos relativos a `web/src/`. Prints em `$SCRATCH/prints/C3/`.

### C3-001 — Link público da vaga e Ajuda quebram para quem não está logado (build de produção)

- Área: bug
- Severidade: S1
- Esforço: P
- Confiança: confirmado
- Onde: `layouts/AppShell.tsx:93-94`; `App.tsx:176-184`; `routes.ts` (`isAuthFlow`, ~l.198-203; rotas `/v/:id`, `/ajuda`, `/completar-cadastro` com acesso `public`)
- Prova: `App.tsx` só pula o `AppShell` para rotas de `isAuthFlow`; `/v/…` e `/ajuda` não estão nessa lista. Para quem não é recrutador (visitante conta como "trabalhador"), `AppShell.tsx:93-94` faz `const worker = currentWorker(db); account = { name: worker.name … }`. Sem sessão, `currentWorker` lê `db.workers['jorge']`, id do seed de demonstração, que só existe no modo demo. Teste vitest isolado (`$SCRATCH/c3work/guest.test.tsx`, `IS_DEMO=false`): `role=trabalhador session=null worker=undefined -> Cannot read properties of undefined (reading 'name')`. Navegador: build real `$SCRATCH/dist-c2` (Supabase `x.supabase.co` interceptado, RPC `public_job_card` devolvendo uma vaga válida), visitante sem conta: `GET /v/k7m2q9x4tbn3` e `GET /ajuda` mostram "Essa tela não abriu — Algo deu errado do nosso lado…"; console `TypeError: Cannot read properties of undefined (reading 'name')`. Prints: `$SCRATCH/prints/C3/visitor-_v_k7m2q9x4tbn3.png` e `visitor-_ajuda.png`. Nenhum teste cobre isso: os unitários rodam em Node sem DOM (`vite.config.ts:166-167`) e nenhum `e2e/fluxos/*.spec.ts` abre `/v/` ou `/ajuda` sem sessão.
- Impacto: o link que a empresa manda no WhatsApp é a porta de entrada de novos trabalhadores e abre uma tela de erro para quem não tem conta. No modo demo funciona, por isso passou despercebido.
- Causa raiz: as telas públicas ficam dentro do casco do app logado, que assume que existe um perfil. O fallback "nunca undefined" de `selectors.ts` só vale no demo.
- Correção recomendada: em `Routes`, não usar `AppShell` quando `session === null` (ou pôr `/v/` e `/ajuda` em `isAuthFlow`); em `AppShell`, usar `worker?.name`; acrescentar e2e "visitante abre /v/<slug> e /ajuda" no modo real.
- Critério de aceite: build real com Supabase interceptado: `/v/<slug>` mostra título, valor e "Entrar para me candidatar"; `/ajuda` mostra as perguntas; sem erro no console.
- Dependências: nenhuma (relacionado a C3-003 e C3-017)

### C3-002 — "Conta excluída" contradiz a exclusão real

- Área: LGPD
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/AccountDeleted.tsx:12-15`; contraste: `DeleteAccount.tsx:121-123`, `services/legal.ts:155`, migration `20261020000300_u24_exclusao_completa.sql`, `DECISOES.md` U24
- Prova: AccountDeleted: "As avaliações e o histórico dos bicos continuam, sem o seu nome." DeleteAccount: "…apagado de vez: … as avaliações que você fez e recebeu." U24 (reaplicada na u48) apaga avaliações dos dois lados, candidaturas e vagas. `grep "sem o seu nome"` só acha esse arquivo.
- Impacto: a última mensagem que a pessoa lê afirma o contrário do que a Política promete.
- Causa raiz: a U24 atualizou `DeleteAccount` e a Política, mas não esta tela. O comentário do topo de `supabase/functions/excluir-conta/index.ts` também ficou velho ("anonimiza … as avaliações").
- Correção recomendada: "Seu perfil, suas fotos, seus contatos, suas vagas, candidaturas e avaliações foram apagados…"; atualizar o comentário da função.
- Critério de aceite: texto coerente com a Política; `grep "sem o seu nome" web/src` vazio.
- Dependências: complementa D5-009, D5-019 e D2-003 (hoje as avaliações escritas pela conta NÃO são apagadas)

### C3-003 — Sem caminho para a Ajuda/suporte nas telas onde mais gente trava

- Área: UX
- Severidade: S2
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Login.tsx`, `Signup.tsx`, `VerifyEmail.tsx`, `CompleteProfile.tsx`, `Splash.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx` (nenhuma tem link); `Help.tsx:1-2` afirma que "the login screen links here too"
- Prova: `grep "'/ajuda'" web/src` acha só `accountMenu.ts:18,25`, `Settings.tsx:122` e `recruiter/Payments.tsx:94`, todas dentro do app logado. `git log -S"navigate('/ajuda')" -- Login.tsx` não retorna nada: o link nunca existiu. Com C3-001, a Ajuda também não abre hoje para visitante.
- Impacto: e-mail com código que não chega, senha esquecida e "Não deu para criar a conta com esse CPF" não oferecem "Falar com o suporte". A pessoa só pode desistir.
- Causa raiz: o suporte só existe dentro do app logado.
- Correção recomendada: link discreto "Preciso de ajuda" (WhatsApp do suporte via `whatsappUrl(SUPPORT_WHATSAPP)`) no rodapé do Login, no cabeçalho do VerifyEmail e na mensagem de CPF recusado; corrigir o comentário de `Help.tsx`.
- Critério de aceite: de `/login`, `/cadastro/*` e `/verificar-email` há toque visível para o suporte.
- Dependências: C3-001

### C3-004 — Ajuda manda "pedir o link de novo" no e-mail de confirmação, mas desde a U11 é código

- Área: docs
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Help.tsx:27-30`; a tela real é `VerifyEmail.tsx:213-216` ("código de 6 números", "Reenviar código")
- Prova: leitura dos dois textos.
- Impacto: quem procura ajuda recebe instrução errada.
- Causa raiz: texto não atualizado na U11.
- Correção recomendada: "pedir o código de novo ou trocar o e-mail".
- Critério de aceite: texto de ajuda coerente com a tela.
- Dependências: nenhuma

### C3-005 — "Ver outros bicos" numa vaga encerrada vai ao login e volta para a mesma vaga

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/PublicJob.tsx:174`, `:104`, `:58-61`
- Prova: o ramo `!open` usa `onApply`, que é `enter('/login', card.job.id)` e grava `RETURN_TO='/vaga/BC-n'`; depois do login, `Login.tsx` faz `navigate(back || '/mural')` e cai na vaga fechada.
- Impacto: o botão que deveria levar a outros bicos leva de volta à vaga encerrada.
- Causa raiz: o ramo de vaga fechada reaproveita o fluxo de candidatura.
- Correção recomendada: no ramo `!open`, chamar `enter('/login')` sem `jobId`.
- Critério de aceite: depois do login o usuário chega em `/mural`.
- Dependências: nenhuma

### C3-006 — Legenda em edição sobrevive ao fechar o visualizador e vai para outro post

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/PostViewer.tsx:25,59,117,130`; `WorkerPosts.tsx:88`
- Prova: `editing` é `useState` do `PostViewer`, que fica sempre montado e só devolve `null` quando fechado; `go()` faz `setEditing(null)`, mas o botão Fechar e a tecla Esc não. Passos: abrir o post A, "Editar legenda", fechar, abrir o post B: o editor abre com a legenda de A e "Salvar" chama `updatePostCaption(B.id, <legenda de A>)`.
- Impacto: a legenda de um post pode sobrescrever a de outro sem a pessoa perceber.
- Causa raiz: estado de edição não é zerado ao fechar.
- Correção recomendada: `useEffect(() => { if (index === null) setEditing(null) }, [index])`.
- Critério de aceite: teste de tela: editar A, fechar, abrir B mostra a legenda de B sem editor aberto.
- Dependências: nenhuma

### C3-007 — "Publicar trabalho": o erro anterior reaparece ao reabrir a janela

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/WorkerPosts.tsx:89,194-211,266-267`
- Prova: `Composer` fica sempre montado; `fileError` (`useState`) e `publish.error` (`useAction`) vivem nele; `closeAndReset` (l.195) limpa só o `ui`. Escolher um vídeo grande demais, fechar e reabrir mostra a janela vazia com o erro vermelho antigo.
- Impacto: confusão ao reabrir a janela.
- Causa raiz: reset incompleto.
- Correção recomendada: no `closeAndReset`, `setFileError(null); publish.reset()`.
- Critério de aceite: reabrir a janela não mostra erro antigo.
- Dependências: nenhuma

### C3-008 — Alvos de toque pequenos nas telas de entrada e leitura

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (valores de classe)
- Onde: `pages/shared/Login.tsx:174` ("Esqueci minha senha", `h-9`, sem `tap-target`) e `:191` (`h-10`); `PhoneSignIn.tsx:141` e `WhatsAppCode.tsx:64` (`h-9`); `VerifyEmail.tsx:305` (`h-10`); `Notifications.tsx:45` (`h-9`); "Denunciar" em `ReviewsScreen.tsx:106-112` e `WorkerPosts.tsx:166-172` (`text-xs`, sem altura nem padding, ~16 px); o × de `ExperiencesField.tsx:103-112` (28 px); olho de `PasswordInput` em `components/Input.tsx` (`w-9 h-9`), usado em Login, Cadastro, Trocar senha e Excluir conta
- Prova: a convenção X05 (`styles/base.css:266-277`) é `tap-target` com mínimo de 44 px; esses elementos não usam a classe.
- Impacto: erro de toque nos pontos de recuperação de senha e na ação de segurança "Denunciar", para quem usa celular simples.
- Causa raiz: a classe `tap-target` não foi aplicada.
- Correção recomendada: `relative tap-target` ou `min-h-11` nesses botões.
- Critério de aceite: axe ou Playwright com alvo de 44 px ou mais nessas telas.
- Dependências: nenhuma

### C3-009 — Contagem do "reenviar código": três cópias, relógios que nunca param, "0:60" no SMS

- Área: código
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/VerifyEmail.tsx:325-336`, `WhatsAppCode.tsx:27-35,105-108`, `PhoneSignIn.tsx:30-35,168`
- Prova: três implementações e duas cópias de `clock()`; os `setInterval` (1 s, 1 s e 250 ms) continuam rodando depois de zerar e re-renderizam a tela inteira; `PhoneSignIn.tsx:168` monta `0:${padStart(wait)}` com `wait` de até 60 e mostra "0:60".
- Impacto: gasto de bateria/CPU e um texto errado.
- Causa raiz: duplicação sem hook compartilhado.
- Correção recomendada: um hook `useCountdown` que para em zero, e um `clock()` em `utils/`.
- Critério de aceite: um único hook; sem intervalo ativo depois de zerar.
- Dependências: nenhuma

### C3-010 — Trocar WhatsApp: com captcha ligado, "Reenviar código" falha (latente)

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável (captcha e código de WhatsApp estão desligados hoje)
- Onde: `pages/shared/ChangeWhatsApp.tsx:141` (widget só no passo `numero`) e `:87-98` (`resend` no passo `codigo`); `components/Captcha.tsx:82-86` (`getToken` devolve `undefined` sem widget); `supabase/functions/codigo-whatsapp/index.ts:63` (`captchaOk`)
- Prova: ao passar para `codigo` o widget desmonta e `getToken()` volta `undefined`; a função recusa com `captcha` quando a chave existe. Signup, Login e DeleteAccount deixam o widget sempre montado no rodapé.
- Impacto: quando o Turnstile for ligado, o reenvio do código para trocar o WhatsApp quebra.
- Causa raiz: o widget só existe num dos passos.
- Correção recomendada: mover `{captcha.widget}` para o rodapé fixo.
- Critério de aceite: com captcha ligado, reenviar código funciona.
- Dependências: ação do responsável (ligar Turnstile e Twilio) torna o problema real

### C3-011 — Foco/nome acessível ausentes (checkbox, "não lida", selo, progresso)

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: provável (leitura de código)
- Onde: `components/Checkbox.tsx:17-26` (usado em Signup 18+/termos, AcceptTerms, DeleteAccount); `pages/shared/Notifications.tsx:75-77`; `WorkerProfileScreen.tsx:114-118`; `components/FlowLayout.tsx:47-59`; `CompanyProfileScreen.tsx:110`; `WorkerProfileScreen.tsx:125`
- Prova: o input do checkbox é `sr-only peer` e a caixa desenhada não tem `peer-focus-visible`; o `:focus-visible` global (`base.css:45`) cai no input invisível. `<span aria-label="Não lida">` sem `role` não é lido. O selo de verificado no avatar é só um ícone. "Passo n de N" não é `aria-live` e a barra não tem `role=progressbar`. Os nomes nos perfis são `<span>`, sem `h1`.
- Impacto: quem navega por teclado não vê onde está o foco nos termos do cadastro; leitor de tela perde o selo e o progresso.
- Causa raiz: componentes sem estados de acessibilidade.
- Correção recomendada: `peer-focus-visible:ring-4`; `role="img"` ou texto `sr-only` na bolinha; `aria-label` no selo; `progressbar` e `aria-live`; `h1` nos nomes.
- Critério de aceite: axe sem violação nessas telas e foco visível no checkbox.
- Dependências: nenhuma

### C3-012 — Termos e gênero inconsistentes

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/ChooseProfile.tsx:53` ("usar o Bicos"; no resto são 22 ocorrências de "a/na Bicos"); `Signup.tsx:94` (`'Cadastro de recrutador'`; a regra é "empresa" na tela); `Settings.tsx:93` ("O que chega no app e no celular") com push desligado (`NotificationSettings.tsx:56` só mostra "No celular" se `FEATURES.push`)
- Prova: leitura e `grep`.
- Impacto: textos inconsistentes e uma promessa de aviso no celular que o app não cumpre.
- Causa raiz: textos sem revisão central.
- Correção recomendada: "a Bicos"; "Cadastro de empresa"; descrição condicionada a `FEATURES.push`.
- Critério de aceite: `grep -n "recrutador" web/src/pages` sem texto de tela.
- Dependências: nenhuma

### C3-013 — Exportar dados: depois de exportar, o botão some

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/Privacy.tsx:40-60`
- Prova: `exported=true` troca o botão pelo aviso "Arquivo baixado" até sair da tela. Se o navegador bloqueou o download, não há como baixar de novo. O texto "Perfil, candidaturas, avaliações e avisos" é menor que o conteúdo real (D5-007).
- Impacto: direito de acesso difícil de exercitar se o download falhar.
- Causa raiz: estado `exported` oculta o botão.
- Correção recomendada: manter o botão, com texto "Baixar de novo".
- Critério de aceite: botão continua visível após exportar.
- Dependências: D5-007

### C3-014 — Link de redefinir senha vencido só avisa depois que a pessoa digita

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/ResetPassword.tsx:31-46`; `services/remote/auth.ts:378-382`
- Prova: o formulário abre sempre (rota pública); só `resetPassword()` checa a sessão e recusa depois da digitação. O erro de força da senha cai embaixo do campo "Confirme", pois há um único `error`.
- Impacto: a pessoa digita a senha nova e só então descobre que o link venceu.
- Causa raiz: sem checagem da sessão de recuperação ao montar.
- Correção recomendada: ao montar, sem sessão de recuperação, mostrar "Esse link venceu" com "Pedir outro link", sem formulário; pôr o erro de força no campo da senha.
- Critério de aceite: link vencido mostra o aviso antes do formulário.
- Dependências: nenhuma

### C3-015 — "Desfazer" remoção de experiência apaga o que foi adicionado depois

- Área: bug
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/ExperiencesField.tsx:60-68`
- Prova: `onChange(before)` substitui a lista inteira. Remover X, adicionar Y e tocar em "Desfazer" faz Y sumir.
- Impacto: perda do que a pessoa acabou de digitar.
- Causa raiz: desfazer restaura o estado anterior inteiro.
- Correção recomendada: reinserir só o item removido, na posição original.
- Critério de aceite: teste de tela do cenário acima.
- Dependências: nenhuma

### C3-016 — "Desbloquear": todos os botões giram juntos

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/BlockedAccounts.tsx:43-49`
- Prova: `loading={unblock.loading}` é compartilhado entre as linhas; todos viram spinner sem rótulo e ficam desativados.
- Impacto: confusão ao desbloquear uma conta específica.
- Causa raiz: estado de carregamento global da ação.
- Correção recomendada: guardar o `id` em andamento.
- Critério de aceite: só o botão tocado mostra o spinner.
- Dependências: nenhuma

### C3-017 — (melhoria agora) Link da vaga no WhatsApp mostra sempre a mesma pré-visualização

- Área: produto
- Severidade: M
- Esforço: M
- Confiança: provável
- Onde: `web/index.html:33-45` (og:* fixos, `og:url`=`__SITE_URL__/`); `pages/shared/PublicJob.tsx` (sem `<title>` dinâmico); `web/public/` (sem pré-renderização)
- Prova: o raspador do WhatsApp não executa JavaScript, então todo `/v/<código>` entrega o mesmo `index.html`.
- Impacto: o link que a empresa compartilha não mostra a vaga na prévia, o que reduz cliques; é a principal forma de divulgação do produto.
- Causa raiz: app só no cliente, sem renderização por rota.
- Correção recomendada: Pages Function ou Worker em `/v/*` que consulta `public_job_card` e devolve o HTML com `og:title/description` da vaga, sem endereço.
- Critério de aceite: `curl -A WhatsApp /v/<slug>` traz `og:title` com a vaga.
- Dependências: C3-001 e a decisão de hospedagem

### C3-018 — (melhoria agora) Cadastro: cada "Continuar" fecha o teclado

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: provável (código; não medido em aparelho)
- Onde: `pages/shared/Signup.tsx:285-295,595-612` (`key={field.id}`); `hooks/useTextField.ts:7-11,28-33`
- Prova: o `autoFocus` vale uma vez por documento; o código foca o próximo campo só quando o avanço veio por Enter (`advancedByEnter`). No toque o campo é remontado e o teclado fecha, o que dá cerca de 5 toques extras.
- Impacto: cadastro mais lento e cansativo no celular; é o funil de entrada.
- Causa raiz: foco só no avanço por Enter.
- Correção recomendada: focar o novo campo também no toque; medir em aparelho.
- Critério de aceite: o teclado fica aberto entre os passos do cadastro.
- Dependências: nenhuma

### C3-019 — (melhoria futura) Descrição livre da vaga vai ao link público sem filtro de contato

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: provável
- Onde: `pages/shared/PublicJob.tsx:160-171`; `supabase/migrations/20261016000200_lanc10_link_publico.sql:77`
- Prova: a tela diz "O contato aparece para quem a empresa aprovar", mas `public_job_card` devolve `description` inteira e nada valida telefone no texto.
- Impacto: uma empresa pode colocar o telefone na descrição e contornar a regra do WhatsApp só após aprovação (e o aplicativo perde a mediação).
- Causa raiz: descrição livre sem filtro.
- Correção recomendada: aviso ao escrever a descrição ("não coloque telefone aqui").
- Critério de aceite: aviso visível no campo de descrição.
- Dependências: decisão dos sócios

## Hipóteses não confirmadas

- H1: conta só-Google sem senha em `ChangeEmail`/`ChangePassword` (exigem a senha atual; só `DeleteAccount` usa `accountHasPassword`). A U37 já cria senha no cadastro por Google, então só contas antigas seriam afetadas.
- H2: `DeleteAccount`. Se a função apagar a conta e a resposta se perder, uma nova tentativa dá "Senha incorreta". Depende de C2-009.
- H3: download da exportação (`Blob` + `<a download>`) em iPhone/PWA.
- H4: `EditWorkerProfile` salva em 3 passos sem transação. A nova tentativa funciona, então não há perda de dado.
- H5: `NotificationSettings.tsx:52` (`muted: on ? [] : [...]`) sobrescreve a lista. Hoje só existe um grupo na tela.
- H6: o cadastro revela se e-mail, CPF ou WhatsApp já têm conta. É decisão documentada (U10, com limites); a mensagem final é genérica de propósito.
- H7: `/entrar-celular` não tem botão em lugar nenhum. É decisão documentada (DECISOES l.1988), não bug.

## Bom e deve ser preservado

- Senhas só em `useState` local; rascunho do cadastro apagado ao sair; store zerado ao trocar de conta (`store.ts:140-153`).
- Login com mensagem única para credencial errada, `<form>` real para gerenciador de senhas e retorno ao link de origem.
- Cadastro com dígitos verificadores de CPF/CNPJ, checagem de duplicidade por passo, `useBusyWhile` contra toque duplo, `useInnerBack` e `refused()` genérico.
- "Esqueci a senha" sempre responde "Link enviado". `ResetPassword` encerra a sessão curta se a pessoa sair.
- `DeleteAccount`: prova por senha ou código, prévia do impacto, caixa de confirmação mais diálogo.
- `PublicJob`: só entra por slug aleatório, link antigo só logado, flag `alive`. `CodeInput` com `one-time-code`.
- Nenhum `console.*`, `localStorage`, `dangerouslySetInnerHTML` ou import de `data/` nas 35 telas. O único `target=_blank` (`Help.tsx:128`) tem `rel="noopener noreferrer"`. Sem `any`, `@ts-*` ou TODO.
- Perfis, Notificações, Bloqueados e Avaliações usam `ScreenLoading`/`QueryView` (padrão B10).
