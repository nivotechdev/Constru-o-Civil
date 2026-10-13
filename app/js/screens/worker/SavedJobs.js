import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { JobTile, TileGrid } from '../../components/JobTile.js';
import { EmptyState } from '../../components/EmptyState.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';

export default function renderSavedJobs(navigate) {
  const jobs = store.savedJobs();

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Vagas salvas', onBack: () => goBack('/minhas-candidaturas') }),
    h('div', { class: 'flex flex-col gap-3 px-4 sm:px-0 py-4' },
      jobs.length === 0
        ? EmptyState({ icon: 'bookmark', title: 'Você ainda não salvou nenhum bico', description: 'No mural, toque na bandeirinha de um bico para guardá-lo aqui e decidir depois.', actionLabel: 'Ver o mural', onAction: () => navigate('/mural') })
        : TileGrid(jobs.map((job) => {
            // Same tile as the mural; the flag removes it from here. A job that has since
            // closed stays listed, greyed out, so the worker knows what happened to it.
            const closed = store.isJobClosed(job);
            return JobTile({
              job, company: store.getCompany(job.companyId), onClick: () => navigate('/vaga/' + job.id),
              muted: closed, badge: closed ? { label: 'Vaga encerrada', icon: 'circle-x', tone: 'neutral' } : null,
              saved: true, onToggleSave: () => store.toggleSavedJob(job.id)
            });
          }))
    )
  );
}
