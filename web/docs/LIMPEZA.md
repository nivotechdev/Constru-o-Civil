# Limpeza do repositório (C01–C12)

> Objetivo: deixar o projeto mais leve e mais fácil de entender **sem mudar nada que o usuário vê** nem como o app
> funciona. Regra de ouro: comportamento idêntico antes e depois. Este documento guarda a linha de base (C01), o
> inventário (C02) e, ao fim, a comparação (C10–C12).

**Ponto de partida**: `master` em `c440e5d` (U04), mesmo conteúdo de `claude/front-novo-supabase` em `845c9c8`
(`git diff` vazio). Branch desta rodada: `claude/bicos-cleanup-optimization-lujwr7`, a única que esta sessão pode
enviar ao GitHub. **A tag `antes-da-limpeza` não foi criada**: o GitHub recusou o envio (HTTP 403 de política, duas
sessões seguidas). Ela é ação do responsável (ver "Itens D"). Até lá, o ponto de partida fica guardado no próprio
histórico do `master` (`c440e5d`), que esta rodada não reescreve.

Uma sessão anterior começou esta rodada na branch `claude/limpeza` (PR #10). Este documento a substitui. Ali havia
três erros que esta versão corrige: (1) os 4 tokens CSS dados como "sem uso" são lidos por outros tokens e não
podem sair; (2) a fotografia usava ids que não existem na demonstração (`BC-5001`, `w-ana`), então várias telas
eram só "não encontrado"; (3) itens marcados "conferir depois" foram conferidos agora.

## Antes (C01)

### Contagens (arquivos rastreados pelo Git no commit `c440e5d`)

Método: `git ls-tree -r -l` (arquivos e bytes) e `git grep -I -c ''` (linhas de arquivos de texto). Ficam de fora
`node_modules`, `dist*` e `.git`, que o Git não rastreia.

| Pasta     | Arquivos |     Linhas |         Bytes |
| --------- | -------: | ---------: | ------------: |
| (raiz)    |        2 |        303 |        23.115 |
| `.github` |        3 |        457 |        20.584 |
| `archive` |      192 |     27.752 |     3.008.513 |
| `legal`   |        2 |        156 |         9.060 |
| `web`     |      510 |     70.301 |     4.913.192 |
| **Total** |  **709** | **98.969** | **7.974.464** |

Dentro de `web/`: `src` 247 arquivos (1.597.043 B), `supabase` 139 (964.269 B), `docs` 53 (1.407.667 B, dos quais
~1 MB são os prints do E2E em `docs/e2e-prints/`), `public` 19 (433.314 B), `scripts` 20 (96.855 B), `e2e` 15
(56.028 B), `package-lock.json` 321.522 B.

Por tipo (arquivos): 153 `.ts`, 118 `.tsx`, 118 `.sql`, 76 `.js` (75 no `archive/`), 65 `.svg`, 56 `.jpg`,
37 `.md`, 17 `.css`, 16 `.png`, 11 `.mjs`, 11 `.json`, 8 `.sh`, 7 `.html` e outros 16.

### Checagens

| Checagem                                          | Resultado                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                          | OK                                                                                                                                                                                                                                                              |
| `npm run typecheck`, `lint`, `format:check`       | OK                                                                                                                                                                                                                                                              |
| `npm test`                                        | **25 arquivos, 217 testes passando** (o `CLAUDE.md` ainda diz 207)                                                                                                                                                                                              |
| `build:demo`, `build:staging`, `build:standalone` | OK (o de staging com as variáveis falsas do CI)                                                                                                                                                                                                                 |
| Lighthouse mobile, mediana de 3                   | desempenho **99** (rodadas 99, 99, 97), acessibilidade **100**, boas práticas **100**                                                                                                                                                                           |
| axe (WCAG 2.1 AA, `scripts/a11y-check.mjs`)       | **14 telas sem problemas**                                                                                                                                                                                                                                      |
| Testes SQL locais                                 | **não rodados nesta sessão**: o Docker Hub devolveu 429 (limite de downloads) para `supabase/postgres:17.6.1.011`. Prova: job `sql` verde no `master` em `c440e5d` ([run 39314638895](https://github.com/nivotechdev/Constru-o-Civil/actions/runs/39314638895)) |
| E2E                                               | local bloqueado pelo mesmo 429. Prova: workflow `staging` verde em `c440e5d` ([run 39314638757](https://github.com/nivotechdev/Constru-o-Civil/actions/runs/39314638757))                                                                                       |

### Peso do app

Os builds embutem o commit (`VITE_RELEASE`). Para comparar antes e depois, os três builds são feitos com
`VITE_RELEASE=limpeza`. Assim ficam **determinísticos**: dois builds seguidos dão os mesmos bytes, exceto 1 byte
de gzip no `sw.js.map` do staging.

| Build      | Arquivos | Total bruto | Total gzip | Só JS/CSS/HTML (bruto / gzip)                            |
| ---------- | -------: | ----------: | ---------: | -------------------------------------------------------- |
| demo       |      132 |   3.335.728 |  1.346.007 | 97 arquivos, 2.651.757 / 759.829                         |
| staging    |      226 |   9.151.090 |  2.823.404 | 97 arquivos, 2.652.283 / 760.042 (+94 `.map`, 5.814.836) |
| standalone |       20 |   3.403.148 |  1.313.256 | 2 arquivos, 2.971.278 / 979.057                          |

Maiores chunks (demo, bruto/gzip): `heic2any` 1.352.965/339.330 (carregado só ao enviar foto HEIC); `index` (app)
628.339/194.393; `index` (supabase-js) 224.501/58.695; CSS 47.008/9.270; `WorkerProfileScreen` 23.483/7.260;
`workbox` 21.777/7.400. A lista de cada arquivo (bruto e gzip) fica fora do repositório. Ela é refeita a partir do
commit `c440e5d`, e é isso que a C10 usa se a sessão acabar.

### Fotografia de todas as telas

`web/scripts/limpeza/fotografar.mjs` abre **cada uma das 54 rotas** de `src/routes.ts` (58 endereços: algumas rotas
com dois exemplos, como vaga aberta e fechada), com **ids reais da demonstração**. Faz isso **nas três sessões**
(sem login, trabalhador, construtora; quando a rota não é da sessão, o print mostra para onde ela redireciona), em
**360×800 e 1280×800**, com a página inteira. Depois captura 7 estados que só aparecem com um clique:

- modal aberto: filtros do mural, "denunciar ou bloquear" na vaga, "convidar para uma vaga" no perfil;
- erro de formulário: login vazio, cadastro vazio, vaga vazia, "esqueci a senha" vazio.

O relógio do navegador fica parado em 19/10/2026 12h (horário de Brasília), porque a demonstração mostra datas
relativas a "hoje" e a comparação pode rodar em outro dia. Resultado: **362 prints, 0 erros**. A lista de rotas, com
a sessão e o endereço final de cada uma, fica no `rotas.json` junto dos prints, fora do repositório.

**Ruído medido**: duas fotografias seguidas, sem mudar nada, deram 357 de 362 prints idênticos byte a byte. Os 5
restantes diferem em 0–8 pixels, por no máximo 3 níveis de cor (antialiasing de cantos e do desfoque da barra do
topo). Refeitos com `SO=<regex>`, cada um saiu **idêntico byte a byte** a uma das duas capturas anteriores: o ruído
alterna entre duas versões do mesmo print. Regra da C10: um print conta como idêntico se, refeito até 3 vezes,
bater byte a byte com o "antes". `scripts/limpeza/comparar.mjs` mostra pixels e a maior diferença de cor de cada
print, sem tolerância.

### Links entre documentos

`web/scripts/limpeza/links.mjs` confere os links `[…](…)` e os caminhos citados entre crases nos `.md` (fora de
`archive/` e deste documento, que cita de propósito o que sumiu): 25 arquivos, 335 citações, **2 quebradas**. Uma é
`web/preview/index.html` em `DECISOES.md` (saída de build, fora do Git). A outra é `LegacyRerender.tsx` em
`VALIDACAO.md` (componente removido, ver `DECISOES.md` › "Fase C — pendências antigas").
