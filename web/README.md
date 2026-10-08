# Bicos — front-end em React + TypeScript

Migração 1:1 do app legado (`../app`, HTML + JavaScript ES modules + Tailwind) para **React 19 +
TypeScript + Vite**. Mesma aparência, mesmos textos, mesmas regras de negócio — a comparação
automatizada com o app original está em `scripts/parity/` (ver `docs/VALIDACAO.md`).

> O app legado continua intacto em `../app` e é a referência da validação.

## Rodando

```bash
npm install
npm run dev          # servidor de desenvolvimento (http://localhost:5173)
npm run build        # build de produção em dist/ (code splitting por tela)
npm run preview      # serve o dist/
npm run build:standalone  # dist-standalone/index.html com tudo embutido — abre direto do disco (file://), como o legado
```

Qualidade:

```bash
npm run typecheck    # tsc (strict)
npm run lint         # ESLint (typescript-eslint + react-hooks)
npm run format       # Prettier
npm test             # Vitest — inclui testes de paridade de lógica contra os módulos JS do legado
npm run build && npm run parity   # paridade visual/comportamental contra o app legado (Playwright)
```

## Estrutura

```
src/
  main.tsx              bootstrap (roteador + React root + CSS)
  App.tsx               rota atual → tela (com ou sem shell), 404, scroll ao topo, prefetch de telas
  routes.ts             tabela de rotas; cada tela é um chunk carregado sob demanda
  layouts/              AppShell (nav + <main>) e AppNav (pílula no celular, barra "ilha" ≥ 770px, menu da conta)
  pages/
    shared/             splash, login, cadastro, verificação, completar perfil, senha, perfis, avaliações, configurações
    worker/             mural (feed/), vaga, candidatura, minhas candidaturas, salvas, selecionado, avaliar
    recruiter/          publicar vaga, publicada, gerenciar, fechado, impulsionar, histórico
  components/           biblioteca de UI (Button, Input, Card, Modal/Sheet, JobTile, PhotoCarousel, …)
    icons/              ícones Lucide como mask-image (data URIs, nomes tipados em IconName) + "G" do Google
  hooks/                useStore (useDb/useRole/useUI), useTextField (cursor/autofoco dos campos)
  services/             única porta de acesso a dados (ver abaixo)
  data/                 seed (dados de demonstração), cidades (IBGE) — lidos só por services/
  types/                models (domínio), ui (tons e badges), supabase (tabelas do banco futuro)
  utils/                formatação/máscaras, textos de agenda, WhatsApp, status de candidatura
  styles/               tokens.css, base.css (os do legado, só com os tokens e regras que o app usa) e tailwind.css
public/img/jobs/        fotos de exemplo das vagas
scripts/parity/         harness de paridade legado × React
supabase/migrations/    esquema SQL sugerido para o Supabase (não aplicado)
docs/                   MAPEAMENTO.md, VALIDACAO.md, RELATORIO_PARIDADE.md e SUPABASE.md
```

`services/`:

| Módulo                               | Responsabilidade                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `store.ts` · `selectors.ts`          | estado em memória (dados, lado logado, estado de tela) e as consultas puras sobre ele  |
| `auth.ts` · `account.ts`             | login, cadastro, senha e privacidade — simulados, com os mesmos atrasos do legado      |
| `marketplace.ts`                     | publicar vaga e enviar candidatura (as duas ações que "vão ao servidor")               |
| `catalog.ts` · `cities.ts`           | listas de opções, planos de impulsionamento e busca de cidades                         |
| `notifications.ts` · `media.ts`      | notificações e contador do sino · URL das fotos/vídeos escolhidos                      |
| `router.ts` · `sharedUI.ts`          | hash router · estados de tela lidos por mais de uma tela                               |
| `supabase.ts` · `supabaseMappers.ts` | cliente Supabase (desligado sem `.env`) e conversão tabela ↔ modelo — ainda não usados |

Telas, componentes e hooks não importam `src/data/` (regra do ESLint): trocar o mock por um backend
real mexe só em `services/`.

## Decisões

- **Estilo**: Tailwind CSS 3.4.19 com o _mesmo_ `tailwind.config` do legado, `tokens.css` e `base.css`
  copiados do legado (sem os tokens e regras que nenhum elemento usa — o conjunto completo de tokens
  continua em `../app/css/tokens.css`), e as mesmas classes em cada elemento. O CSS gerado tem as
  mesmas regras do legado (o autoprefixer é o mesmo que o CLI do Tailwind usava). Isso garante
  identidade visual sem reescrever valores em CSS Modules/styled-components.
- **Estado**: `services/store.ts` reproduz o store em memória do legado — dados (`db`), papel logado
  (`role`) e o "saco" de estado de UI por tela (`ui`), que sobrevive à navegação como antes. As
  atualizações são imutáveis e os componentes assinam só a fatia que leem (`useSyncExternalStore`),
  evitando re-renderizações desnecessárias.
- **Roteamento**: o hash router do legado portado como está (`#/rota`, pilha própria de "voltar",
  `goBack(fallback)`), com as telas em chunks separados e pré-carregados quando o navegador fica ocioso.
  Uma tela já carregada renderiza de forma síncrona — nunca aparece um quadro vazio entre telas.
- **Micro-interações do legado**: o app antigo recriava todo o DOM a cada mudança de estado, o que
  tinha efeitos visíveis (foco, transições, animações, rolagem). `components/LegacyRerender.tsx`
  reproduz esses efeitos depois de cada atualização; removê-lo de `App.tsx` dá o comportamento mais
  suave do React. Detalhes em `docs/VALIDACAO.md` → Observações.
- **Firebase**: o repositório **não usa Firebase** (nem Auth, nem Realtime Database). Login,
  cadastro e verificação de e-mail são simulados, como no legado. Detalhes em `docs/MAPEAMENTO.md`.
- **Supabase (preparado, não conectado)**: `services/supabase.ts` cria o cliente a partir de
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ver `.env.example`; copie para `.env.local`, nunca
  versionado). Sem essas variáveis — o caso atual — o app roda no modo mock e a biblioteca nem entra no
  bundle. Tabelas sugeridas, pontos de troca e passo a passo em `docs/SUPABASE.md`.
