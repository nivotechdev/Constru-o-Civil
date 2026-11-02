# B2 — Achados (telas no navegador, demo, empresa/equipe) — gravado aos poucos

Ambiente: build de demonstração (`dist-demo`, porta 4182), Playwright, 360x800 e 1280x800, empresa `empresa@bicos.demo`.
Limitações do demo (não são defeitos do app): não há conta de equipe (`checkStaff` sempre `false`, `src/services/admin.ts:120-126`), nem empresa nova com "verificação pendente" salvo cadastrando uma, nem conta suspensa; os dados voltam ao seed a cada recarga (a sessão fica em `localStorage`, `src/services/store.ts:25-40`); Mercado Pago e código do WhatsApp são simulados.

### B2-001 — Campos numéricos da vaga apagam vírgula, ponto e sinal e mudam o valor sem avisar

- Área: bug
- Severidade: S2 médio
- Esforço: P (< 2 h)
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/CreateJob.tsx:66-68` (`digits()`), `:287` (valor), `:303` (diárias), `:375` (pessoas); limites em `jobForm.ts:78-80`
- Prova: em `/criar-vaga`, passo 2, `#create-job-valor`: digitar `45,50` fica `4550` (prévia "R$ 4.550 por diária") e é aceito; `50,00` vira `5000` (aceito, "R$ 5.000"); `150,50` vira `15050` e dá "Confira o valor: a diária vai até R$ 5.000" (o usuário nunca digitou 5.000); `150.00` vira `15000`. Em diárias: `1.5` vira `15`, `-1` vira `1`. Script `out/B2/f3b.cjs`; print `prints/B2/f3-passo2-m.png`.
- Impacto: quem cola ou digita "120,00" é barrado por uma mensagem que não bate com o que escreveu; quem digita "50,00" publica sem querer uma diária de R$ 5.000 (só a prévia mostra). Dinheiro errado numa vaga que trabalhadores vão ler.
- Causa raiz: o campo remove tudo que não é dígito (`replace(/\D/g, '')`) e não trata centavos nem avisa quando descarta algo.
- Correção recomendada: ao detectar `,` ou `.` seguido de 1–2 dígitos, ou arredondar para a parte inteira (150,50 -> 150) ou recusar com "Use só o valor em reais, sem centavos"; mostrar a prévia "R$ valor por diária" logo abaixo do campo; diárias/pessoas aceitarem só dígitos sem transformar `1.5` em 15.
- Critério de aceite: teste de unidade de `digits`/campo com `45,50`, `150.00`, `1.5`, `-1` e print do passo 2 com a mensagem nova.
- Dependências: nenhuma

### B2-002 — Fotos da vaga aceitam qualquer arquivo e qualquer tamanho, e cortam em 6 sem avisar

- Área: bug
- Severidade: S2 médio
- Esforço: P (< 2 h)
- Confiança: confirmado (reproduzido) para tipo e corte; provável para tamanho (não gerei arquivo gigante)
- Onde: `web/src/components/PhotoManager.tsx:39-48` (usado em `CreateJob.tsx:223` e `JobManage.tsx:230`); a validação existente está só em `web/src/utils/media.ts:28-41` (`portfolioFileProblem`, portfólio do trabalhador)
- Prova: `/criar-vaga`, `setInputFiles` com `nota.txt` e `falso.png` (texto): cada um vira um quadrado de foto quebrada ("Foto 2", "Foto 3") sem mensagem; `+7 pngs` sobre 3 fotos deixa 6 e descarta 4 sem aviso. Print `prints/B2/f4-fotos-m.png`.
- Impacto: o celular simples pode oferecer "todos os arquivos"; a vaga sai com foto quebrada na capa, ou o usuário acha que as 7 fotos foram enviadas.
- Causa raiz: `onChange(photos.concat(files.map(mediaUrl)).slice(0, max))` sem conferir `file.type`/`size` e sem toast quando corta.
- Correção recomendada: reaproveitar `portfolioFileProblem` (só imagem, até 10 MB) e mostrar toast "Só cabem 6 fotos" quando passar do limite.
- Critério de aceite: teste de componente com `.txt` (recusa com mensagem), imagem de 11 MB (recusa) e 7 imagens (toast).
- Dependências: nenhuma

### B2-003 — Ao errar o formulário, o foco não vai para o primeiro erro e a mensagem do título fica escondida sob a barra fixa

- Área: UX
- Severidade: S3 baixo
- Esforço: P (< 2 h)
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/CreateJob.tsx:148-163,174-209` (nada chama `focus()`/`scrollIntoView` no primeiro campo com erro)
- Prova: `/criar-vaga` a 360x800, rolar até o fim e tocar "Continuar" vazio: `document.activeElement` continua o botão; o primeiro erro ("Dê um título…") fica a 38 px do topo, abaixo da barra fixa "Publicar vaga" (cortado, ver `prints/B2/f1-criar-vazio-m.png`); só aparece "Confira os campos marcados em vermelho" junto do botão.
- Impacto: no celular o erro principal fica acima da dobra; quem não rola de volta acha que o botão não funciona.
- Causa raiz: `setUi({ errors })` sem mover foco/rolagem.
- Correção recomendada: após `setUi({errors})`, focar o primeiro campo inválido (`document.getElementById(...)?.focus({preventScroll:false})` com `scroll-margin-top` da barra).
- Critério de aceite: teste e2e: tocar Continuar vazio e `document.activeElement.id === 'create-job-titulo'`.
- Dependências: nenhuma

### B2-004 — "recrutador" aparece na tela, contra a regra do projeto ("na tela: empresa")

- Área: UX
- Severidade: S3 baixo
- Esforço: P (< 2 h)
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/shared/Signup.tsx:124` (sobretítulo "Cadastro de recrutador"), `web/src/layouts/AppNav.tsx:297` (menu da conta no desktop: "Conta de recrutador"); regra em `CLAUDE.md` §1 ("Na tela: empresa")
- Prova: `/cadastro/recrutador` mostra "CADASTRO DE RECRUTADOR" (`prints/B2/f9-codigo-m.png` e passo 1); a 1280 px o menu da conta mostra "Conta de recrutador" (`prints/B2/f15-d-menu-conta.png`). A tela anterior diz "Quero contratar" e o resto do app diz "empresa".
- Impacto: quem só quer contratar uma diarista não se reconhece em "recrutador"; vocabulário inconsistente.
- Causa raiz: textos antigos que sobraram da troca de vocabulário do U48.
- Correção recomendada: "Cadastro de empresa" / "Conta de empresa" (ou "Conta de quem contrata").
- Critério de aceite: `grep -rn "recrutador" web/src --include=*.tsx` sem texto visível ao usuário.
- Dependências: nenhuma

### B2-005 — Impulsionar vaga de outra empresa mostra um título e uma explicação que não combinam

- Área: UX
- Severidade: S3 baixo
- Esforço: P (< 2 h)
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/BoostJob.tsx:40-57` (descrição fixa quando a vaga não está impulsionada); `boostBlocker` em `services/payments.ts`
- Prova: logado como Meridiano, abrir `/impulsionar/BC-4822` (vaga do Restaurante Alvorada): título "Só a empresa da vaga pode impulsionar." e descrição "Vagas encerradas, cheias ou vencidas não aparecem no mural." (`out/B2/tour1-m.txt`, `prints/B2/t1-m-impulsionar_BC_4822.png`).
- Impacto: a explicação fala de vaga encerrada quando o problema é ser de outra empresa; confunde, e dá a entender que a vaga está fechada.
- Causa raiz: a descrição só distingue "já impulsionada" de "qualquer outro bloqueio".
- Correção recomendada: descrição própria para "não é sua" (ou sem descrição), como já fazem `/vaga-gerenciar` e `/fechado` ("Essa vaga não é sua").
- Critério de aceite: teste de tela com vaga alheia, vaga cheia e vaga já impulsionada, cada uma com a explicação certa.
- Dependências: nenhuma

### B2-006 — Vários alvos de toque abaixo de 44 px, sem a área expandida do `.tap-target`

- Área: acessibilidade
- Severidade: S3 baixo
- Esforço: P (< 2 h)
- Confiança: confirmado (medido em 360x800)
- Onde: "Denunciar" das avaliações (`/avaliacoes/*`, 59x16 px), "Ver seus bicos" (95x20, `DeleteAccount.tsx:170-176`), "Mostrar senha" (36x36, `/configuracoes/senha|email|excluir-conta`), tema Claro/Escuro (37x34, `/configuracoes`), "Marcar todas como lidas" (208x36), "Ver avaliações" (90x40), abas "Todas · N / Abertas / Cheias" e passos "1 Serviço e local / 2 Valor e pessoas" (40 px de altura); Aprovar/Recusar candidato (40x40, lado a lado, `CandidateRow`, com `.tap-target` de 44 px que se sobrepõe)
- Prova: medição por script (`out/B2/lib.cjs` `measure()`, resultados em `tour1-m.json`: campo `smallList`, com `tap:false` para estes). Print de referência: `prints/B2/f5-gerenciar-4998-m.png`.
- Impacto: dedos grossos ou celular com tela suja erram o alvo; o pior é Aprovar e Recusar encostados (dá 7 s de "Desfazer").
- Causa raiz: tamanhos fixos sem `tap-target`/`min-h-11`.
- Correção recomendada: `min-h-11 min-w-11` (ou `tap-target`) nesses controles e separar Aprovar de Recusar.
- Critério de aceite: o mesmo script sem nenhum item de `smallList` com `tap:false` e menor que 44 px nessas telas.
- Dependências: nenhuma

### B2-007 — No desktop o valor "R$ 150" quebra em duas linhas no cartão "Diária que você ofereceu"

- Área: UX
- Severidade: S3 baixo
- Esforço: P (< 2 h)
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/recruiter/JobManage.tsx:127-141` (valor em `font-mono text-4xl` ao lado de um texto de até 11 rem dentro da coluna lateral de 22 rem, `:226`)
- Prova: 1280x800, `/vaga-gerenciar/BC-4998`: "R$" numa linha e "150" na de baixo, com o título "DIÁRIA QUE VOCÊ OFERECEU" também quebrado em duas linhas (`prints/B2/f15-d-gerenciar.png`). A 360 px o cartão é largo e não quebra.
- Impacto: o dinheiro da vaga parece estragado no computador; com R$ 1.200 ou mais fica pior.
- Causa raiz: `flex items-end justify-between` sem `whitespace-nowrap` e sem dar prioridade de largura ao valor.
- Correção recomendada: `whitespace-nowrap` no valor e o texto da direita passando para baixo (`flex-wrap`) na coluna estreita.
- Critério de aceite: print a 1280 px com R$ 150 e R$ 5.000 em uma linha só.
- Dependências: nenhuma

### B2-008 — "Trocar WhatsApp" manda o código sem conferir se o número já é de outra conta

- Área: bug
- Severidade: S3 baixo
- Esforço: P (< 2 h)
- Confiança: provável (a parte do demo foi reproduzida; a recusa do servidor só no fim vem do código e da migration)
- Onde: `web/src/pages/shared/ChangeWhatsApp.tsx:44-65` (vai direto a `sendWhatsAppCode`), contra `Signup.tsx:344-364` (que chama `isFreeForSignUp('whatsapp')` antes); índice único `accounts_whatsapp_key` em `supabase/migrations/20261020000100_u10_dados_unicos.sql:77`; demo sem checagem em `services/profiles.ts:151-164`
- Prova: no demo, `/whatsapp` como empresa com o número do trabalhador `(11) 9XXXX-XXXX` + código 123456 termina em "WhatsApp trocado e confirmado" (`out/B2/f13.cjs`). No cadastro o mesmo número da empresa dá "Esse WhatsApp já está em outra conta da Bicos".
- Impacto: com o Twilio ligado, o usuário recebe e digita o código de um número que não poderá usar e só descobre o conflito no fim (e gasta um envio de código); no demo a regra de número único some.
- Causa raiz: a checagem de número livre existe só no cadastro.
- Correção recomendada: chamar `isFreeForSignUp('whatsapp', phone)` antes de enviar o código e mostrar a mesma mensagem do cadastro; no demo, recusar número de outra conta em `changeWhatsApp`.
- Critério de aceite: teste de serviço (modo real com fake Supabase e modo demo) e print da mensagem na tela.
- Dependências: nenhuma

### B2-009 — Passo do código (WhatsApp e e-mail) abre sem foco no campo: o teclado não sobe sozinho

- Área: UX
- Severidade: S3 baixo
- Esforço: P (< 2 h)
- Confiança: confirmado (reproduzido)
- Onde: `web/src/pages/shared/Signup.tsx:537-550` + `WhatsAppCode.tsx`; `web/src/pages/shared/VerifyEmail.tsx:284-294` (o próprio arquivo comenta que o autofoco só funciona no primeiro campo da página, `:174-175`)
- Prova: `/cadastro/recrutador` até o passo "Confirme seu WhatsApp": `document.activeElement` é `BODY`; em `/verificar-email` também (`out/B2/f10.cjs`, `f11.cjs`).
- Impacto: em celular simples o usuário precisa tocar no campo antes de digitar o código recebido.
- Causa raiz: `autoFocus` não funciona ao trocar de passo; só o passo de e-mail do "Trocar" tem `focus()` manual.
- Correção recomendada: `useEffect` que foca o campo ao entrar no passo do código.
- Critério de aceite: `document.activeElement.id` igual ao do campo do código ao abrir o passo.
- Dependências: nenhuma

## Hipóteses não confirmadas

- `/privacidade` a 360 px: `document.scrollWidth` = 372 (contêiner fixo do toast com 372 px, `.fixed.inset-x-0.bottom-28`), mas `scrollX` não sai de 0 — sem rolagem lateral real; só em `/privacidade`.
- (descartada) o texto "Verificado" "cortado" em `/vaga-gerenciar` é um `<span class="sr-only">` de 1 px (falso positivo da medição).
- Recusar candidato só tem "Desfazer" por 7 s no aviso (`decisionToasts.ts:10`); depois disso, `CandidateActions.tsx:208-229` mostra "Avisamos que dessa vez não deu certo" sem caminho de volta. Pode ser decisão (L22); não achei em `DECISOES.md` o limite de 7 s — confirmar com o responsável antes de chamar de falha.
- O cadastro inteiro (6 passos) e o rascunho da vaga vivem só na memória: recarregar no passo do código volta ao passo 1 (`f9.cjs`, passo D). Estende C4 (rascunho da vaga). Em produção o código por WhatsApp está desligado e o código de e-mail vem depois de a conta existir (sessão persiste), então o impacto real é pequeno.
- Perfil de trabalhador novo (ex.: Silas) mostra "Novo na plataforma" duas vezes (selo no canto e texto no lugar da nota) — visto no texto da tela em `f18.cjs` (não conferi o print).

## Bom e deve ser preservado

- Guardas de rota: empresa em área de trabalhador cai em "Essa área é da conta de trabalhador"; visitante-logado vai para /mural; IDs inválidos e vaga alheia dão mensagem, nunca tela branca (varredura de 87 rotas, 0 erro de console).
- Validação da vaga: título só com espaços, CEP curto, nenhum dia marcado, data passada, dia da semana incompatível, hora só no início, hora igual, descrição curta, valor < R$ 80 ou > R$ 5.000, diárias 0/61, pessoas 0/51: todas com mensagem clara em português.
- Publicar offline: "Sem internet. Confira sua conexão e tente de novo." e a vaga não é duplicada ao voltar o sinal.
