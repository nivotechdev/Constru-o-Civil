# C6 — Roteador, hooks, layouts, utilitários, estilos e tipos (auditoria AUD)

Transcrito pelo consolidador a partir do relatório final do agente C6 (o agente não conseguiu gravar o arquivo). Leu por inteiro 45 arquivos de `web/src`; evidências em `$SCRATCH/out/C6/work/`, prints em `$SCRATCH/prints/C6/`. Contagem: S0 0, S1 0, S2 2, S3 7, M 1. O achado mais grave que reproduziu (link público e Ajuda quebrados sem login) já é o C3-001; confirmado de forma independente com a adição de `/completar-cadastro`. Caminhos relativos a `web/src/`.

### C6-001 — O título da aba nunca muda e o foco volta ao início a cada troca de tela

- Área: acessibilidade
- Severidade: S2
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `App.tsx:181` (`<AppShell key={seq}>` remonta barra e tela a cada navegação), `App.tsx:74` (`scrollTo`), `web/index.html:6`; `grep -rn "document.title" web/src` não acha atribuição alguma
- Prova: `title.mjs` (build demo + Chromium): `/login`, `/mural`, `/minhas-candidaturas` → sempre `title=Bicos — bicos e diárias perto de você`; após focar a aba "Vagas" e Enter, `document.activeElement` = `BODY`. Só o toast tem `aria-live` (`ToastHost.tsx:11`).
- Impacto: leitor de tela/teclado não percebe a troca de tela e perde o ponto; o histórico mostra o mesmo nome em tudo (WCAG 2.4.2 nível A, 2.4.3).
- Causa raiz: roteador próprio sem título por rota nem gestão de foco; a barra é recriada de propósito (`App.tsx:179`).
- Correção recomendada: `title` em `RouteDef`; ao navegar definir `document.title` e focar `<main tabIndex={-1}>`/`<h1>` (ou região `aria-live`).
- Critério de aceite: Playwright navega 3 telas: títulos distintos e `activeElement` dentro de `<main>`.
- Dependências: nenhuma

### C6-002 — "Voltar para a vaga depois de entrar" só vale no login com e-mail e senha; Google, SMS e cadastro novo caem no mural

- Área: produto
- Severidade: S2
- Esforço: M
- Confiança: provável (código; não reproduzido ponta a ponta)
- Onde: `pages/shared/PublicJob.tsx:57-60,105` (grava `RETURN_TO_KEY` também para "Criar minha conta"); `pages/shared/Login.tsx:93-104` (único leitor) e `:247`; `services/guards.ts:26` (`guest` → `homeFor` = `/mural`); `pages/shared/CompleteProfile.tsx:122` (`navigate('/mural')`); `services/store.ts:140-145` (`setSessionAccount` zera `ui` ao trocar de conta)
- Prova: `grep -rn RETURN_TO_KEY web/src` → um consumidor. Cadastro: `/verificar-email` → `/completar-perfil` → `/mural`; Google/SMS entram por rotas `guest`, o guarda manda a `/mural`; a chave ainda seria apagada ao iniciar sessão.
- Impacto: quem recebeu o link de uma vaga, cria conta (ou entra pelo Google) e chega ao mural sem a vaga que o trouxe: perde-se a entrada que a empresa divulga.
- Causa raiz: destino guardado em estado de tela em memória, lido por uma só tela.
- Correção recomendada: guardar o destino (validado como rota do app) em `sessionStorage` e consumi-lo em `homeFor`/fim do onboarding.
- Critério de aceite: e2e modo real `/v/<slug>` → cadastro/Google/SMS → termina em `/vaga/<id>`.
- Dependências: C3-001

### C6-003 — No tema escuro o contorno de foco dos botões e o foco padrão têm 2,7–2,9:1

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (cálculo `contrast.py`)
- Onde: `styles/tokens.css:92,166` (`--border-focus` = `--blue-500` = `#1d4bed` também no escuro), `styles/base.css:45-48`, `components/Button.tsx:63` (`outline-brand-500`)
- Prova: `#1d4bed` sobre cartão escuro (22 28 39) 2,67:1; sobre página escura (13 18 27) 2,93:1; sobre `concrete-100` escuro 2,37:1; no claro 6,40:1. Mínimo 3:1 (WCAG 1.4.11). Os demais pares já estão em C5-002/C5-010.
- Impacto: no tema escuro, quem usa teclado enxerga pouco o foco de todo botão.
- Causa raiz: o mesmo azul de foco nos dois temas.
- Correção recomendada: `--border-focus` e `outline-brand-500` com tom claro no escuro (`#5b7bf2` = 4,5:1 no cartão).
- Critério de aceite: teste de contraste foco × superfície ≥ 3:1 nos dois temas.
- Dependências: nenhuma

### C6-004 — Com "reduzir movimento" o ícone de carregando fica parado

- Área: acessibilidade
- Severidade: S3
- Esforço: P
- Confiança: confirmado (reproduzido)
- Onde: `styles/base.css:117-124` (`animation-duration: 0.01ms !important` sem mexer na repetição), `:91-93`, `:110-115`
- Prova: `reduced.mjs`: normal → ângulos `[0,9,17,26,34,43,51,60]`, 0,7 s infinito; `reducedMotion: reduce` → duração `1e-05s` e ângulos `[0,72,72,72,72,72,72,72]` (parado num arco). O esqueleto fica na cor base.
- Impacto: "carregando" vira desenho parado; não dá para distinguir de travado.
- Causa raiz: a regra de movimento reduzido zera a duração em vez de trocar a animação.
- Correção recomendada: no `@media` dar ao spinner rotação lenta/pulso e `animation-iteration-count: 1` ao resto.
- Critério de aceite: com `reduce` o spinner muda de estado em 2 s.
- Dependências: nenhuma

### C6-005 — Número colado com "+55" ou "0" vira outro número e é recusado

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado (função executada, `t1.mts`)
- Onde: `utils/format.ts:24-35` (`maskPhone` corta nos 11 primeiros dígitos); usado em `Signup.tsx`, `ChangeWhatsApp.tsx:128`, `PhoneSignIn.tsx:122`
- Prova: `"+55 54 99999-9999"` → `(55) 54999-9999` (inválido); `"5554999999999"` idem; `"054 99999-9999"` → `(05) 49999-9999`; `"(54) 99999-9999"` ok.
- Impacto: quem copia da agenda/WhatsApp vê os dígitos trocarem e "número inválido" sem entender.
- Causa raiz: a máscara corta antes de tirar o prefixo.
- Correção recomendada: tirar prefixo 55 (12–13 dígitos) ou 0 antes de cortar.
- Critério de aceite: teste dos 4 casos → `(54) 99999-9999`.
- Dependências: nenhuma

### C6-006 — Lista do IBGE (≈64 KB gz) no pacote principal e prefetch de todas as telas pesam na primeira visita

- Área: desempenho
- Severidade: S3
- Esforço: M
- Confiança: confirmado (build real medido)
- Onde: `services/remote/data.ts:10` (import estático de `cityByLabel`) → `services/cities.ts:3` → `data/cidades.ts`; `routes.ts:204-206` + `App.tsx:146-149` (`preloadAllScreens` no ocioso, sem olhar `saveData`)
- Prova: `attr.mjs` no `index-*.js` do build real (198 KB gz): `cidades.ts` 156 KB brutos, `seed.ts` 30 KB (seed já em C2-007). `preload.mjs` em `/login`, sem SW: 4 arquivos/242 KB gz ao carregar + 93 arquivos/237 KB gz logo depois (inclui telas da empresa e `/admin` para trabalhador).
- Impacto: ≈480 KB baixados antes do primeiro toque, em 3G/dados limitados; a lista só é usada em 3 telas.
- Causa raiz: import estático e prefetch indiscriminado.
- Correção recomendada: busca de cidade assíncrona (`import()`/fatiar por UF); prefetch só do papel da sessão e pulando `saveData`/conexão lenta.
- Critério de aceite: principal < 140 KB gz, sem `cidades` no principal.
- Dependências: C2-007

### C6-007 — Textos: "Conta de recrutador" na tela e "até Hoje/Amanhã" com maiúscula no meio da frase

- Área: UX
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: `layouts/AppNav.tsx:297`; `pages/recruiter/BoostJob.tsx:50`, `JobManage.tsx:242`, `BoostPayment.tsx:129` (usam `dateTimeLabel`, `utils/dates.ts:66-70`)
- Prova: CLAUDE.md §1 ("recrutador … na tela: empresa"); o app diz "conta de empresa" em `App.tsx:38`; frase gerada "…no topo do mural até Amanhã, 14h00."
- Impacto: textos inconsistentes com o vocabulário do produto.
- Causa raiz: rótulo reaproveitado sem ajuste de caixa.
- Correção recomendada: "Conta de empresa"; `.toLowerCase()` do rótulo nas frases.
- Critério de aceite: nenhum "recrutador" em texto de tela.
- Dependências: nenhuma

### C6-008 — Menu da conta e abas com semântica incompleta

- Área: acessibilidade
- Severidade: S3
- Esforço: M
- Confiança: provável
- Onde: `layouts/AppNav.tsx:288-304` (`role="menu"`/`menuitem`), `:113-132` e `:205-227` (abas são `<button>` com `navigate`), `:237-242` (`aria-haspopup="dialog"`), `:60-65` (Esc global)
- Prova: nenhum `onKeyDown` de setas/Home/End nem foco no 1º item ao abrir; abas sem `href` (não abrem em nova aba).
- Impacto: padrão ARIA de menu declarado mas não implementado.
- Causa raiz: roles ARIA sem o comportamento correspondente.
- Correção recomendada: lista de botões (disclosure) em vez de `role="menu"`, ou implementar o padrão; abas `<a href>` + `navigate`.
- Critério de aceite: teste de teclado (Esc devolve foco ao botão).
- Dependências: C5-012

### C6-009 — Higiene: duplicações e comentários/documentos desatualizados

- Área: código
- Severidade: S3
- Esforço: P
- Confiança: confirmado
- Onde: (a) três listas de meses: `utils/dates.ts:5`, `format.ts:74`, `jobInfo.ts:161`; (b) duas `fold` diferentes: `utils/text.ts:2` e `addressText.ts:4`; (c) `types/supabase.ts:1-5` diz que o SQL é "rascunho" e que o back end escreve as migrations a partir dele (hoje é o contrário); declara 18 de 39 tabelas e 50 de 147 RPCs; o drift-check (l.613-644) só vê colunas declaradas (faltam ex. `jobs.hidden_at`, `accounts.suspended_at`) e só a existência das RPCs, mas nenhum argumento divergiu (`probe.cjs`); (d) `env.d.ts:3-4` diz que as variáveis são opcionais (só no demo; `npm run build` exige 6; Firebase fora do `.env.example` = D4-012); (e) `types/models.ts`: exemplos "pedreiro-acabamento"/"Construtora Meridiano" (l.37/44) e comentário solto "F10: the days a worker takes jobs." (l.327); (f) `components/NotFound.tsx` e `PageNotFound` (`App.tsx:21`) são duas telas 404; (g) CLAUDE.md §3 lista 9 status, o código tem 11 (M1-006)
- Prova: leitura e script de comparação com `database.generated.ts`.
- Impacto: uma mudança futura exige lembrar das cópias; cabeçalhos enganam.
- Causa raiz: acúmulo entre rodadas.
- Correção recomendada: um `MONTHS`, renomear uma `fold`, atualizar cabeçalhos, unificar a tela 404.
- Critério de aceite: sem duplicata nem cabeçalho errado.
- Dependências: nenhuma

### C6-010 — (melhoria agora) Teste de visitante no modo real

- Área: testes
- Severidade: M
- Esforço: P
- Confiança: confirmado
- Onde: `web/e2e/fluxos` (8 roteiros; nenhum abre `/v/…`, `/ajuda` ou `/completar-cadastro` sem sessão); `src/__tests__` (nada de `AppShell`)
- Prova: `grep -rn "/v/\|ajuda" web/e2e` vazio; o erro de C3-001 só existe com `IS_DEMO=false`.
- Impacto: ganho: o erro de maior impacto da auditoria teria sido pego por um teste de 20 linhas.
- Causa raiz: nenhum teste exercita o app sem sessão no modo real.
- Correção recomendada: e2e "visitante" no build real percorrendo as rotas `public`/`guest` da tabela de rotas + teste de que toda rota `public` abre sem `db.workers[...]`.
- Critério de aceite: falha se `AppShell.tsx:94` voltar a ler `worker.name` sem sessão.
- Dependências: C3-001

## Hipóteses não confirmadas

- H1 `utils/media.ts:68-85` `videoSeconds` sem prazo: se o iOS (economia de dados) não disparar `loadedmetadata`/`error`, "Publicar trabalho" espera para sempre. Sem iPhone para testar.
- H2 `hooks/useAction.ts:36-41`: `onSuccess` roda dentro do `try`; se lançar, ação que deu certo aparece como erro (latente: os 50 usos só chamam toast/navigate).
- H3 `hooks/useModal.ts:27-31` filtra por `offsetParent`; filhos `position: fixed` ficam fora do Tab.
- H4 `useAddressEditor.ts:38-47` `setDraft(r.draft)` após `await` pode sobrescrever digitação durante a consulta.
- H5 `useTextField.ts:6`: autofoco só na primeira tela do documento.
- H6 `runQuery` + `clearQueries`: resposta tardia entre contas (C2-005).

## Bom e deve ser preservado

- `routes.ts` `screen()`: promessa marcada como resolvida (render síncrono) e download falho esquecido (Z10); frágil a trocar por `React.lazy`. `services/guards.ts`: guarda pura, onboarding preso ao passo, papel errado vira tela explicativa.
- Datas: `parseISODate` local (nunca `new Date('YYYY-MM-DD')`); `dayLabel/addDays/daysBetween` corretos em `TZ=America/Sao_Paulo` e UTC; `dateTimeLabel/relativeTime` só recebem timestamps. CPF/CNPJ: dígitos e sequências repetidas certos; `formatBRL`; `whatsappUrl` decide o 55 pelo tamanho.
- `useModal` (pilha, trava de rolagem contada, foco devolvido); `useInnerBack/holdBack`; enums de `models.ts` = banco gerado; `cidades.ts` íntegro (5.571 linhas, 27 UFs, sem nome+UF repetido; só Noronha fora de lon ≤ -34, já em D3c); seed sem vocabulário de obra/EPI; nenhum link do código aponta para rota inexistente e nenhuma rota é órfã; parâmetros inválidos (`/cadastro/xyz`, `/avaliacoes/xyz/1`) caem em padrão seguro.
