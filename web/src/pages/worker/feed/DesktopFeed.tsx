import type { ReactNode } from 'react';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Icon } from '../../../components/icons/Icon';
import { Rating } from '../../../components/Rating';
import { Tag } from '../../../components/Tag';
import { navigate } from '../../../services/router';
import type { Database, Role } from '../../../types/models';
import { cx } from '../../../utils/cx';
import { FeedGrid, NoJobsState, SearchPill } from './FeedParts';
import { NO_FILTERS, setFeed, type SearchMatches } from './feedUI';
import type { FeedLayoutProps } from './MobileFeed';

/** The mural from 770px up (tablet and desktop): a wide search bar, the filters button and the grid. */
export function DesktopFeed({ db, role, ui, ordered, found, chips }: FeedLayoutProps) {
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
          <Button label="Limpar filtros" variant="ghost" size="sm" onClick={() => setFeed(NO_FILTERS)} />
        </div>
      ) : null}
      {ordered.length ? <FeedGrid db={db} role={role} jobs={ordered} /> : <NoJobsState location={ui.location} />}
    </div>
  );

  return (
    <div className="hidden lg:block min-h-[calc(100vh-5rem)] bg-white">
      <div className="page-x pt-1 pb-8 border-b border-concrete-200">
        <div className="max-w-[60rem] mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <SearchPill id="feed-search-desktop" role={role} search={ui.search} />
          </div>
          <button
            type="button"
            aria-haspopup="dialog"
            className={cx(
              'relative shrink-0 inline-flex items-center gap-2.5 h-[4.25rem] px-6 rounded-full bg-white border shadow-float font-semibold text-concrete-900 transition hover:border-concrete-300 hover:shadow-raised',
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
          {found ? <SearchResults db={db} role={role} search={ui.search} found={found} /> : browse}
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
}

function SearchResults({ db, role, search, found }: SearchResultsProps) {
  const { jobs, companies, workers } = found;
  const parts = [
    jobs.length ? (jobs.length === 1 ? '1 vaga' : `${jobs.length} vagas`) : null,
    companies.length ? (companies.length === 1 ? '1 construtora' : `${companies.length} construtoras`) : null,
    workers.length ? (workers.length === 1 ? '1 trabalhador' : `${workers.length} trabalhadores`) : null
  ].filter(Boolean);

  const heading = (
    <div className="flex items-baseline gap-3 flex-wrap">
      <h1 className="text-[1.75rem] font-semibold leading-tight text-concrete-900">{`Resultados para “${search.trim()}”`}</h1>
      {parts.length ? <span className="text-concrete-500">{parts.join(' · ')}</span> : null}
    </div>
  );

  if (!parts.length) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <EmptyState
          icon="search-x"
          title="Nenhum resultado para essa busca"
          description="Confira a grafia ou tente um termo mais curto, como o nome do serviço ou do bairro."
          actionLabel="Limpar busca"
          onAction={() => setFeed({ search: '' })}
        />
      </div>
    );
  }

  const group = (title: string, content: ReactNode) => (
    <section className="flex flex-col gap-4">
      <h2 className="text-[1.375rem] font-semibold text-concrete-900">{title}</h2>
      {content}
    </section>
  );

  return (
    <div className="flex flex-col gap-12">
      {heading}
      {jobs.length ? group('Vagas', <FeedGrid db={db} role={role} jobs={jobs} />) : null}
      {companies.length
        ? group(
            'Construtoras',
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]">
              {companies.map((c) => (
                <PersonCard
                  key={c.id}
                  avatar={
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 shrink-0">
                      <Icon name="building-2" size={22} color="var(--brand)" />
                    </span>
                  }
                  name={c.name}
                  meta={c.location}
                  rating={<Rating value={c.rating} count={c.reviewCount} />}
                  onClick={() => navigate('/construtora/' + c.id)}
                />
              ))}
            </div>
          )
        : null}
      {workers.length
        ? group(
            'Trabalhadores',
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(17rem,1fr))]">
              {workers.map((w) => (
                <PersonCard
                  key={w.id}
                  avatar={
                    <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold shrink-0">
                      {w.initials}
                    </span>
                  }
                  name={w.name}
                  meta={`${w.role} · ${w.region}`}
                  rating={<Rating value={w.rating} count={w.jobsDone} />}
                  onClick={role === 'recrutador' ? () => navigate('/trabalhador/' + w.id) : null}
                />
              ))}
            </div>
          )
        : null}
    </div>
  );
}

interface PersonCardProps {
  avatar: ReactNode;
  name: string;
  meta: string;
  rating: ReactNode;
  onClick: (() => void) | null;
}

function PersonCard({ avatar, name, meta, rating, onClick }: PersonCardProps) {
  const className = cx(
    'flex items-center gap-4 p-4 rounded-2xl border border-concrete-200 bg-white text-left',
    onClick ? 'transition hover:shadow-raised hover:border-concrete-300' : ''
  );
  const content = (
    <>
      {avatar}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="font-semibold text-concrete-900 truncate">{name}</span>
        <span className="text-sm text-concrete-500 truncate">{meta}</span>
        {rating}
      </div>
    </>
  );
  return onClick ? (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
