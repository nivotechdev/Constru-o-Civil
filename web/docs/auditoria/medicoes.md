# Q1 — Medições (resumo)

Transcrito pelo consolidador a partir do relatório final do agente Q1.

## Bundle (`dist-demo`, 115 arquivos em `assets/`)

| Arquivo                     | Bruto    | gzip   | brotli | Carrega               |
| --------------------------- | -------- | ------ | ------ | --------------------- |
| `index` (entrada)           | 653 KB   | 202 KB | 172 KB | no início             |
| `index-DaueY` (supabase-js) | 224 KB   | 59 KB  | 50 KB  | início, só modo real  |
| `heic2any`                  | 1.353 KB | 339 KB | 263 KB | só ao enviar HEIC     |
| `MapCanvas`                 | 153 KB   | 45 KB  | 39 KB  | só ao abrir o mapa    |
| `firebaseSdk`               | 113 KB   | 33 KB  | 29 KB  | em ocioso, sem sessão |
| CSS principal               | 59 KB    | 12 KB  | 10 KB  | início                |

- JS total: 2.895 KB bruto, 839 KB gzip, 698 KB brotli.
- JS inicial real: ~172 KB br (demonstração) e ~222 KB br (modo real, com supabase), mais 2 fontes (33 KB).
- Precache do SW: 123 entradas, 3.097 KiB.

## Orçamento do CI × medido

|                                       | Meta do CI | Medido    |
| ------------------------------------- | ---------- | --------- |
| Performance (`/`)                     | ≥ 85       | 96–99     |
| Performance (`/login`)                | ≥ 85       | 90–98     |
| Performance (`/cadastro/trabalhador`) | ≥ 85       | **74–86** |
| Acessibilidade                        | ≥ 95       | 100       |
| Boas práticas                         | ≥ 95       | 100       |

- LCP: `/login` 1,5–2,0 s; cadastro 3,9–4,9 s. TBT: 115–354 ms. CLS: ≤ 0,002. Requisições: 99–104. Transferência: 377–418 KB. JS não usado: ~53 KB.

## Cobertura da lista do Q1

| Arquivo                       | Como foi lido                             | Achados                        |
| ----------------------------- | ----------------------------------------- | ------------------------------ |
| `vite.config.ts` (171 linhas) | por inteiro                               | Q1-001, Q1-012, Q1-013, Q1-017 |
| `tailwind.config.js` (46)     | por inteiro                               | nenhum                         |
| `postcss.config.js` (8)       | por inteiro                               | nenhum                         |
| `build/env.ts` (129)          | por inteiro                               | nenhum                         |
| `index.html` (148)            | por inteiro                               | Q1-008, Q1-010, Q1-016         |
| `robots.txt` (2)              | por inteiro                               | nenhum                         |
| `public/icons/*`              | binário; `maskable-512` e `og.png` vistos | nenhum                         |

- `_headers`, `push-sw.js` e `dist-demo/manifest.webmanifest` também foram lidos.
- Lidos para o código de desempenho: `data.ts`, `store.ts`, `queries.ts`, `feedQuery.ts`, `feed/*`, `image.ts`, `PhotoCarousel.tsx`, `MapCanvas.tsx`, `storage.ts`, `session.ts`, `client.ts`.
- Os tiles do OpenStreetMap e o OSRM são uso leve documentado em `DECISOES.md:2301`; para o OSRM veja D5-003 (envia a coordenada da casa do trabalhador).
