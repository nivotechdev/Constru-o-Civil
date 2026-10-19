# Limpeza do repositório (C01–C12)

> Objetivo: deixar o projeto mais leve e mais fácil de entender **sem mudar nada que o usuário vê** nem como o app
> funciona. Regra de ouro: comportamento idêntico antes e depois. Este documento guarda a linha de base (C01), o
> inventário (C02) e, ao fim, a comparação (C10–C12).
>
> Ponto de partida: branch `claude/front-novo-supabase` no commit `845c9c8` (U04). A tag `antes-da-limpeza` **não
> pôde ser criada**: o GitHub recusou o envio da tag e de uma branch-âncora fora do padrão `claude/*` nesta sessão.
> A âncora é o próprio commit `845c9c8`, já no GitHub, no branch `claude/front-novo-supabase`, que esta rodada não
> reescreve. Trabalho em `claude/limpeza`.

## Antes (C01)

### Contagens (arquivos rastreados pelo Git, sem `node_modules`, `dist`, `.git`)

- **709 arquivos**, **104.626 linhas**.
- Por pasta de primeiro nível: `web/` 510 arquivos; `archive/` 192; `.github/` 3; `legal/` 2; `CLAUDE.md` e
  `README.md` na raiz.
- Por tipo (topo): 153 `.ts`, 118 `.tsx`, 118 `.sql`, 76 `.js`, 65 `.svg`, 56 `.jpg`, 37 `.md`, 17 `.css`,
  16 `.png`, 11 `.mjs`, 11 `.json`, 9 `.html`, 8 `.sh`.

### Checagens (web/)

| Checagem                                                        | Resultado                                                                                                                                                               |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                             | OK                                                                                                                                                                      |
| `npm run lint`                                                  | OK                                                                                                                                                                      |
| `npm run format:check`                                          | OK                                                                                                                                                                      |
| `npx vitest run`                                                | **25 arquivos, 217 testes passando**                                                                                                                                    |
| `vite build --mode demo`                                        | OK                                                                                                                                                                      |
| `vite build --mode staging`                                     | OK                                                                                                                                                                      |
| `vite build --mode standalone`                                  | OK                                                                                                                                                                      |
| Testes SQL locais (`supabase/tests/local/setup.sh` + `run.mjs`) | **47 arquivos passando**                                                                                                                                                |
| axe (WCAG 2.1 AA, 14 telas, `scripts/a11y-check.mjs`)           | OK                                                                                                                                                                      |
| Lighthouse mobile, 3 rodadas (`scripts/lighthouse-check.mjs`)   | **desempenho 80** (meta 85; rodadas 88, 80, 80); acessibilidade 100; boas práticas 100                                                                                  |
| E2E (Playwright) local                                          | **não rodado nesta sessão**: o Supabase local de E2E não estava de pé. Último resultado: job `e2e` do staging no commit `845c9c8`, verde (13 testes, run `39313626464`) |

O desempenho 80 é uma medição **local** (máquina de sessão, não o runner do CI). Fica registrado como linha de base;
não é alterado nesta rodada.

### Peso do app (chunks de `dist/`, bruto e gzip)

| Build   | Arquivos (JS/CSS/HTML) | Total bruto | Total gzip |
| ------- | ---------------------- | ----------- | ---------- |
| demo    | 98                     | 2.651.730 B | 760.763 B  |
| staging | 98                     | 2.652.379 B | 761.150 B  |

Maiores chunks (demo): `index-DjlrP-Um.js` 628.312 B (194.157 gzip); `index-DaueY-7D.js` 224.501 B (58.512 gzip);
`index-CUiwdXoZ.css` 47.008 B (9.204 gzip); `WorkerProfileScreen-A4-znaxa.js` 23.483 B; `workbox-35e397ac.js` 21.777 B.
Lista completa (cada arquivo, bruto e gzip): `/tmp/claude-0/…/scratchpad/base-sizes-demo.txt` (fora do repositório).

### Fotografia de todas as telas (C01)

Script: `web/scripts/limpeza/fotografar.mjs` (`FOTOS=<pasta fora do repositório> node scripts/limpeza/fotografar.mjs <rótulo>`).
Abre **cada uma das 54 rotas** de `src/routes.ts` no modo demonstração, em 360×800 e 1280×800, com a sessão que a rota
pede (sem login, trabalhador, construtora). Resultado: **108 prints, 0 erros**. Os prints e o `rotas.json` ficam em
`/tmp/claude-0/fotos/antes/`, fora do repositório. Os estados de "lista vazia", "modal aberto" e "erro de formulário"
não foram capturados de forma sistemática nesta passada: a fotografia cobre as rotas, não cada estado.

## Inventário (C02)

Em andamento. Passadas feitas: (1) ferramentas — knip, depcheck, `tsc --noUnusedLocals` (0 alertas); (2) referências
manuais de arquivos candidatos; (3) por categoria; (4) revisão adversária por subagente separado. Resultado e
classificação completa vêm na próxima seção deste documento, antes da pausa de aprovação.
