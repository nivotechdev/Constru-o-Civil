# Plano — cadastro com o Google igual ao normal e telas de cadastro sem rolagem (U40–U42)

Pedido do responsável (20/10/2026): refazer o cadastro com o botão do Google "da forma mais profissional possível":
as telas devem ser **iguais às do cadastro normal**, só sem o botão do Google e **sem o passo do e-mail e da
confirmação do e-mail** (o Google já confirmou o e-mail); e **nenhuma tela de cadastro pode rolar** — todas fixas.

## 1. Diagnóstico (o que está errado hoje)

**Cadastro com o Google.** O registro do staging mostra as duas tentativas do responsável (22:50 e 23:10): o
Google entrou, o servidor criou o login e o app abriu o cadastro — mas, segundos depois, o botão **"Trocar"** do
cartão "E-mail confirmado pelo Google" foi tocado, o que desfaz o login do Google e volta ao cadastro com e-mail.
Ou seja: o cartão extra deixou a tela diferente da normal e o "Trocar" confundiu. Além disso, sair do meio do
cadastro com Google (voltar até o login) deixava o login do Google pendurado.

**Rolagem.** Medição automática (quanto o conteúdo passa da altura visível, em pixels; 0 = não rola):

| Tela                       | 360×600 | 390×664 | 412×780 | computador |
| -------------------------- | ------: | ------: | ------: | ---------: |
| Login                      |    rola |    rola |       0 |          0 |
| Escolha do lado            |      19 |       0 |       0 |          0 |
| Escolha do lado (Google)   |      37 |       0 |       0 |          0 |
| Senha e aceites            |     146 |      82 |       0 |          0 |
| Código do WhatsApp         |      70 |       0 |       0 |          0 |
| Confirmar e-mail           |      85 |       5 |       0 |          0 |
| Completar perfil           |     108 |      44 |       0 |          0 |
| Demais passos (nome, CPF…) |       0 |       0 |       0 |          0 |

360×600 é um Android pequeno com a barra do navegador; 390×664 é um iPhone no Safari. Mensagens de erro (CPF
recusado, "já tem conta") aumentam a altura e hoje também fazem rolar.

## 2. Critérios de aceite

1. **Google sem conta**: as mesmas telas do cadastro normal, na mesma ordem e com o mesmo visual, sem o passo
   "Qual é o seu e-mail?", sem a confirmação do e-mail, sem o botão do Google e sem nenhum cartão a mais:
   escolher o lado (se veio do login) → nome (já preenchido com o do Google, editável) → CPF/CNPJ → WhatsApp
   (→ código, quando ligado) → senha e aceites → **Completar perfil** → mural. A conta nasce no banco com as mesmas
   regras do cadastro normal e o e-mail já confirmado.
2. **Google com conta**: entra direto (já funciona — não muda).
3. **Sem rolagem** em nenhuma tela de cadastro, a partir de 360×600 e no computador, inclusive com as mensagens de
   erro: login, escolha do lado, cada passo, código do WhatsApp, confirmação do e-mail e completar perfil.
4. **Sair do meio** do cadastro com Google (voltar até o login, ou "Entrar na conta" quando o CPF já tem conta)
   desfaz o login do Google pendente: nada fica preso, o login e o cadastro normal voltam limpos.
5. **Testes**: unidade; E2E no staging que cria uma conta "como o Google cria" (sem a janela do Google, que não
   abre em robô), faz o cadastro inteiro e confere que não houve passo de e-mail, que a conta nasceu no banco e que
   nenhuma tela rolou; e uma checagem de rolagem no CI a cada envio.

## 3. Desenho das telas

**Estrutura fixa, igual em todas** (`FlowLayout`): topo (voltar + progresso), meio e rodapé com o botão principal,
na altura exata da tela. Em telas baixas (até 719 px de altura) o título, os textos de ajuda e os espaços encolhem
— nada some. O meio só rola como último recurso, em aparelho menor que 360×600 ou com letra muito grande no
celular, para nenhum campo ficar inalcançável.

- **Login**: fixo, sem rolagem. "Esqueci minha senha" vira um link pequeno logo abaixo da senha (como nos grandes
  apps) e "Criar minha conta" uma linha só no pé ("Não tem conta? Criar minha conta").
- **Escolha do lado**: cartões e título mais compactos; no Google, a mesma tela sem o botão do Google.
- **Passos de uma pergunta** (nome, CPF/CNPJ, e-mail, WhatsApp): já cabem; ficam como estão.
- **Senha e aceites**: um campo de senha só, com o olho para ver o que digitou (o padrão atual dos bons apps —
  "repita a senha" saiu: com o olho, a confirmação não protege de nada e ocupava a tela); a força da senha numa
  linha; os dois aceites compactos, com os links "Termos de uso" e "Política de privacidade" dentro do próprio texto.
- **CPF/CNPJ recusado pelo servidor**: em vez do cartão vermelho grande, a mesma mensagem embaixo do campo com os
  botões "Entrar na conta" / "Recuperar senha" — igual ao "esse CPF já tem conta".
- **Código do WhatsApp** e **Confirmar e-mail**: espaços menores; "Sair e entrar com outra conta" vira um "Sair"
  no topo, liberando o rodapé para o botão principal.
- **Completar perfil**: capa mais baixa em tela baixa; "Sair" no topo.

## 4. Fluxo do Google (técnico)

- `entrar-com-firebase` (já publicada no staging) confere o token do Google e abre a sessão; sem conta na Bicos,
  cria o login com o e-mail confirmado.
- O app troca o token pela sessão; a conta não existe → devolve o e-mail e o nome do Google e vai para o cadastro
  do lado escolhido (ou para a escolha do lado). O lado fica guardado na aba até a conta existir.
- O cadastro, ao ver esse login pendente, **só tira o passo do e-mail** (e o botão do Google) e preenche o nome.
  O cartão e o "Trocar" saem.
- No fim: grava a senha no login (a conta também entra por CPF/CNPJ e senha) e cria a conta com
  `create_my_account` (as regras do cadastro normal), indo para "Completar perfil".
- Voltar da escolha do lado até o login, ou "Entrar na conta" com CPF/WhatsApp de outra conta, encerra o login do
  Google pendente (`leaveGoogleSignUp`).
- Login do Google que nunca terminou o cadastro é apagado pelo banco depois de 7 dias (U37, já feito).

## 5. Testes e conferência

- Unidade (Vitest): passos com e sem Google, a ida para o cadastro, a criação da conta e o "sair do meio".
- Checagem de rolagem (`scripts/sem-rolagem.mjs`, no CI junto da acessibilidade): percorre o cadastro inteiro da
  demonstração a 360×600 e falha se alguma tela rolar.
- E2E no staging (`e2e/fluxos/08-cadastro-google.spec.ts`): conta criada como o Google cria (login com e-mail
  confirmado, sem conta), aberta pelo link de acesso; confere a escolha do lado sem botão do Google, o nome já
  preenchido, "Passo 1 de 4", nenhum passo de e-mail, a conta no banco com o e-mail confirmado, "Completar perfil"
  e o mural — e que nenhuma tela rolou, no celular do teste (Pixel 7) e a 360×600.
- Prints de cada tela a 360×600 e no computador, antes e depois.

## 6. Ordem de execução (um commit por ID)

1. **U40** — cadastro com Google igual ao normal (sem cartão, sem "Trocar", sair do meio limpa o login pendente).
2. **U41** — telas de cadastro sem rolagem (estrutura fixa, compactação em tela baixa, senha num campo só, erros
   compactos, "Sair" no topo, login fixo).
3. **U42** — testes: checagem de rolagem no CI e E2E do cadastro com Google no staging.
4. Conferir CI (`web`, `site`, `staging`) e o E2E no staging; corrigir na hora se algo ficar vermelho.

## 7. Riscos e decisões

- **"Repita a senha" sai**: com o olho para ver a senha, a repetição não evita erro nenhum que o olho não evite, e
  era o que mais fazia a tela rolar. Vale para o cadastro normal e para o com Google (as telas são as mesmas).
- **Aparelhos menores que 360×600** (ou letra gigante nas configurações do celular): o meio ainda rola, só ali,
  para não esconder campo nem botão. Nos tamanhos comuns, não rola.
- **Demonstração**: a lista de contas de demonstração do login pode rolar no celular pequeno (só existe na
  demonstração).
- **A janela do Google** não abre em robô de teste; o E2E começa logo depois dela, do mesmo jeito que o app
  continua quando ela fecha (login com e-mail confirmado e sem conta).
