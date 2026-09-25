import { h } from '../../dom.js';
import { Input } from '../../components/Input.js';
import { IconButton } from '../../components/IconButton.js';
import { NotificationBell } from '../../components/TopBar.js';
import { Tag } from '../../components/Tag.js';
import { Switch } from '../../components/Radio.js';
import { Button } from '../../components/Button.js';
import { Card } from '../../components/Card.js';
import { Rating } from '../../components/Rating.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Sheet } from '../../components/Modal.js';
import { JobCard, UrgentOverlay, MineOverlay } from '../../components/JobCard.js';
import { Icon } from '../../utils/icons.js';
import * as store from '../../store.js';
import { LOCAIS_BAIRRO, TIPOS_SERVICO } from '../../data/seed.js';

const KEY = 'feed';

function openJob(navigate, role, job) {
  return () => navigate(role === 'recrutador' && store.isMine(job) ? '/vaga-gerenciar/' + job.id : '/vaga/' + job.id);
}

function km(distance) { return parseFloat(String(distance || '0').replace(',', '.')) || 0; }
function payNum(job) { return job.pay == null ? -1 : job.pay; }

export default function renderFeed(navigate) {
  store.ensureJobsLoaded();
  const role = store.getRole();
  const ui = store.getUI(KEY, { search: '', location: 'Tatuapé, SP', locationOpen: false, filtersOpen: false, tipo: null, dist: 'Toda a cidade', quando: null, sort: 'perto', notifyUrgent: true });

  const q = ui.search.trim().toLowerCase();
  const searching = q.length > 0;

  const openJobs = store.activeJobs().filter((j) => !store.isJobClosed(j));
  const matches = (j) => !q || (j.role + ' ' + store.getCompany(j.companyId).name + ' ' + j.location).toLowerCase().includes(q);
  const passesFilters = (j) => (!ui.tipo || j.role === ui.tipo) && (ui.dist === 'Toda a cidade' || km(j.distance) <= parseInt(ui.dist)) && (!ui.quando || j.date === ui.quando);

  const filtered = openJobs.filter(matches).filter(passesFilters);
  const destaques = searching ? [] : filtered.filter((j) => j.urgent).slice(0, 2);
  const destaqueIds = new Set(destaques.map((j) => j.id));
  const rest = filtered.filter((j) => !destaqueIds.has(j.id)).sort((a, b) => {
    if (ui.sort === 'valor') return payNum(b) - payNum(a);
    if (ui.sort === 'cedo') return (a.date === 'Hoje' ? 0 : 1) - (b.date === 'Hoje' ? 0 : 1);
    return km(a.distance) - km(b.distance);
  });

  const jobResults = searching ? openJobs.filter(matches) : [];
  const companyResults = searching ? store.allCompanies().filter((c) => (c.name + ' ' + c.location).toLowerCase().includes(q)) : [];
  const workerResults = searching ? store.allWorkers().filter((w) => (w.name + ' ' + w.role + ' ' + w.region).toLowerCase().includes(q)) : [];
  const noResults = searching && jobResults.length === 0 && companyResults.length === 0 && workerResults.length === 0;

  const activeChips = [
    ui.tipo ? { label: ui.tipo, icon: 'hard-hat', remove: () => store.setUI(KEY, { tipo: null }) } : null,
    ui.dist !== 'Toda a cidade' ? { label: ui.dist, icon: 'map-pin', remove: () => store.setUI(KEY, { dist: 'Toda a cidade' }) } : null,
    ui.quando ? { label: ui.quando, icon: 'calendar', remove: () => store.setUI(KEY, { quando: null }) } : null
  ].filter(Boolean);
  const activeCount = activeChips.length;

  function jobCardEl(job, isDestaque) {
    const company = store.getCompany(job.companyId);
    const mine = role === 'recrutador' && store.isMine(job);
    return JobCard({
      job, companyName: company.name, onClick: openJob(navigate, role, job),
      overlay: isDestaque ? UrgentOverlay({ mine }) : (mine ? MineOverlay() : null)
    });
  }

  const header = h('div', { class: 'sticky top-0 z-20 flex flex-col gap-3 px-2.5 pt-2 pb-3 bg-white border-b border-concrete-200 lg:static lg:border-0 lg:px-0' },
    h('div', { class: 'flex items-center justify-between gap-2' },
      h('button', {
        type: 'button', class: 'flex items-center gap-2 min-h-12 px-1.5 rounded-control',
        onClick: () => store.setUI(KEY, { locationOpen: true })
      },
        Icon('map-pin', { size: 20, color: 'var(--brand)' }),
        h('span', { class: 'flex flex-col items-start' },
          h('span', { class: 'text-xs text-concrete-500' }, 'Bicos perto de'),
          h('span', { class: 'font-semibold text-concrete-900 max-w-[9.5rem] truncate' }, ui.location)
        ),
        Icon('chevron-down', { size: 16, color: 'var(--text-muted)' })
      ),
      NotificationBell({ count: role === 'recrutador' ? 3 : 2, onClick: () => navigate('/notificacoes') })
    ),
    Input({ id: 'feed-search', placeholder: 'Buscar vaga, construtora ou trabalhador', icon: 'search', value: ui.search, onInput: (v) => store.setUI(KEY, { search: v }) })
  );

  const searchResults = h('div', { class: 'flex flex-col gap-5' },
    jobResults.length ? h('div', { class: 'flex flex-col gap-2' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Vagas'),
      ...jobResults.map((j) => Card({ padding: 'md', onClick: openJob(navigate, role, j) },
        h('div', { class: 'flex items-center gap-3' },
          h('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0' }, Icon('hammer', { size: 20, color: 'var(--brand)' })),
          h('div', { class: 'flex-1 min-w-0 flex flex-col' },
            h('span', { class: 'font-semibold text-concrete-900 truncate' }, j.role),
            h('span', { class: 'text-sm text-concrete-500 truncate' }, `${store.getCompany(j.companyId).name} · ${j.location}`)
          ),
          h('span', { class: 'font-mono font-bold text-concrete-900 shrink-0' }, j.pay == null ? 'A combinar' : 'R$ ' + j.pay)
        )
      ))
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

  const browseResults = h('div', { class: 'flex flex-col gap-5' },
    h('div', { class: 'flex flex-wrap items-center gap-2' },
      Tag({ label: activeCount ? `Filtros · ${activeCount}` : 'Filtros', icon: 'sliders-horizontal', onClick: () => store.setUI(KEY, { filtersOpen: true }) }),
      ...activeChips.map((c) => Tag({ label: c.label, icon: c.icon, selected: true, onRemove: c.remove }))
    ),
    h('div', { class: 'flex bg-concrete-100 rounded-full p-1 gap-1 lg:w-fit' }, ...[
      { id: 'perto', label: 'Mais perto' }, { id: 'valor', label: 'Maior valor' }, { id: 'cedo', label: 'Mais cedo' }
    ].map((o) => h('button', {
      type: 'button',
      class: `flex-1 lg:flex-none lg:px-4 h-10 rounded-full text-sm font-bold transition-colors ${ui.sort === o.id ? 'bg-white text-brand-600 shadow-card' : 'text-concrete-500'}`,
      onClick: () => store.setUI(KEY, { sort: o.id })
    }, o.label))),
    destaques.length ? h('div', { class: 'flex flex-col gap-3' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Precisam de gente agora'),
      h('div', { class: 'flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5' }, ...destaques.map((j) => jobCardEl(j, true)))
    ) : null,
    h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, rest.length === 1 ? '1 vaga aberta' : `${rest.length} vagas abertas`),
    rest.length
      ? h('div', { class: 'flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5' }, ...rest.map((j) => jobCardEl(j, false)))
      : (destaques.length === 0 ? EmptyState({ icon: 'search-x', title: 'Nenhuma vaga com esse filtro', description: 'Tire um filtro ou aumente a distância para ver mais bicos.', actionLabel: 'Limpar filtros', onAction: () => store.setUI(KEY, { tipo: null, dist: 'Toda a cidade', quando: null }) }) : null)
  );

  return h('div', { class: 'flex flex-col' },
    header,
    h('div', { class: 'px-4 sm:px-0 py-4 flex flex-col gap-5' }, searching ? searchResults : browseResults),

    Sheet({ open: ui.locationOpen, title: 'Onde você quer trabalhar', onClose: () => store.setUI(KEY, { locationOpen: false }) },
      Button({ label: 'Usar minha localização agora', variant: 'secondary', fullWidth: true, iconLeft: 'locate-fixed', onClick: () => store.setUI(KEY, { location: 'Tatuapé, SP', locationOpen: false }) }),
      h('div', { class: 'flex flex-col' }, ...LOCAIS_BAIRRO.concat(['Toda São Paulo']).map((l) => {
        const active = ui.location === l;
        const bairro = l.split(',')[0];
        const count = l === 'Toda São Paulo' ? openJobs.length : openJobs.filter((j) => j.location.indexOf(bairro) === 0).length;
        return h('button', {
          type: 'button', class: 'flex items-center gap-3 min-h-12 py-1 border-b border-concrete-200 last:border-0 text-left',
          onClick: () => store.setUI(KEY, { location: l, locationOpen: false })
        },
          Icon('map-pin', { size: 20, color: active ? 'var(--brand)' : 'var(--text-subtle)' }),
          h('span', { class: `flex-1 ${active ? 'font-bold text-brand-600' : 'text-concrete-900'}` }, l),
          h('span', { class: 'text-sm text-concrete-500' }, count === 1 ? '1 bico' : `${count} bicos`)
        );
      })),
      h('span', { class: 'text-xs text-concrete-500' }, 'A distância de cada bico é contada a partir daqui.')
    ),

    Sheet({ open: ui.filtersOpen, title: 'Filtros', onClose: () => store.setUI(KEY, { filtersOpen: false }) },
      filterGroup('Tipo de serviço', TIPOS_SERVICO, ui.tipo, (v) => store.setUI(KEY, { tipo: ui.tipo === v ? null : v })),
      filterGroup('Distância de casa', ['5', '10', '20', 'Toda a cidade'].map((d) => d === 'Toda a cidade' ? d : `Até ${d} km`), ui.dist, (v) => store.setUI(KEY, { dist: v })),
      filterGroup('Quando', ['Hoje', 'Amanhã', 'Esta semana', 'Fim de semana'], ui.quando, (v) => store.setUI(KEY, { quando: ui.quando === v ? null : v })),
      h('div', { class: 'flex flex-col gap-1 pt-1 border-t border-concrete-200' },
        Switch({ label: 'Avisar quando aparecer bico urgente', description: 'Chega uma notificação quando surgir vaga com esses filtros perto de você.', checked: ui.notifyUrgent, onChange: (v) => store.setUI(KEY, { notifyUrgent: v }) })
      ),
      h('div', { class: 'flex gap-3 pt-1' },
        Button({ label: 'Limpar', variant: 'secondary', className: 'flex-1', onClick: () => store.setUI(KEY, { tipo: null, dist: 'Toda a cidade', quando: null }) }),
        Button({ label: `Ver ${filtered.length === 1 ? '1 vaga' : filtered.length + ' vagas'}`, className: 'flex-[1.4]', onClick: () => store.setUI(KEY, { filtersOpen: false }) })
      )
    )
  );
}

function filterGroup(title, options, active, onSelect) {
  return h('div', { class: 'flex flex-col gap-2.5' },
    h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, title),
    h('div', { class: 'flex flex-wrap gap-2' }, ...options.map((o) => Tag({ label: o, selected: active === o, onClick: () => onSelect(o) })))
  );
}
