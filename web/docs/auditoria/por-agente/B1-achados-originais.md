# B1 — Telas do visitante e do trabalhador, no navegador (demo, 360×800 e 1280×800) (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente B1 (o agente não conseguiu gravar o arquivo; `coverage.tsv` com 237 linhas, logs, scripts e 339 prints existem em `$SCRATCH/out/B1/` e `$SCRATCH/prints/B1/`). Nenhum erro de console nem requisição falha em ~120 rotas × perfil × tela. Todos os achados foram reproduzidos no demo, salvo onde indicado. Contagem: S0 0, S1 0, S2 1, S3 12, M 1. Caminhos relativos a `web/src/`.

### B1-001 — Cadastro perde tudo ao recarregar a página no passo do código do WhatsApp

- Área: UX
- Severidade: S2
- Esforço: M
- Confiança: confirmado
- Onde: `pages/shared/Signup.tsx`; `services/auth.ts` (rascunho `pendingSignUp` só em memória; DECISOES Y22 cobre "sair do fluxo", não o descarte da aba)
- Prova: `$SCRATCH/out/B1/signup5.cjs`, `signup_run5.txt`: preencher nome, CPF, e-mail, `reload` → volta ao passo 1 vazio.
- Impacto: ler o código no WhatsApp tira o navegador da tela; um celular simples descarta a aba e a pessoa recomeça o cadastro do zero.
- Causa raiz: rascunho do cadastro só em memória.
- Correção recomendada: guardar nome, lado e passo (nunca a senha) em `sessionStorage`.
- Critério de aceite: e2e com `reload` no passo do código volta ao mesmo passo.
- Dependências: nenhuma

### B1-002 — Título do documento igual em todas as telas

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `web/index.html:6`; `grep document.title web/src` vazio
- Prova: "Bicos — bicos e diárias perto de você" nas 118 visitas.
- Impacto: ver C6-001 (mesmo problema).
- Causa raiz: sem título por rota.
- Correção recomendada: título por rota.
- Critério de aceite: títulos distintos por tela.
- Dependências: C6-001 (consolidar), B1-011

### B1-003 — `/privacidade` estoura a largura em 360 px; marcadores `{{…}}` aparecem ao público

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/LegalScreen.tsx`; `services/legal.ts:148` (`{{BASE_TRANSFERENCIA_INTERNACIONAL}}` não quebra linha)
- Prova: `scrollWidth 371` em 360 px. Os marcadores `{{…}}` aparecem ao público (9 na política, 4 nos termos) até o advogado revisar.
- Impacto: rolagem horizontal na política; textos legais com buracos visíveis (ver D5-005).
- Causa raiz: sem `overflow-wrap` e campos em branco.
- Correção recomendada: `overflow-wrap:anywhere` no `LegalScreen`; preencher os campos (ação do responsável).
- Critério de aceite: sem rolagem horizontal em 360 px; nenhum `{{` na tela.
- Dependências: D5-005

### B1-004 — Foco não vai ao campo com erro nem ao campo do passo novo

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Signup.tsx`, `ChangePassword.tsx`, `ChangeEmail.tsx`, `ChangeWhatsApp.tsx`
- Prova: `signup_run2.txt`, `signup_run3.txt`: o foco fica no botão Continuar ou em BODY.
- Impacto: quem usa teclado ou leitor de tela não sabe onde está o erro.
- Causa raiz: sem gestão de foco nos erros e nos passos.
- Correção recomendada: focar o primeiro campo com erro e o campo do passo novo.
- Critério de aceite: após erro o `activeElement` é o primeiro campo inválido.
- Dependências: nenhuma

### B1-005 — Alvos de toque < 44 px nas telas do trabalhador (medidos em 360 px)

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: Denunciar 59×16; Remover experiência 28×28 e Editar 247×26 (`/perfil/editar`); Adicionar experiência 36×36; Mostrar senha 36×36; "Esqueci minha senha" 148×36; "Criar minha conta" (login) 126×40; Tema claro/escuro 37×34; Filtros 90×36; Mais perto/Maior valor/Mais cedo 104×40; Salvar vaga, Remover dos salvos, Excluir post, Falar no WhatsApp 40×40; "Marcar todas como lidas" 208×36; chips de avaliação ×36; Sair 50×40; Trocar e-mail 87×36
- Prova: medição por Playwright em 360 px. Em 1280 não importa.
- Impacto: erro de toque para quem usa celular simples e mãos de trabalho.
- Causa raiz: `tap-target` não aplicado (ver C3-008, C5-009).
- Correção recomendada: aplicar `tap-target`/`min-h-11`.
- Critério de aceite: nenhuma medição < 44 px nas telas do trabalhador.
- Dependências: nenhuma (consolidar com C3-008, C5-009, B2-006)

### B1-006 — Busca no mural com texto longo sem espaços: o título "Nenhuma vaga para “…”" sai do cartão

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `components/EmptyState.tsx`; print `$SCRATCH/prints/B1/B1_mural_m_busca_longa.png`
- Prova: print.
- Impacto: layout quebrado.
- Causa raiz: sem quebra de palavra longa.
- Correção recomendada: `break-words` no título do `EmptyState`.
- Critério de aceite: o título não sai do cartão.
- Dependências: nenhuma

### B1-007 — `/entrar-celular` sem botão, mas abre por link e responde "Na demonstração, entre com e-mail e senha"

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: provável
- Onde: `services/auth.ts:530`; `routes.ts:128` (rota sem guarda); DECISOES:1988
- Prova: com `phoneLogin` desligado a tela responde a mensagem de demonstração.
- Impacto: em produção a mensagem é errada.
- Causa raiz: rota acessível com o recurso desligado.
- Correção recomendada: redirecionar ao `/login` se `!FEATURES.phoneLogin`.
- Critério de aceite: `/entrar-celular` com o recurso desligado leva ao login.
- Dependências: nenhuma

### B1-008 — Suporte é um Gmail fixo no código; `/ajuda` só tem esse `mailto:`

- Área: produto
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `services/features.ts:47` (`[e-mail pessoal da equipe]`); `pages/shared/Help.tsx`
- Prova: o WhatsApp de suporte só existe com `VITE_SUPORTE_WHATSAPP`.
- Impacto: usuário vê um e-mail pessoal de desenvolvedor como suporte (ver O1-014).
- Causa raiz: padrão de teste virou configuração.
- Correção recomendada: criar e-mail no domínio e usar variável de ambiente.
- Critério de aceite: nenhum e-mail pessoal no bundle.
- Dependências: ação do responsável (criar o e-mail); O1-014

### B1-009 — Textos que contradizem o contexto

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `/selecionado/BC-4830` (candidatura em análise) tem título "Você avançou" e corpo "Essa tela não está disponível"; `pages/shared/PublicJob.tsx:97` (trabalhador já logado em `/v/<inexistente>` lê "Entre para ver outros bicos")
- Prova: reproduzido no demo.
- Impacto: mensagens erradas confundem.
- Causa raiz: textos reaproveitados sem ramo para o estado.
- Correção recomendada: ramos de texto por estado.
- Critério de aceite: textos coerentes nesses dois casos.
- Dependências: nenhuma

### B1-010 — Cadastro aceita "Maria 😀 Souza" e não limita o nome; o editar perfil limita em 80

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/shared/Signup.tsx`, `EditWorkerProfile.tsx`
- Prova: reproduzido.
- Impacto: regra de nome inconsistente.
- Causa raiz: validações separadas.
- Correção recomendada: unificar a regra (comprimento e caracteres).
- Critério de aceite: mesma regra nas duas telas e no banco.
- Dependências: nenhuma

### B1-011 — Sem `h1` em várias telas

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `/splash`, `/perfil`, `/trabalhador/:id`, `/construtora/:id` e telas de erro de vaga/avaliação
- Prova: inspeção do DOM.
- Impacto: leitor de tela sem título de página.
- Causa raiz: nome em `<span>`.
- Correção recomendada: `h1` nessas telas.
- Critério de aceite: axe sem violação de `page-has-heading-one`.
- Dependências: nenhuma (relacionado a C3-011)

### B1-012 — (melhoria agora, barata) Compartilhar vaga só oferece WhatsApp; sem "Copiar link"

- Área: produto
- Severidade: M
- Esforço: P
- Confiança: confirmado
- Onde: `utils/share.ts` (`navigator.share` ou `wa.me`)
- Prova: leitura e uso no demo.
- Impacto: o link público `/v/…` é a porta de entrada; no desktop e em celulares sem Web Share não há alternativa.
- Causa raiz: um único canal.
- Correção recomendada: botão "Copiar link".
- Critério de aceite: botão copia o link `/v/<slug>`.
- Dependências: C3-001

### B1-013 — Verificar identidade: arquivo que não é imagem é aceito como selfie sem aviso

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `pages/worker/VerifyIdentity.tsx:41-46` (só `URL.createObjectURL`); `services/remote/storage.ts:138-146`
- Prova: no modo real só falha ao enviar ("Não conseguimos abrir essa foto"); o portfólio avisa na hora ("Escolha uma foto ou um vídeo."): inconsistente.
- Impacto: a pessoa só descobre no envio.
- Causa raiz: validação de tipo ausente.
- Correção recomendada: validar tipo e tamanho ao escolher.
- Critério de aceite: aviso imediato para arquivo inválido.
- Dependências: nenhuma

### B1-014 — Em 360 px o status mais importante é cortado

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: Minhas candidaturas (chip "Pré-selecionado" vira "Pré-seleci…"; o botão redondo do WhatsApp cobre o chip; `$SCRATCH/prints/B1/B1_minhas_cand_m.png`); mural (título do cartão em 2 colunas vira "Garçom para almoço e…"); datas das vagas salvas truncadas
- Prova: prints.
- Impacto: o trabalhador não lê o próprio status.
- Causa raiz: layout com largura fixa.
- Correção recomendada: status em linha própria/duas linhas; não sobrepor o botão.
- Critério de aceite: status completo visível em 360 px.
- Dependências: nenhuma

## Hipóteses não confirmadas

- Trocar WhatsApp para número de outra conta passa no demo (o cadastro barra): outro agente deve confirmar no real (ver B2-008).
- `/redefinir-senha` sem link do e-mail mostra o formulário (no real o Supabase deveria recusar; ver C3-014).

## Bom e deve ser preservado

- Mensagens de erro claras e sem jargão; `inputmode`/`autocomplete`/`type` corretos (CPF numérico, e-mail, tel, `one-time-code`, 16 px).
- Anti-duplicidade no duplo clique em Criar conta, Candidatar, Entrar, Excluir conta, Salvar senha e Publicar post.
- Tratamento offline com mensagem em português sem perder o formulário; candidatura duplicada e vaga encerrada barradas por link direto.
- Exclusão em duas etapas com aviso dos bicos em andamento.
- Guardas de rota (visitante→login com retorno, trabalhador em área de empresa, "Voltar" após sair não reentra).
