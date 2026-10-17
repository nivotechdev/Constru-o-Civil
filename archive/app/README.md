# Bicos — web app

Implementation of the Bicos marketplace design (worker + recruiter flows) from the
Claude Design handoff in `../project`. Plain HTML/CSS/JS — no UI framework. A single
hash-routed SPA serves both account types; components live under `js/components/` and
are shared across screens (the same `JobCard`, `Button`, `AppNav`, etc. render in every
context that needs them).

## Running it

**Just open `index.html`** — double-click it, or drag it into a browser tab. No server,
no install, no build step. `css/tailwind.css` and `js/bundle.js` are pre-built and
committed, and every icon is inlined as a data URI, so there's no external file the
browser needs to fetch under `file://`.

If you change anything under `js/` or add Tailwind classes, rebuild before reopening:

```
npm install
npm run build   # rebuilds both css/tailwind.css and js/bundle.js
```

(`npm run watch:css` / `watch:js` recompile on change while you edit; `npm start` builds
and serves it over HTTP with `serve`, which is only needed for things a `file://` page
can't do, like copy-pasteable links during dev — not for using the app itself.)

Source is written as ES modules (`js/main.js` and its `import`s) for readability; `esbuild`
bundles them into the single classic `js/bundle.js` that `index.html` actually loads.
That's deliberate: a `type="module"` script is blocked by the browser's CORS policy when
the page is opened via `file://` (no server = no origin to satisfy the module loader), so
`index.html` never references the ES module source directly.

## Layout

- `js/store.js` — in-memory mock "database" (seeded from `js/data/seed.js`) plus the
  screen-local UI state every render reads from. No backend.
- `js/router.js` / `js/main.js` — hash router and the app shell (nav + screen content).
- `js/components/` — the reusable component library (Button, Input, Card, Modal, Skeleton,
  EmptyState, ErrorState, the JobTile/JobCard/CandidateRow marketplace pieces, PhotoCarousel /
  PhotoManager for a job's photos, and `AppNav`, the single navigation component that
  renders as a floating tab bar on phones and a full-width top navbar from `lg:` up).
- Breakpoints: `lg` is 770px (see `tailwind.config.js`) — below it is the phone layout,
  from it up the tablet/desktop layout. Every job list in the app (mural, applications, saved jobs, company
  profiles) uses the same `JobTile` in the same grid (`.tile-grid` in `css/base.css`), so a
  tile is exactly the same size everywhere: two equal columns on a phone, a fixed
  16.75rem-wide tile from 640px up. The mural sizes itself to whole columns, 2 up to at most
  6 per row (`.mural-frame`). The only horizontal scrolling in the app is a job's photo carousel
  (touch swipe, mouse drag, arrows or keyboard) — on the mural tiles themselves and on the
  job page, which opens on the photo last shown on the tile.
- `js/utils/jobInfo.js` — how a job's schedule reads everywhere: date and hours are
  optional ("a combinar"), and `dias` is one of weekdays / weekend / any day.
- `js/data/cidades.js` + `js/utils/cidades.js` — every Brazilian municipality (IBGE data
  via the MIT-licensed `municipios-br` package) for the "Onde você quer trabalhar" picker:
  accent-insensitive search, and nearest city from the browser's GPS position, offline.
- `img/jobs/` — sample job photos used by a few seed jobs, rendered by
  `scripts/gen-job-photos.cjs` (illustrated scenes, so no third-party image licences).
- `js/screens/{shared,worker,recruiter}/` — one file per screen, composed out of the
  component library.
- `icons/` — Lucide SVGs vendored locally (via `lucide-static`); `scripts/gen-icons.cjs`
  inlines them as data URIs into `js/utils/iconData.js` (also committed), so the icon
  `mask-image` never depends on an external fetch — needed both to avoid a CDN and
  because `mask-image` specifically (unlike `<img src>`) is CORS-blocked under `file://`
  even for a same-folder file.

## Design tokens

`css/tokens.css` mirrors the source design system's tokens (colors, shadows, radii,
motion) as CSS custom properties; `tailwind.config.js` maps the same palette into
Tailwind's utility classes so screens are written with `bg-brand-500`, `text-danger-500`,
etc. instead of hand-rolled CSS. All spacing/sizing in the screens uses Tailwind's
rem-based scale (or an explicit `[Nrem]` arbitrary value) — never raw px, and never
`position: absolute` to lay out a whole screen.
