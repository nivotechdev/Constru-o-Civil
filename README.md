# Bicos

Marketplace de **diárias de obra** da [NivoTech](https://nivotech.com.br): construtoras publicam vagas de trabalho
temporário na construção civil e encontram profissionais verificados; pedreiros, eletricistas, pintores e outros
ofícios têm um canal único de oportunidades perto de casa.

## Para quem

- **Trabalhador** (pessoa física, CPF, 18+): vê o mural de bicos da cidade ou do raio escolhido, se candidata e,
  quando a construtora aprova, fala com ela pelo WhatsApp. Depois da diária, os dois lados se avaliam.
- **Construtora / empreiteiro** (CNPJ, ou CPF): publica a vaga (ofício, valor da diária, datas, bairro, fotos),
  escolhe os candidatos pelo perfil e pelas notas, e pode impulsionar a vaga no mural.

O público usa celular simples e internet ruim: o app é um **web app instalável (PWA)**, leve, em português direto.

## Stack

- `web/` — **o app**: React 19 + TypeScript + Vite 7 + Tailwind, PWA. Sem as variáveis do Supabase roda em modo de
  demonstração (dados falsos em memória).
- **Supabase** (Postgres 17, Auth, Storage, Edge Functions em Deno, `pg_cron`): regras de negócio no banco (RLS e
  RPCs), migrations em `web/supabase/migrations/`, testes SQL em `web/supabase/tests/`.
- Hospedagem prevista: **Cloudflare Pages** (`bicos.nivotech.com.br`). Erros: Sentry. Captcha: Cloudflare
  Turnstile. E-mail: Brevo. Pagamento do impulso: Mercado Pago.

## Rodar

```bash
cd web
npm ci
npm run dev            # http://localhost:5173 — demonstração, se não houver web/.env.local
npm run typecheck && npm run lint && npm run format:check && npm test
```

Com um Supabase: copie `web/.env.example` para `web/.env.local` e preencha. Testes SQL (precisam de Docker):
`./supabase/tests/local/setup.sh` e depois `node supabase/tests/run.mjs supabase/tests/[a-z]*.sql` (ver
`web/README.md`). Testes de ponta a ponta: `web/e2e/LEIA.md`.

## Publicar

- Banco: `web/supabase/APLICAR.md` (ordem das migrations e conferências) — **staging primeiro**
  (`web/docs/STAGING.md`), produção só com aprovação.
- Funções: `supabase functions deploy <nome>` (ver `web/docs/SUPABASE.md` › 4).
- Front: `npm run deploy:staging` / `npm run deploy:producao` (`web/scripts/deploy.sh`). O build de produção falha
  se faltar variável obrigatória ou se os textos legais estiverem incompletos.

## Documentos

| Arquivo                            | Para quê                                                             |
| ---------------------------------- | -------------------------------------------------------------------- |
| `CLAUDE.md`                        | contexto completo do projeto (para pessoas e para IA)                |
| `web/docs/CHECKLIST-LANCAMENTO.md` | o que está feito e o que depende dos responsáveis                    |
| `web/docs/SUPABASE.md`             | banco, funções, segredos, serviços externos, hospedagem              |
| `web/supabase/APLICAR.md`          | migrations: ordem, conferências, histórico                           |
| `web/docs/CONTRATO-BACKEND.md`     | o contrato de cada serviço e da máquina de status da candidatura     |
| `web/docs/DECISOES.md`             | por que cada coisa é como é                                          |
| `web/docs/E2E.md`, `VOLUME.md`     | resultado dos testes de ponta a ponta e de volume                    |
| `legal/`                           | termos de uso e política de privacidade (gerados de `web/src/services/legal.ts`) |

## Status do lançamento

Código da rodada de lançamento pronto na branch `claude/front-novo-supabase` (testes unitários, SQL e de ponta a
ponta verdes). Falta montar o staging, aplicar as migrations novas na produção, publicar o site e os itens que
dependem dos responsáveis (plano, domínio, provedores, revisão jurídica) — a lista viva está em
`web/docs/CHECKLIST-LANCAMENTO.md`.
