Todos os S0 e S1 resolvidos: não

# Relatório da rodada FIX (parcial: bloco 0 em andamento)

Branch `claude/correcao` (a partir de `claude/auditoria`). Nada foi aplicado na produção. O banco local de testes
(imagem `supabase/postgres:17.6.1.011`) rodou todos os testes SQL; o staging não foi alterado (o proxy do ambiente
recusa `*.supabase.co` e o conector pede confirmação humana para DDL).

**Por que "não":** o S1 AUD-007 (link público e Ajuda quebram sem login) é do bloco 1, que ainda não começou. Os
outros cinco S1 e o S0 do bloco 0 estão resolvidos no código e nos testes; as partes que dependem dos sócios estão em
`CHECKLIST-LANCAMENTO.md` (seção "Rodada FIX").

## Estado dos itens

| AUD     | Gravidade | Estado                                                                                   | Prova (antes → depois)                                                                                  |
| ------- | --------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| AUD-001 | S0        | resolvido (falta republicar a função e aplicar a migration)                              | `excluirConta.test.ts` e `aud001_*.sql` falhavam; agora passam                                          |
| AUD-006 | S1        | resolvido no código; **depende do responsável** (criar `CLEANUP_SECRET` em cada projeto) | `aud006_limpeza_vigiada.sql` falhava (função inexistente); agora passa                                  |
| AUD-002 | S1        | resolvido (decisão 1, opção C)                                                           | `aud002_endereco_residencial.sql` falhava no `select street`; agora `42501`; `remote.test.ts` reescrito |
| AUD-003 | S1        | resolvido                                                                                | `aud003_limites_de_texto.sql` falhava com rua de 121 letras; agora `BC422`                              |
| AUD-004 | S1        | resolvido (decisão 3, anonimizar)                                                        | `aud004_*.sql` e `deleteAccount.test.ts` falhavam; agora passam                                         |
| AUD-005 | S1        | resolvido (falta republicar as funções e conferir no staging)                            | `clientIp.test.ts` falhava (módulo inexistente); agora passa                                            |
| AUD-010 | S2        | resolvido                                                                                | `aud010_selo_troca_de_nome.sql` falhava; agora passa                                                    |
| AUD-012 | S2        | resolvido (decisão 11: tetos e `urgent`)                                                 | `aud012_tetos_de_vagas.sql` falhava; agora passa                                                        |
| AUD-022 | S2        | resolvido                                                                                | `aud022_oculta_e_suspensa.sql` falhava; agora passa                                                     |

Ainda **não feitos** no bloco 0 (todos S3): AUD-056, 057, 058, 059, 060, 062, 063, 064, 065, 066, 067, 068, 071, 074, 075, 076, 077, 078, 079, 080. Vários perdem urgência com o piloto enxuto (057, 071, 078, 079 e 066 dependem de selfie, identidade ou push, hoje desligados). Os itens jurídicos foram tratados pelo "piloto enxuto" confirmado pelos sócios em 02/11/2026 (sem advogado nem contador; impulsionar inativo).

## Verificações locais (antes de cada push)

`npm run typecheck`, `lint`, `format:check`, `npm test` (321 testes), `deno check` das 10 funções (Deno 2.5.4 instalado
no ambiente) e os 70 testes SQL no banco local: todos verdes. O CI do GitHub roda a cada push (os pushes seguidos cancelam o anterior).

## Pendências e riscos

- Staging: nenhuma das migrations `20261102*` foi aplicada lá; o critério "no staging" de AUD-001, 005 e 006 fica para
  quando o responsável der o "pode" ou aplicar pelo `scripts/staging/aplicar-banco.sh`.
- AUD-002 muda o fluxo central do app (endereço de casa só depois da aprovação) e foi autorizado pela decisão 1.
- A ordem de aplicação na produção continua sendo uma janela única (decisão 18); nada disso foi aplicado lá.

## CI

- `08e0bd0` (AUD-001, 002, 003, 004, 005, 006, 010, 012, 014, 020, 022) e `bebc44e` (AUD-018, 008, 082): verdes.
- `1206dce` (AUD-023/024) ficou vermelho no lint por duas expressões regulares com espaços repetidos nos meus testes;
  corrigido no `d5c926b`. Aprendizado: o script local de checagem passou a mostrar a falha do lint em vez de escondê-la.
- `d5c926b` (todo o bloco 0 até aqui): `sql` ✔ (80 testes SQL, `APLICAR-TUDO.sql` e tipos em dia) e `checks` ✔
  (typecheck, lint, format, 321 testes, `deno check`, builds, Lighthouse, axe, cadastro sem rolagem). O job `e2e` segue
  pulado, como antes (tratado no bloco 5).

## Bloco 1 (fluxo principal), parcial

Feito, com teste que falhava antes (ou prova equivalente), na ordem do bloco:

- AUD-007 (S1): visitante abre `/v/:id`, `/ajuda` e a conclusão do cadastro sem a moldura logada (`publicScreens.test.ts`).
- AUD-025 (S2): cadastro sobrevive a recarregar; a senha nunca é guardada (`signupDraft.test.ts`).
- AUD-026 (S2): campos de número inteiro recusam vírgula, ponto e sinal com mensagem (`wholeNumberInput.test.ts`).
- AUD-027 (S2): ação feita no servidor não vira erro quando a releitura falha (`sessionRefresh.test.ts`).
- AUD-028 (S2): sem internet a rua diz "offline"; casa no centro da cidade vem com aviso (`addressOffline.test.ts`).
- AUD-029 (S2): resposta depois do Sair não cai na conta seguinte (`leaveSession.test.ts`).
- AUD-030 (S2): mural vazio fala em filtro só quando há filtro; "Limpar filtros" limpa a busca (`feedEmpty.test.ts`).
- AUD-031 (S2): /historico mostra só os bicos fechados (`wholeNumberInput.test.ts`, bloco com `jobsForView`).
- AUD-033 (S2): "voltar para a vaga" vale também no Google, SMS e cadastro novo (`returnTo.test.ts`).
- AUD-034 (S2): CSP com `media-src` para o vídeo (`headers.test.ts`).
- AUD-035 (S2): token expirado com relógio errado renova a sessão antes de desligar (`sessionRefresh.test.ts`).
- Também: `lanc10_link_publico.sql` tinha uma checagem frágil (dependia da data); corrigida, sem mudar o que ela prova.

Feito na segunda rodada do bloco 1 (S3):

- AUD-085 (nome sem emoji, até 80), AUD-089 (foco no campo do código), AUD-093 (aviso de sucesso em tom de sucesso),
  AUD-094 (ordem dos posts), AUD-101 (contagem do reenvio, sem "0:60"), AUD-105 (só a conta desbloqueada gira),
  AUD-115 (foto que não carrega), AUD-116 (telefone colado com +55 ou 0), AUD-118 (valor do aviso com ponto de milhar,
  migration `20261102001600_aud118`), AUD-128 (ícone da aba em qualquer rota).

Feito na terceira rodada do bloco 1 (S3, só telas, sem migration):

- AUD-084 (link do login por celular sem o recurso ligado avisa na hora), AUD-098 ("Ver outros bicos" leva ao mural),
  AUD-099 (legenda em edição pertence a um post só), AUD-100 (janela "Publicar trabalho" sem erro antigo),
  AUD-104 ("Desfazer" devolve só a experiência removida), AUD-108 (recarregar "Vaga publicada" busca a vaga),
  AUD-111 ("Todas · 30+"), AUD-113 (aviso de 30 dias no mural). Testes: `smallFixesBlock1.test.ts`.
- AUD-087 (impulsionar vaga de outra empresa) não se aplica no piloto: com o pagamento inativo a tela já mostra
  "indisponível". Volta junto com o AUD-032.

Feito na quarta rodada do bloco 1 (S3):

- AUD-086 (fotos da vaga: só foto, até 10 MB, 6 no total, com aviso), AUD-090 (falha em concluir diárias não derruba as
  telas de acompanhamento), AUD-091 (mensagem pronta do WhatsApp sem artigo errado e sem gênero: "Minha candidatura
  foi aprovada" / "Sua contratação foi confirmada" — redação neutra, os sócios podem trocar), AUD-092 (textos legais na
  versão 3.0 de 02/11; todo mundo aceita de novo; teste com hash do texto), AUD-096 (limite de tentativas e conta
  suspensa ao trocar senha/e-mail e ao confirmar código), AUD-097 (captcha que falhou e navegador embutido), AUD-107
  (busca do mural com "Carregar mais" e "30+"), AUD-109 (candidato só aprovado tem uma saída), AUD-110 (digitar na
  busca mantém a lista), AUD-114 (GPS do seletor de cidade ignorado depois de fechar; lista sem `listbox`; E2E
  ajustado). Testes: `smallFixesBlock1`, `authErrors`, `remote` (AUD-090), `legal`.
- Deixados de propósito (mexem em login/cadastro ou pedem decisão; entram no bloco de ajustes finais):
  AUD-103 (link de senha vencido: precisa ser testado no celular, porque a sessão do link chega de forma assíncrona),
  AUD-119 (CNPJ alfanumérico: toca banco, login por documento e Edge Functions; enquanto isso, empresa com CNPJ novo
  alfanumérico se cadastra com CPF), AUD-120 (cidade padrão "São Paulo, SP" no cadastro), AUD-122 (Fernando de
  Noronha), AUD-126 (refatorar filtros do mural), AUD-088, 095, 102, 112, 117, 121, 123, 124, 125, 127.

Ainda não feito no bloco 1:

- AUD-032 (S2): estados do pagamento do impulso. Fica para quando o pagamento for ligado (hoje inativo no piloto).
- S3 que faltam (cerca de 30): AUD-084, 086, 087, 090, 096, 097, 098, 099, 100, 103, 104, 106, 107, 108, 109, 110, 111,
  113, 114, 122, 126.
- S3 que dependem de migration ou decisão dos sócios (escritos quando couber, sem aplicar): AUD-088, 095, 112, 117, 119,
  120, 121, 124, 127; e AUD-091, 092, 102, 123, 125 (texto e responsável).
- AUD-022 e demais itens do bloco 0 que sobraram (AUD-056 a 068, 071, 074 a 080).

Blocos 2 a 7: não iniciados.
