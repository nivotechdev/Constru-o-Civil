import { h, cx } from '../../dom.js';
import { NotificationBell } from '../../components/TopBar.js';
import { Tag } from '../../components/Tag.js';
import { Switch } from '../../components/Radio.js';
import { Button } from '../../components/Button.js';
import { Card } from '../../components/Card.js';
import { Rating } from '../../components/Rating.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Logo } from '../../components/Logo.js';
import { Sheet } from '../../components/Modal.js';
import { JobTile } from '../../components/JobTile.js';
import { Icon } from '../../utils/icons.js';
import * as store from '../../store.js';
import { TIPOS_SERVICO } from '../../data/seed.js';
import { Input } from '../../components/Input.js';
import { searchCities, nearestCity } from '../../utils/cidades.js';

const KEY = 'feed';

function openJob(navigate, role, job) {
  return () => navigate(role === 'recrutador' && store.isMine(job) ? '/vaga-gerenciar/' + job.id : '/vaga/' + job.id);
}

function km(distance) { return parseFloat(String(distance || '0').replace(',', '.')) || 0; }
function payNum(job) { return job.pay == null ? -1 : job.pay; }
// Earliest first: today, tomorrow, any other date, then jobs whose date is still open.
function soon(job) { return job.date === 'Hoje' ? 0 : job.date === 'Amanhã' ? 1 : job.date ? 2 : 3; }

// The "Quando" filter: a specific day matches the date; a part of the week matches the
// days the job can happen on.
function matchesQuando(job, quando) {
  if (!quando) return true;
  if (quando === 'Durante a semana') return job.dias === 'semana' || job.dias === 'qualquer';
  if (quando === 'Fim de semana') return job.dias === 'fimdesemana' || job.dias === 'qualquer';
  return job.date === quando;
}

// Recruiters see their own jobs first, then boosted jobs, then the rest in the chosen order.
function orderJobs(jobs, role, sort = 'perto') {
  const rank = (j) => (role === 'recrutador' && store.isMine(j) ? 0 : j.urgent ? 1 : 2);
  const by = sort === 'valor' ? (a, b) => payNum(b) - payNum(a)
    : sort === 'cedo' ? (a, b) => soon(a) - soon(b) || km(a.distance) - km(b.distance)
    : (a, b) => km(a.distance) - km(b.distance);
  return jobs.slice().sort((a, b) => rank(a) - rank(b) || by(a, b));
}

function tileFor(navigate, role, job) {
  return JobTile({
    job, company: store.getCompany(job.companyId), onClick: openJob(navigate, role, job),
    mine: role === 'recrutador' && store.isMine(job),
    saved: store.isJobSaved(job.id),
    onToggleSave: role === 'trabalhador' ? () => store.toggleSavedJob(job.id) : null
  });
}

// The mural's one grid of job tiles, 2 columns on a phone up to 7 on a wide monitor.
function tileGrid(navigate, role, jobs) {
  return h('div', { class: 'tile-grid' }, ...jobs.map((j) => tileFor(navigate, role, j)));
}

// Every seed job is in the city of São Paulo; a job may name another city in `city`.
const DEFAULT_CITY = 'São Paulo, SP';
const jobCity = (job) => job.city || DEFAULT_CITY;
const NO_FILTERS = { tipo: null, dist: 'Toda a cidade', quando: null, location: DEFAULT_CITY };
const SORTS = [{ id: 'perto', label: 'Mais perto' }, { id: 'valor', label: 'Maior valor' }, { id: 'cedo', label: 'Mais cedo' }];

export default function renderFeed(navigate) {
  const role = store.getRole();
  const ui = store.getUI(KEY, { search: '', location: DEFAULT_CITY, filtersOpen: false, pickerOpen: false, cityQuery: '', geo: null, tipo: null, dist: 'Toda a cidade', quando: null, sort: 'perto', notifyUrgent: true });
  const open = store.activeJobs().filter((j) => !store.isJobClosed(j));
  const filtered = open.filter((j) => passesFilters(j, ui));
  return h('div', {},
    mobileFeed(navigate, role, ui, open, filtered),
    desktopFeed(navigate, role, ui, open, filtered),
    // One filter panel for both layouts: a bottom sheet on phones, a dialog on desktop.
    filtersSheet(ui, open, filtered.length),
    cityPicker(ui)
  );
}

function passesFilters(j, ui) {
  return jobCity(j) === ui.location && (!ui.tipo || j.role === ui.tipo) && (ui.dist === 'Toda a cidade' || km(j.distance) <= parseInt(ui.dist.replace(/\D/g, ''), 10)) && matchesQuando(j, ui.quando);
}

function activeFilters(ui) {
  return [
    ui.location !== DEFAULT_CITY ? { label: ui.location, icon: 'map-pin', remove: () => store.setUI(KEY, { location: DEFAULT_CITY }) } : null,
    ui.tipo ? { label: ui.tipo, icon: 'hard-hat', remove: () => store.setUI(KEY, { tipo: null }) } : null,
    ui.dist !== 'Toda a cidade' ? { label: ui.dist, icon: 'map-pin', remove: () => store.setUI(KEY, { dist: 'Toda a cidade' }) } : null,
    ui.quando ? { label: ui.quando, icon: 'calendar', remove: () => store.setUI(KEY, { quando: null }) } : null
  ].filter(Boolean);
}

function filtersSheet(ui, open, count) {
  const set = (patch) => store.setUI(KEY, patch);
  return Sheet({ open: ui.filtersOpen, title: 'Filtros', onClose: () => set({ filtersOpen: false }) },
    h('div', { class: 'flex flex-col gap-2.5' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Onde você quer trabalhar'),
      h('button', {
        type: 'button', 'aria-haspopup': 'dialog',
        class: 'flex items-center gap-3 w-full p-3 rounded-card border border-concrete-300 bg-white text-left transition-colors hover:bg-concrete-50 hover:border-concrete-400',
        onClick: () => set({ pickerOpen: true, cityQuery: '', geo: null })
      },
        h('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0' }, Icon('map-pin', { size: 20, color: 'var(--brand)' })),
        h('span', { class: 'flex-1 min-w-0 flex flex-col' },
          h('span', { class: 'text-xs text-concrete-500' }, 'Cidade'),
          h('span', { class: 'font-semibold text-concrete-900 truncate' }, ui.location)
        ),
        h('span', { class: 'inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600 shrink-0' }, 'Escolher', Icon('chevron-right', { size: 16, color: 'var(--text-brand)' }))
      )
    ),
    // The phone has these as a segmented control on the mural itself.
    h('div', { class: 'hidden lg:flex flex-col gap-2.5' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Ordenar por'),
      h('div', { class: 'flex flex-wrap gap-2' }, ...SORTS.map((o) => Tag({ label: o.label, selected: ui.sort === o.id, onClick: () => set({ sort: o.id }) })))
    ),
    filterGroup('Tipo de serviço', TIPOS_SERVICO, ui.tipo, (v) => set({ tipo: ui.tipo === v ? null : v })),
    filterGroup('Distância do centro de ' + ui.location.split(',')[0], ['5', '10', '20', 'Toda a cidade'].map((d) => d === 'Toda a cidade' ? d : `Até ${d} km`), ui.dist, (v) => set({ dist: v })),
    filterGroup('Quando', ['Hoje', 'Amanhã', 'Durante a semana', 'Fim de semana'], ui.quando, (v) => set({ quando: ui.quando === v ? null : v })),
    h('div', { class: 'flex flex-col gap-1 pt-1 border-t border-concrete-200' },
      Switch({ label: 'Avisar quando aparecer bico novo', description: 'Chega uma notificação quando surgir vaga com esses filtros perto de você.', checked: ui.notifyUrgent, onChange: (v) => set({ notifyUrgent: v }) })
    ),
    h('div', { class: 'flex gap-3 pt-1' },
      Button({ label: 'Limpar', variant: 'secondary', className: 'flex-1', onClick: () => set(NO_FILTERS) }),
      Button({ label: `Ver ${count === 1 ? '1 vaga' : count + ' vagas'}`, className: 'flex-[1.4]', onClick: () => set({ filtersOpen: false }) })
    )
  );
}

// "Onde você quer trabalhar": GPS or typing any Brazilian city. Opens over the filters.
function cityPicker(ui) {
  const set = (patch) => store.setUI(KEY, patch);
  const choose = (label) => set({ location: label, pickerOpen: false, cityQuery: '', geo: null });
  const useMyLocation = () => {
    if (!navigator.geolocation) { set({ geo: 'error' }); return; }
    set({ geo: 'loading' });
    navigator.geolocation.getCurrentPosition(
      (pos) => { const c = nearestCity(pos.coords.latitude, pos.coords.longitude); if (c) choose(c.label); else set({ geo: 'error' }); },
      (err) => set({ geo: err && err.code === 1 ? 'denied' : 'error' }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };
  const q = ui.cityQuery.trim();
  const results = ui.pickerOpen ? searchCities(q, 8) : [];
  const geoMsg = ui.geo === 'denied' ? 'Seu navegador não liberou a localização. Digite a cidade abaixo.'
    : ui.geo === 'error' ? 'Não conseguimos achar sua localização agora. Digite a cidade abaixo.' : null;

  return Sheet({ open: ui.pickerOpen, title: 'Onde você quer trabalhar', onClose: () => set({ pickerOpen: false, geo: null }) },
    Button({ label: ui.geo === 'loading' ? 'Buscando sua localização…' : 'Usar minha localização', variant: 'secondary', fullWidth: true, iconLeft: 'locate-fixed', loading: ui.geo === 'loading', onClick: useMyLocation }),
    geoMsg ? h('span', { class: 'flex items-start gap-2 text-sm text-concrete-700 -mt-1' }, Icon('circle-alert', { size: 16, color: 'var(--amber-500)' }), geoMsg) : null,
    h('div', { class: 'flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-concrete-400' },
      h('span', { class: 'flex-1 h-px bg-concrete-200' }), 'ou', h('span', { class: 'flex-1 h-px bg-concrete-200' })
    ),
    Input({ id: 'city-search', placeholder: 'Digite o nome da cidade', icon: 'search', value: ui.cityQuery, autoFocus: true, onInput: (v) => set({ cityQuery: v }) }),
    h('div', { class: 'flex flex-col gap-1' },
      h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500 pb-1' }, q ? 'Cidades encontradas' : 'Cidades mais procuradas'),
      results.length
        ? h('div', { class: 'flex flex-col', role: 'listbox', 'aria-label': 'Cidades' }, ...results.map((c) => {
            const active = c.label === ui.location;
            return h('button', {
              type: 'button', role: 'option', 'aria-selected': active ? 'true' : 'false',
              class: cx('flex items-center gap-3 min-h-12 px-2 -mx-2 rounded-control text-left transition-colors hover:bg-concrete-50', active ? 'text-brand-600' : 'text-concrete-900'),
              onClick: () => choose(c.label)
            },
              Icon('map-pin', { size: 18, color: active ? 'var(--brand)' : 'var(--text-subtle)' }),
              h('span', { class: 'flex-1 min-w-0 truncate' }, h('span', { class: 'font-semibold' }, c.name), h('span', { class: 'text-concrete-500' }, ' · ' + c.uf)),
              active ? Icon('check', { size: 18, color: 'var(--brand)' }) : null
            );
          }))
        : h('span', { class: 'py-3 text-sm text-concrete-500' }, `Nenhuma cidade com “${q}”. Confira a grafia.`)
    )
  );
}

function mobileFeed(navigate, role, ui, openJobs, filtered) {
  const q = ui.search.trim().toLowerCase();
  const searching = q.length > 0;
  const matches = (j) => !q || (j.role + ' ' + store.getCompany(j.companyId).name + ' ' + j.location).toLowerCase().includes(q);
  const ordered = orderJobs(filtered, role, ui.sort);

  const jobResults = searching ? openJobs.filter(matches) : [];
  const companyResults = searching ? store.allCompanies().filter((c) => (c.name + ' ' + c.location).toLowerCase().includes(q)) : [];
  const workerResults = searching ? store.allWorkers().filter((w) => (w.name + ' ' + w.role + ' ' + w.region).toLowerCase().includes(q)) : [];
  const noResults = searching && jobResults.length === 0 && companyResults.length === 0 && workerResults.length === 0;

  const activeChips = activeFilters(ui);
  const activeCount = activeChips.length;

  const header = h('div', { class: 'sticky top-0 z-20 flex flex-col gap-2 px-4 pt-2 pb-3.5 bg-white border-b border-concrete-200' },
    h('div', { class: 'flex items-center justify-between gap-2 min-h-12' },
      h('h1', { class: 'inline-flex', 'aria-label': 'Bicos' }, Logo({ compact: true })),
      NotificationBell({ count: role === 'recrutador' ? 3 : 2, onClick: () => navigate('/notificacoes') })
    ),
    SearchPill({ id: 'feed-search', role, ui, compact: true })
  );

  const searchResults = h('div', { class: 'flex flex-col gap-5' },
    jobResults.length ? h('div', { class: 'flex flex-col gap-3' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Vagas'),
      tileGrid(navigate, role, orderJobs(jobResults, role))
    ) : null,
    companyResults.length ? h('div', { class: 'flex flex-col gap-2' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Construtoras'),
      ...companyResults.map((c) => Card({ padding: 'md', onClick: () => navigate('/construtora/' + c.id) },
        h('div', { class: 'flex items-center gap-3' },
          h('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0' }, Icon('building-2', { size: 20, color: 'var(--brand)' })),
          h('div', { class: 'flex-1 min-w-0 flex flex-col' },
            h('span', { class: 'font-semibold text-concrete-900 truncate' }, c.name),
            h('span', { class: 'text-sm text-concrete-500 truncate' }, c.location)
          ),
          Rating({ value: c.rating, count: c.reviewCount })
        )
      ))
    ) : null,
    workerResults.length ? h('div', { class: 'flex flex-col gap-2' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Trabalhadores'),
      ...workerResults.map((w) => Card({ padding: 'md' },
        h('div', { class: 'flex items-center gap-3' },
          h('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0' }, w.initials),
          h('div', { class: 'flex-1 min-w-0 flex flex-col' },
            h('span', { class: 'font-semibold text-concrete-900 truncate' }, w.name),
            h('span', { class: 'text-sm text-concrete-500 truncate' }, `${w.role} · ${w.region}`)
          ),
          Rating({ value: w.rating, count: w.jobsDone })
        )
      ))
    ) : null,
    noResults ? EmptyState({ icon: 'search-x', title: 'Nenhum resultado para essa busca', description: 'Confira a grafia ou tente um termo mais curto.', actionLabel: 'Limpar busca', onAction: () => store.setUI(KEY, { search: '' }) }) : null
  );

  const browseResults = h('div', { class: 'flex flex-col gap-4' },
    h('div', { class: 'flex flex-wrap items-center gap-2' },
      Tag({ label: activeCount ? `Filtros · ${activeCount}` : 'Filtros', icon: 'sliders-horizontal', onClick: () => store.setUI(KEY, { filtersOpen: true }) }),
      ...activeChips.map((c) => Tag({ label: c.label, icon: c.icon, selected: true, onRemove: c.remove }))
    ),
    h('div', { class: 'flex bg-concrete-100 rounded-full p-1 gap-1' }, ...SORTS.map((o) => h('button', {
      type: 'button',
      class: `flex-1 h-10 rounded-full text-sm font-bold transition-colors ${ui.sort === o.id ? 'bg-white text-brand-600 shadow-card' : 'text-concrete-500'}`,
      onClick: () => store.setUI(KEY, { sort: o.id })
    }, o.label))),
    ordered.length
      ? tileGrid(navigate, role, ordered)
      : noJobsState(ui)
  );

  return h('div', { class: 'flex flex-col lg:hidden' },
    header,
    h('div', { class: 'px-4 pt-4 pb-6' }, h('div', { class: 'mural-frame flex flex-col gap-5' }, searching ? searchResults : browseResults)),

  );
}

// ---------- Desktop / tablet (>= 770px) ----------

function desktopFeed(navigate, role, ui, open, filtered) {
  const q = ui.search.trim().toLowerCase();
  const chips = activeFilters(ui);
  const browse = h('div', { class: 'flex flex-col gap-6' },
    chips.length ? h('div', { class: 'flex flex-wrap items-center gap-2' },
      h('span', { class: 'mr-1 text-concrete-500' }, filtered.length === 1 ? '1 vaga com' : `${filtered.length} vagas com`),
      ...chips.map((c) => Tag({ label: c.label, icon: c.icon, selected: true, onRemove: c.remove })),
      Button({ label: 'Limpar filtros', variant: 'ghost', size: 'sm', onClick: () => store.setUI(KEY, NO_FILTERS) })
    ) : null,
    filtered.length
      ? tileGrid(navigate, role, orderJobs(filtered, role, ui.sort))
      : noJobsState(ui)
  );
  const body = q ? desktopSearchResults(navigate, role, ui, open) : browse;
  const count = chips.length;
  const filterButton = h('button', {
    type: 'button', 'aria-haspopup': 'dialog',
    class: cx('relative shrink-0 inline-flex items-center gap-2.5 h-[4.25rem] px-6 rounded-full bg-white border shadow-float font-semibold text-concrete-900 transition hover:border-concrete-300 hover:shadow-raised',
      count ? 'border-brand-500' : 'border-concrete-200'),
    onClick: () => store.setUI(KEY, { filtersOpen: true })
  },
    Icon('sliders-horizontal', { size: 20 }), 'Filtros',
    count ? h('span', { class: 'inline-flex items-center justify-center min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-brand-500 text-white text-xs font-bold' }, String(count)) : null
  );

  return h('div', { class: 'hidden lg:block min-h-[calc(100vh-5rem)] bg-white' },
    h('div', { class: 'page-x pt-1 pb-8 border-b border-concrete-200' },
      h('div', { class: 'max-w-[60rem] mx-auto flex items-center gap-3' },
        h('div', { class: 'flex-1 min-w-0' }, SearchPill({ id: 'feed-search-desktop', role, ui })),
        filterButton
      )
    ),
    h('div', { class: 'page-x pt-8 pb-20' }, h('div', { class: 'mural-frame' }, body))
  );
}

// Search field shared by the phone and desktop murals: a pill with the blue search button
// on the left and no visible label (the placeholder says what can be searched).
function SearchPill({ id, role, ui, compact = false }) {
  const input = h('input', {
    id, 'data-focus-id': id, type: 'search', autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
    'aria-label': 'Buscar bicos',
    placeholder: role === 'recrutador' ? 'Buscar vaga, construtora ou trabalhador' : 'Buscar por serviço, bairro ou construtora',
    value: ui.search,
    class: cx('w-full min-w-0 bg-transparent outline-none text-concrete-900 placeholder:text-concrete-500 [&::-webkit-search-cancel-button]:hidden', compact ? 'text-[0.9375rem]' : 'text-base'),
    oninput: (e) => store.setUI(KEY, { search: e.target.value }),
    onkeydown: (e) => { if (e.key === 'Escape') store.setUI(KEY, { search: '' }); if (e.key === 'Enter') e.target.blur(); }
  });
  return h('div', {
    role: 'search',
    class: cx('flex items-center rounded-full bg-white border border-concrete-200 shadow-float transition focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100',
      compact ? 'gap-3 h-14 pl-1.5 pr-2' : 'gap-4 h-[4.25rem] pl-2 pr-3')
  },
    h('button', {
      type: 'button', 'aria-label': 'Buscar', title: 'Buscar',
      class: cx('shrink-0 inline-flex items-center justify-center rounded-full bg-brand-500 shadow-raised transition hover:bg-brand-600 active:scale-95', compact ? 'w-11 h-11' : 'w-[3.25rem] h-[3.25rem]'),
      onClick: () => { const el = document.getElementById(id); if (el) el.focus(); }
    }, Icon('search', { size: compact ? 20 : 22, color: '#fff' })),
    h('div', { class: 'flex-1 min-w-0 flex items-center' }, input),
    ui.search ? h('button', {
      type: 'button', 'aria-label': 'Limpar busca', title: 'Limpar busca',
      class: 'shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-concrete-500 transition-colors hover:bg-concrete-100 hover:text-concrete-900',
      onClick: () => store.setUI(KEY, { search: '' })
    }, Icon('x', { size: 18 })) : null
  );
}

function desktopSearchResults(navigate, role, ui, open) {
  const q = ui.search.trim().toLowerCase();
  const jobs = open.filter((j) => (j.role + ' ' + store.getCompany(j.companyId).name + ' ' + j.location).toLowerCase().includes(q));
  const companies = store.allCompanies().filter((c) => (c.name + ' ' + c.location).toLowerCase().includes(q));
  const workers = store.allWorkers().filter((w) => (w.name + ' ' + w.role + ' ' + w.region).toLowerCase().includes(q));
  const parts = [
    jobs.length ? (jobs.length === 1 ? '1 vaga' : `${jobs.length} vagas`) : null,
    companies.length ? (companies.length === 1 ? '1 construtora' : `${companies.length} construtoras`) : null,
    workers.length ? (workers.length === 1 ? '1 trabalhador' : `${workers.length} trabalhadores`) : null
  ].filter(Boolean);

  const heading = h('div', { class: 'flex items-baseline gap-3 flex-wrap' },
    h('h1', { class: 'text-[1.75rem] font-semibold leading-tight text-concrete-900' }, `Resultados para “${ui.search.trim()}”`),
    parts.length ? h('span', { class: 'text-concrete-500' }, parts.join(' · ')) : null
  );

  if (!parts.length) {
    return h('div', { class: 'flex flex-col gap-4' }, heading,
      EmptyState({ icon: 'search-x', title: 'Nenhum resultado para essa busca', description: 'Confira a grafia ou tente um termo mais curto, como o nome do serviço ou do bairro.', actionLabel: 'Limpar busca', onAction: () => store.setUI(KEY, { search: '' }) })
    );
  }

  const group = (title, content) => h('section', { class: 'flex flex-col gap-4' }, h('h2', { class: 'text-[1.375rem] font-semibold text-concrete-900' }, title), content);
  const personGrid = (children) => h('div', { class: 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]' }, ...children);
  const personCard = ({ avatar, name, meta, rating, onClick }) => h(onClick ? 'button' : 'div', {
    type: onClick ? 'button' : null, onClick,
    class: cx('flex items-center gap-4 p-4 rounded-2xl border border-concrete-200 bg-white text-left', onClick ? 'transition hover:shadow-raised hover:border-concrete-300' : '')
  },
    avatar,
    h('div', { class: 'flex-1 min-w-0 flex flex-col gap-0.5' },
      h('span', { class: 'font-semibold text-concrete-900 truncate' }, name),
      h('span', { class: 'text-sm text-concrete-500 truncate' }, meta),
      rating
    )
  );

  return h('div', { class: 'flex flex-col gap-12' },
    heading,
    jobs.length ? group('Vagas', tileGrid(navigate, role, orderJobs(jobs, role))) : null,
    companies.length ? group('Construtoras', personGrid(companies.map((c) => personCard({
      avatar: h('span', { class: 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 shrink-0' }, Icon('building-2', { size: 22, color: 'var(--brand)' })),
      name: c.name, meta: c.location, rating: Rating({ value: c.rating, count: c.reviewCount }),
      onClick: () => navigate('/construtora/' + c.id)
    })))) : null,
    workers.length ? group('Trabalhadores', personGrid(workers.map((w) => personCard({
      avatar: h('span', { class: 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold shrink-0' }, w.initials),
      name: w.name, meta: `${w.role} · ${w.region}`, rating: Rating({ value: w.rating, count: w.jobsDone }),
      onClick: role === 'recrutador' ? () => navigate('/trabalhador/' + w.id) : null
    })))) : null
  );
}

function noJobsState(ui) {
  if (ui.location !== DEFAULT_CITY) {
    return EmptyState({ icon: 'map-pin', title: `Ainda não tem bico em ${ui.location.split(',')[0]}`, description: 'Assim que uma construtora publicar uma vaga nessa cidade, ela aparece aqui.', actionLabel: `Ver bicos em ${DEFAULT_CITY.split(',')[0]}`, onAction: () => store.setUI(KEY, { location: DEFAULT_CITY }) });
  }
  return EmptyState({ icon: 'search-x', title: 'Nenhuma vaga com esse filtro', description: 'Tire um filtro ou aumente a distância para ver mais bicos.', actionLabel: 'Limpar filtros', onAction: () => store.setUI(KEY, NO_FILTERS) });
}

function filterGroup(title, options, active, onSelect) {
  return h('div', { class: 'flex flex-col gap-2.5' },
    h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, title),
    h('div', { class: 'flex flex-wrap gap-2' }, ...options.map((o) => Tag({ label: o, selected: active === o, onClick: () => onSelect(o) })))
  );
}
