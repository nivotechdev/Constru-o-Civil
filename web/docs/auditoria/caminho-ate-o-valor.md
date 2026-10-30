# P1 — Caminho até o valor (toques medidos em 360×800, demonstração)

Medido com os roteiros `t3.cjs`, `t5.cjs`, `t6.cjs` (cada `tap` = um toque em botão/opção; `campo` = um campo digitado).
Cadastro real em produção tem um passo a menos: o código do WhatsApp está desligado (`WHATSAPP_CODE_AVAILABLE`), então some
"Confirmar número" (−1 toque, −1 campo). Valores entre parênteses = estimativa de produção.

## Trabalhador: do zero até a primeira candidatura enviada

| Etapa                                                                                     | Telas        | Toques                  | Campos                  |
| ----------------------------------------------------------------------------------------- | ------------ | ----------------------- | ----------------------- |
| Splash → "Criar minha conta"                                                              | 1            | 1                       | 0                       |
| "Como você vai usar o Bicos?" → Continuar                                                 | 1            | 1                       | 0                       |
| Nome, CPF, e-mail, WhatsApp (1 pergunta por tela, "Passo n de 6")                         | 4            | 4                       | 4                       |
| Código do WhatsApp (só na demonstração) → "Confirmar número"                              | 1            | 1 (0)                   | 1 (0)                   |
| Senha + "Tenho 18 anos" + "Li e aceito" + "Criar minha conta"                             | 1            | 4                       | 1                       |
| Confirme seu e-mail (sai do app, lê o e-mail, volta e digita 6 números; confirma sozinho) | 1            | 0                       | 1 (código)              |
| Seu endereço: CEP/cidade/rua/bairro com sugestão (3 toques de sugestão) + Continuar       | 1            | 4                       | 4                       |
| Seu perfil (fotos opcionais) → "Concluir perfil"                                          | 1            | 1                       | 0                       |
| **Chega ao mural**                                                                        | **11 telas** | **14 (13 em produção)** | **11 (10 em produção)** |
| Card → "Quero esse bico" → "Sim, quero esse bico"                                         | 3            | 3                       | 0                       |
| **Primeira candidatura enviada**                                                          | **14 telas** | **17 (16 em produção)** | **11 (10)**             |

Decisões por tela: 1 (cada pergunta) — bom. Pontos de parada prováveis: o código de e-mail (sai do app) e o endereço (4 campos,
CEP/cidade/rua/bairro, obrigatório). Antes de criar a conta a pessoa vê só a Splash (print 00): nenhum bico. Com a conta já
existente, "achar e se candidatar" são 3 toques (print 10 → 20b → 22 → 23).
Nota (P1-001): num cadastro com cidade sem vagas, o mural abre vazio e com texto errado (print 61).

## Empresa: da conta pronta até a primeira vaga publicada

| Etapa                                                                                                                | Toques  | Campos |
| -------------------------------------------------------------------------------------------------------------------- | ------- | ------ |
| Aba "Publicar"                                                                                                       | 1       | 0      |
| Passo 1: título; cidade (sugestão, 1 toque); rua (sugestão, 1 toque); bairro; 1 dia da semana (1 toque); "Continuar" | 4       | 4      |
| Passo 2: valor; "Quantas diárias"; "Pessoas"; **descrição obrigatória** (mínimo de letras); "Publicar vaga"          | 1       | 4      |
| **Vaga publicada** (print 76)                                                                                        | **5–6** | **8**  |
| "Gerenciar vaga" para ver candidatos                                                                                 | 1       | 0      |

A primeira tentativa do roteiro falhou por um campo obrigatório que não se vê no passo 2 até errar: "Descreva o serviço da vaga."
(`jobForm.ts:223-224`); título, endereço, dias, valor, diárias, pessoas e descrição são todos obrigatórios (8 campos). Foto é opcional.
Do cadastro da empresa (um nome, documento, e-mail, WhatsApp, senha, código do e-mail, cidade, logo) até aqui são ~10 toques a mais.
"Receber o primeiro candidato": depende de existir trabalhador na cidade; a empresa só é avisada se abrir o app (P1-006).
Candidato → decisão: abrir a vaga, rolar ~1.150 px (P1-004), tocar ✓ (P1-005) = 3 ações; "Falar no WhatsApp" aparece na hora.
