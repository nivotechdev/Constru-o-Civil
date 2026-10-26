# Bicos — o app (React + TypeScript + Supabase)

Web app instalável (PWA) do Bicos. O que o produto é e para quem: `../README.md`. Contexto completo para quem
mexe no código: `../CLAUDE.md`.

## Dois modos, uma porta

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` o app roda em **demonstração**: dados falsos em memória
(`src/data/seed.ts`). Com elas, fala com o **Supabase** (`src/services/remote/`). Cada serviço de `src/services/`
tem os dois corpos; telas, componentes e hooks nunca importam `src/data/` (regra do ESLint).

## Rodar

```bash
npm ci
npm run dev                 # http://localhost:5173 (demonstração sem .env.local)
cp .env.example .env.local  # para falar com um Supabase (staging, nunca a produção)
```

Builds:

```bash
npm run build               # produção — FALHA se faltar variável obrigatória (L01, L11) ou se os textos
                            # legais tiverem {{…}} ou não estiverem revisados (R01)
npm run build:staging       # mesmo build, variáveis do staging (textos legais só avisam)
npm run build:demo          # demonstração (dados falsos)
npm run build:standalone    # dist-standalone/index.html que abre direto do disco
npm run deploy:staging      # Cloudflare Pages, prévia "staging" (scripts/deploy.sh)
npm run deploy:producao
```

## Qualidade

```bash
npm run typecheck && npm run lint && npm run format:check && npm test   # Vitest, nos dois modos
npm run e2e                 # Playwright de ponta a ponta num Supabase de verdade (e2e/LEIA.md)
npm run gen:types           # src/types/database.generated.ts a partir do banco (DATABASE_URL)
```

Testes SQL (Docker):

```bash
./supabase/tests/local/setup.sh
DATABASE_URL=postgres://postgres:postgres@localhost:54322/postgres node supabase/tests/run.mjs supabase/tests/[a-z]*.sql
```

O CI (`../.github/workflows/web.yml`) roda tudo isso, os três builds, Lighthouse e axe (WCAG 2.1 AA), e confere
que `supabase/APLICAR-TUDO.sql` e os tipos gerados estão em dia.

## Estrutura

```
src/
  main.tsx · App.tsx · routes.ts   bootstrap, troca de tela, tabela de rotas (cada tela é um chunk sob demanda)
  pages/{shared,worker,recruiter,admin}   telas (admin = área da equipe, /admin)
  layouts/                         AppShell e AppNav
  components/                      biblioteca de UI (Button, Input, Modal/Sheet, EmptyState, QueryView…)
  hooks/                           useStore e afins
  services/                        a única porta para os dados (demo e real); remote/ = corpo real (Supabase)
  data/                            seed da demonstração e cidades do IBGE — só services/ lê
  types/                           models (domínio), database.generated (gerado do banco), supabase, ui
  utils/                           formatação, datas, WhatsApp, status de candidatura, compartilhar
  styles/                          tokens.css, base.css, tailwind.css
build/env.ts                       o que o build de produção exige (variáveis e textos legais)
e2e/                               Playwright (fluxos 01–07)
scripts/                           deploy, staging/, volume/, gerar tipos, APLICAR-TUDO, Lighthouse, axe, paridade
supabase/
  migrations/                      migrations do app (aplicar em ordem: APLICAR.md)
  legado/                          migrations 000–012 do app antigo (ainda necessárias para montar do zero)
  functions/                       Edge Functions (Deno)
  tests/                           testes SQL (cada um numa transação desfeita)
  email-templates/                 e-mails do Auth em português
  pendentes/                       migrations que só entram com autorização (apagar o app antigo)
docs/                              ver a tabela abaixo
```

## Documentos

| Arquivo                                                       | Para quê                                                    |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `docs/CHECKLIST-LANCAMENTO.md`                                | o que está feito e o que depende dos responsáveis           |
| `docs/SUPABASE.md`                                            | banco, funções, segredos, serviços externos, hospedagem     |
| `supabase/APLICAR.md`                                         | ordem das migrations, conferências, histórico               |
| `docs/STAGING.md`                                             | o ambiente de ensaio                                        |
| `docs/CONTRATO-BACKEND.md`                                    | contrato de cada serviço/RPC e da máquina de status         |
| `docs/DECISOES.md`                                            | por que cada coisa é como é (por ID)                        |
| `docs/E2E.md`, `docs/VOLUME.md`                               | resultados dos testes de ponta a ponta e de volume          |
| `docs/ADVISORS.md`, `docs/LGPD.md`                            | avisos do Supabase; dados pessoais e bases legais           |
| `docs/MAPEAMENTO.md`, `VALIDACAO.md`, `RELATORIO_PARIDADE.md` | histórico da migração do app legado (raramente necessários) |
