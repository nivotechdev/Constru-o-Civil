import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { Icon } from '../../../components/icons/Icon';
import { IconButton } from '../../../components/IconButton';
import { Logo } from '../../../components/Logo';
import { NotificationsPanel } from '../../../components/NotificationsPanel';
import { Rating } from '../../../components/Rating';
import { Tag } from '../../../components/Tag';
import { useNotifications } from '../../../hooks/useNotifications';
import { useUI } from '../../../hooks/useStore';
import { navigate } from '../../../services/router';
import { MENU_DEFAULTS, MENU_KEY, type MenuUI } from '../../../services/sharedUI';
import type { Database, Job, Role } from '../../../types/models';
import { FeedGrid, NoJobsState, SearchPill } from './FeedParts';
import { setFeed, SORTS, type ActiveFilter, type FeedUI, type SearchMatches } from './feedUI';

export interface FeedLayoutProps {
  db: Database;
  role: Role;
  ui: FeedUI;
  /** The jobs that pass the filters, in the chosen order. */
  ordered: Job[];
  /** What the search finds; `null` while nothing is typed. */
  found: SearchMatches | null;
  chips: ActiveFilter[];
}

/** The mural below 770px: search pill, filter chips, sort control and the grid of tiles. */
export function MobileFeed({ db, role, ui, ordered, found, chips }: FeedLayoutProps) {
  const noResults =
    found !== null && found.jobs.length === 0 && found.companies.length === 0 && found.workers.length === 0;
  const activeCount = chips.length;

  const searchResults = found ? (
    <div className="flex flex-col gap-5">
      {found.jobs.length ? (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Vagas</div>
          <FeedGrid db={db} role={role} jobs={found.jobs} />
        </div>
      ) : null}
      {found.companies.length ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Construtoras</div>
          {found.companies.map((c) => (
            <Card key={c.id} padding="md" onClick={() => navigate('/construtora/' + c.id)}>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0">
                  <Icon name="building-2" size={20} color="var(--brand)" />
                </span>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-semibold text-concrete-900 truncate">{c.name}</span>
                  <span className="text-sm text-concrete-500 truncate">{c.location}</span>
                </div>
                <Rating value={c.rating} count={c.reviewCount} />
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {found.workers.length ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Trabalhadores</div>
          {found.workers.map((w) => (
            <Card key={w.id} padding="md">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0">
                  {w.initials}
                </span>
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="font-semibold text-concrete-900 truncate">{w.name}</span>
                  <span className="text-sm text-concrete-500 truncate">{`${w.role} · ${w.region}`}</span>
                </div>
                <Rating value={w.rating} count={w.jobsDone} />
              </div>
            </Card>
          ))}
        </div>
      ) : null}
      {noResults ? (
        <EmptyState
          icon="search-x"
          title="Nenhum resultado para essa busca"
          description="Confira a grafia ou tente um termo mais curto."
          actionLabel="Limpar busca"
          onAction={() => setFeed({ search: '' })}
        />
      ) : null}
    </div>
  ) : null;

  const browseResults = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tag
          label={activeCount ? `Filtros · ${activeCount}` : 'Filtros'}
          icon="sliders-horizontal"
          onClick={() => setFeed({ filtersOpen: true })}
        />
        {chips.map((c) => (
          <Tag key={c.label + c.icon} label={c.label} icon={c.icon} selected onRemove={c.remove} />
        ))}
      </div>
      <div className="flex bg-concrete-100 rounded-full p-1 gap-1">
        {SORTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`flex-1 h-10 rounded-full text-sm font-bold transition-colors ${ui.sort === o.id ? 'bg-white text-brand-600 shadow-card' : 'text-concrete-500'}`}
            onClick={() => setFeed({ sort: o.id })}
          >
            {o.label}
          </button>
        ))}
      </div>
      {ordered.length ? <FeedGrid db={db} role={role} jobs={ordered} /> : <NoJobsState location={ui.location} />}
    </div>
  );

  return (
    <div className="flex flex-col lg:hidden">
      <div className="sticky top-0 z-20 flex flex-col gap-2 px-4 pt-2 pb-3.5 bg-white border-b border-concrete-200">
        <div className="flex items-center justify-between gap-2 min-h-12">
          <h1 className="inline-flex" aria-label="Bicos">
            <Logo compact />
          </h1>
          <MobileNotifications role={role} />
        </div>
        <SearchPill id="feed-search" role={role} search={ui.search} compact />
      </div>
      <div className="px-4 pt-4 pb-6">
        <div className="mural-frame flex flex-col gap-5">{searchResults ?? browseResults}</div>
      </div>
    </div>
  );
}

// The header bell and its panel, which opens across the top of the screen.
function MobileNotifications({ role }: { role: Role }) {
  const [menus, setMenus] = useUI<MenuUI>(MENU_KEY, MENU_DEFAULTS);
  const { list, unread, markAllRead } = useNotifications(role);
  return (
    <>
      <IconButton
        icon="bell"
        label="Notificações"
        onClick={() => setMenus({ notificationsOpen: !menus.notificationsOpen })}
        badge={unread > 0 ? unread : null}
      />
      {menus.notificationsOpen ? (
        <NotificationsPanel
          list={list}
          unread={unread}
          onMarkAllRead={markAllRead}
          onSeeAll={() => {
            setMenus({ notificationsOpen: false });
            navigate('/notificacoes');
          }}
          onClose={() => setMenus({ notificationsOpen: false })}
          className="fixed left-3 right-3 top-[4.25rem] sm:left-auto sm:w-[24rem]"
        />
      ) : null}
    </>
  );
}
