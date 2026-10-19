import { BackBar } from '../../components/BackBar';
import { EmptyState } from '../../components/EmptyState';
import { JobTile, TileGrid } from '../../components/JobTile';
import { QueryView } from '../../components/QueryView';
import { TileGridSkeleton } from '../../components/Skeleton';
import { useQuery } from '../../hooks/useQuery';
import { useDb } from '../../hooks/useStore';
import { goBack, navigate } from '../../services/router';
import { getCompany, isJobClosed, savedJobs } from '../../services/selectors';
import { toggleSaved } from '../../services/feedback';
import { loadSavedJobs } from '../../services/jobs';

export default function SavedJobs() {
  const db = useDb();
  const query = useQuery('saved', loadSavedJobs);
  const jobs = savedJobs(db);

  return (
    <div className="flex flex-col">
      <BackBar title="Vagas salvas" onBack={() => goBack('/minhas-candidaturas')} />
      <div className="flex flex-col gap-3 px-4 sm:px-0 py-4">
        <QueryView query={query} skeleton={<TileGridSkeleton count={4} />}>
          {() =>
            jobs.length === 0 ? (
              <EmptyState
                icon="bookmark"
                title="Você ainda não salvou nenhum bico"
                description="No mural, toque na bandeirinha de um bico para guardá-lo aqui e decidir depois."
                actionLabel="Ver o mural"
                onAction={() => navigate('/mural')}
              />
            ) : (
              <TileGrid>
                {jobs.map((job) => {
                  // Same tile as the mural; the flag removes it from here. A job that has since closed stays
                  // listed, greyed out, so the worker knows what happened to it.
                  const closed = isJobClosed(db, job);
                  return (
                    <JobTile
                      key={job.id}
                      job={job}
                      company={getCompany(db, job.companyId)}
                      onClick={() => navigate('/vaga/' + job.id)}
                      muted={closed}
                      footer={closed ? <span className="truncate text-concrete-500">Vaga encerrada</span> : null}
                      saved
                      onToggleSave={() => toggleSaved(job.id)}
                    />
                  );
                })}
              </TileGrid>
            )
          }
        </QueryView>
      </div>
    </div>
  );
}
