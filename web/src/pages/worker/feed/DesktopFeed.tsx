import { Button } from '../../../components/Button';
import { Icon } from '../../../components/icons/Icon';
import { QueryView } from '../../../components/QueryView';
import { TileGridSkeleton } from '../../../components/Skeleton';
import { Tag } from '../../../components/Tag';
import type { Database, Role } from '../../../types/models';
import { cx } from '../../../utils/cx';
import { FeedGrid, LoadMore, NoJobsState, NoSearchResults, SearchPill, SearchScope } from './FeedParts';
import { noFilters, setFeed, type SearchMatches } from './feedUI';
import type { FeedLayoutProps } from './MobileFeed';

/** The mural from 770px up (tablet and desktop): a wide search bar, the filters button and the grid. */
export function DesktopFeed({ db, role, ui, ordered, found, chips, query, home, paging }: FeedLayoutProps) {
  const count = chips.length;
  const browse = (
    <div className="flex flex-col gap-6">
      {chips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-concrete-500">
            {ordered.length === 1 ? '1 vaga com' : `${ordered.length} vagas com`}
          </span>
          {chips.map((c) => (
            <Tag key={c.label + c.icon} label={c.label} icon={c.icon} selected onRemove={c.remove} />
          ))}
          <Button label="Limpar filtros" variant="ghost" size="sm" onClick={() => setFeed(noFilters(home))} />
        </div>
      ) : null}
      {ordered.length ? (
        <>
          <FeedGrid db={db} role={role} jobs={ordered} />
          <LoadMore paging={paging} />
        </>
      ) : (
        <NoJobsState location={ui.location} home={home} />
      )}
    </div>
  );

  return (
    <div className="hidden lg:block min-h-[calc(100vh-5rem)] bg-concrete-0">
      <div className="page-x pt-1 pb-8 border-b border-concrete-200">
        <div className="max-w-[60rem] mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <SearchPill id="feed-search-desktop" search={ui.search} />
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            className={cx(
              'relative shrink-0 inline-flex items-center gap-2.5 h-[4.25rem] px-6 rounded-full bg-concrete-0 border shadow-float font-semibold text-concrete-900 transition hover:border-concrete-300 hover:shadow-raised',
              count ? 'border-brand-500' : 'border-concrete-200'
            )}
            onClick={() => setFeed({ filtersOpen: true })}
          >
            <Icon name="sliders-horizontal" size={20} />
            Filtros
            {count ? (
              <span className="inline-flex items-center justify-center min-w-[1.375rem] h-[1.375rem] px-1.5 rounded-full bg-brand-500 text-white text-xs font-bold">
                {String(count)}
              </span>
            ) : null}
          </button>
        </div>
      </div>
      <div className="page-x pt-8 pb-20">
        <div className="mural-frame">
          <QueryView query={query} skeleton={<TileGridSkeleton count={8} />}>
            {() =>
              found ? (
                <div className="flex flex-col gap-4">
                  <SearchResults
                    db={db}
                    role={role}
                    search={ui.search}
                    found={found}
                    location={ui.location}
                    allCities={ui.allCities}
                  />
                  <SearchScope location={ui.location} allCities={ui.allCities} />
                </div>
              ) : (
                browse
              )
            }
          </QueryView>
        </div>
      </div>
    </div>
  );
}

interface SearchResultsProps {
  db: Database;
  role: Role;
  search: string;
  found: SearchMatches;
  location: string;
  allCities: boolean;
}

function SearchResults({ db, role, search, found, location, allCities }: SearchResultsProps) {
  const { jobs } = found;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-[1.75rem] font-semibold leading-tight text-concrete-900">{`Resultados para “${search.trim()}”`}</h1>
        {jobs.length ? (
          <span className="text-concrete-500" role="status">
            {jobs.length === 1 ? '1 vaga' : `${jobs.length} vagas`}
          </span>
        ) : null}
      </div>
      {jobs.length ? (
        <FeedGrid db={db} role={role} jobs={jobs} />
      ) : (
        <NoSearchResults search={search} location={location} allCities={allCities} />
      )}
    </div>
  );
}
