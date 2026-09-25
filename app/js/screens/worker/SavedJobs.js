import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { IconButton } from '../../components/IconButton.js';
import { JobCard, JobCardFooter } from '../../components/JobCard.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Icon } from '../../utils/icons.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';

export default function renderSavedJobs(navigate) {
  store.ensureJobsLoaded();
  store.ensureSavedJobsLoaded();
  const jobs = store.savedJobs();

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Vagas salvas', onBack: () => goBack('/minhas-candidaturas') }),
    h('div', { class: 'flex flex-col gap-3 px-4 sm:px-0 py-4' },
      jobs.length === 0
        ? EmptyState({ icon: 'bookmark', title: 'Você ainda não salvou nenhum bico', description: 'No mural, toque no ícone de salvar em um bico para guardá-lo aqui e decidir depois.', actionLabel: 'Ver o mural', onAction: () => navigate('/mural') })
        : h('div', { class: 'flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5' }, ...jobs.map((job) => {
            const company = store.getCompany(job.companyId);
            const available = !store.isJobClosed(job);
            return JobCard({
              job, companyName: company.name, onClick: () => navigate('/vaga/' + job.id),
              overlay: h('div', { class: 'absolute top-2.5 right-2.5', onClick: (e) => e.stopPropagation() },
                IconButton({ icon: 'bookmark-x', label: 'Remover dos salvos', variant: 'solid', onClick: () => store.toggleSavedJob(job.id) })
              ),
              footer: JobCardFooter({
                extra: h('span', { class: `flex items-center gap-2 text-sm font-semibold ${available ? 'text-success-500' : 'text-concrete-500'}` },
                  Icon(available ? 'circle-check' : 'circle-x', { size: 16, color: available ? 'var(--green-500)' : 'var(--text-muted)' }),
                  available ? 'Ainda disponível' : 'Não está mais disponível'
                )
              })
            });
          }))
    )
  );
}
