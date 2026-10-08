// Pieces shared by the phone and the desktop mural: the grid of job tiles, its empty state and the
// search field.
import { memo, useRef } from 'react';
import { EmptyState } from '../../../components/EmptyState';
import { Icon } from '../../../components/icons/Icon';
import { JobTile } from '../../../components/JobTile';
import { navigate } from '../../../services/router';
import { getCompany, isJobSaved, isMine } from '../../../services/selectors';
import { toggleSavedJob } from '../../../services/store';
import type { Company, Database, Job, Role } from '../../../types/models';
import { cx } from '../../../utils/cx';
import { DEFAULT_CITY, NO_FILTERS, setFeed, type FeedUI } from './feedUI';

interface FeedTileProps {
  job: Job;
  company: Company | undefined;
  role: Role;
  saved: boolean;
}

// Memoized: typing in the search or opening a sheet re-renders the mural, but a tile only when its
// own job, company or saved flag changed.
const FeedTile = memo(function FeedTile({ job, company, role, saved }: FeedTileProps) {
  const mine = role === 'recrutador' && isMine(job);
  return (
    <JobTile
      job={job}
      company={company}
      onClick={() => navigate(mine ? '/vaga-gerenciar/' + job.id : '/vaga/' + job.id)}
      mine={mine}
      saved={saved}
      onToggleSave={role === 'trabalhador' ? () => toggleSavedJob(job.id) : null}
    />
  );
});

/** The mural's one grid of job tiles. */
export function FeedGrid({ db, role, jobs }: { db: Database; role: Role; jobs: Job[] }) {
  return (
    <div className="tile-grid">
      {jobs.map((job) => (
        <FeedTile
          key={job.id}
          job={job}
          company={getCompany(db, job.companyId)}
          role={role}
          saved={isJobSaved(db, job.id)}
        />
      ))}
    </div>
  );
}

export function NoJobsState({ location }: { location: string }) {
  if (location !== DEFAULT_CITY) {
    return (
      <EmptyState
        icon="map-pin"
        title={`Ainda não tem bico em ${location.split(',')[0]}`}
        description="Assim que uma construtora publicar uma vaga nessa cidade, ela aparece aqui."
        actionLabel={`Ver bicos em ${DEFAULT_CITY.split(',')[0]}`}
        onAction={() => setFeed({ location: DEFAULT_CITY })}
      />
    );
  }
  return (
    <EmptyState
      icon="search-x"
      title="Nenhuma vaga com esse filtro"
      description="Tire um filtro ou aumente a distância para ver mais bicos."
      actionLabel="Limpar filtros"
      onAction={() => setFeed(NO_FILTERS)}
    />
  );
}

interface SearchPillProps {
  id: string;
  role: Role;
  search: FeedUI['search'];
  compact?: boolean;
}

// Search field shared by the phone and desktop murals: a pill with the blue search button on the left
// and no visible label (the placeholder says what can be searched).
export function SearchPill({ id, role, search, compact = false }: SearchPillProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      role="search"
      className={cx(
        'flex items-center rounded-full bg-white border border-concrete-200 shadow-float transition focus-within:border-brand-300 focus-within:ring-4 focus-within:ring-brand-100',
        compact ? 'gap-3 h-14 pl-1.5 pr-2' : 'gap-4 h-[4.25rem] pl-2 pr-3'
      )}
    >
      <button
        type="button"
        aria-label="Buscar"
        title="Buscar"
        className={cx(
          'shrink-0 inline-flex items-center justify-center rounded-full bg-brand-500 shadow-raised transition hover:bg-brand-600 active:scale-95',
          compact ? 'w-11 h-11' : 'w-[3.25rem] h-[3.25rem]'
        )}
        onClick={() => inputRef.current?.focus()}
      >
        <Icon name="search" size={compact ? 20 : 22} color="#fff" />
      </button>
      <div className="flex-1 min-w-0 flex items-center">
        <input
          ref={inputRef}
          id={id}
          data-focus-id={id}
          type="search"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="Buscar bicos"
          placeholder={
            role === 'recrutador'
              ? 'Buscar vaga, construtora ou trabalhador'
              : 'Buscar por serviço, bairro ou construtora'
          }
          value={search}
          className={cx(
            'w-full min-w-0 bg-transparent outline-none text-concrete-900 placeholder:text-concrete-500 [&::-webkit-search-cancel-button]:hidden',
            compact ? 'text-[0.9375rem]' : 'text-base'
          )}
          onChange={(e) => setFeed({ search: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setFeed({ search: '' });
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </div>
      {search ? (
        <button
          type="button"
          aria-label="Limpar busca"
          title="Limpar busca"
          className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-concrete-500 transition-colors hover:bg-concrete-100 hover:text-concrete-900"
          onClick={() => setFeed({ search: '' })}
        >
          <Icon name="x" size={18} />
        </button>
      ) : null}
    </div>
  );
}
