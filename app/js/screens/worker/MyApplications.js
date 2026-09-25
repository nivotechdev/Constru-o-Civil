import { h } from '../../dom.js';
import { Card } from '../../components/Card.js';
import { Badge } from '../../components/Badge.js';
import { JobCard, JobCardFooter } from '../../components/JobCard.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Icon } from '../../utils/icons.js';
import { statusInfo, IN_PROGRESS, CLOSED } from '../../utils/applicationStatus.js';
import * as store from '../../store.js';

export default function renderMyApplications(navigate) {
  store.ensureMyApplicationsLoaded();
  store.ensureJobsLoaded();
  store.ensureSavedJobsLoaded();
  const worker = store.currentWorker();
  const apps = store.applicationsForWorker(worker.id);
  const inProgress = apps.filter((a) => IN_PROGRESS.has(a.status));
  const closed = apps.filter((a) => CLOSED.has(a.status));
  const savedCount = store.savedJobs().length;

  function appCard(app, muted) {
    const job = store.getJob(app.jobId);
    if (!job) return null;
    const company = store.getCompany(job.companyId);
    const info = statusInfo(app.status, job.id);
    return JobCard({
      job, companyName: company.name, muted, onClick: () => navigate(info.to),
      footer: JobCardFooter({ badgeEl: Badge({ label: info.label, tone: muted ? 'neutral' : info.tone, icon: info.icon }), hint: info.hint, hintColor: muted ? 'var(--text-muted)' : 'var(--text-brand)' })
    });
  }

  return h('div', { class: 'flex flex-col' },
    h('div', { class: 'sticky top-0 z-20 flex items-center justify-between min-h-14 px-4 sm:px-0 bg-white border-b border-concrete-200 lg:static lg:border-0' },
      h('h1', { class: 'font-display font-semibold text-xl text-concrete-900' }, 'Minhas candidaturas'),
      h('span', { class: 'text-sm text-concrete-500' }, apps.length === 1 ? '1 no total' : `${apps.length} no total`)
    ),
    h('div', { class: 'flex flex-col gap-3 px-4 sm:px-0 py-4' },
      Card({ padding: 'sm', onClick: () => navigate('/vagas-salvas') },
        h('div', { class: 'flex items-center gap-3' },
          h('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0' }, Icon('bookmark', { size: 20, color: 'var(--brand)' })),
          h('div', { class: 'flex-1 min-w-0 flex flex-col' },
            h('span', { class: 'font-semibold text-concrete-900' }, 'Vagas salvas'),
            h('span', { class: 'text-sm text-concrete-500' }, savedCount === 0 ? 'Nenhum bico guardado' : savedCount === 1 ? '1 bico guardado' : `${savedCount} bicos guardados`)
          ),
          Icon('chevron-right', { size: 20, color: 'var(--gray-400)' })
        )
      ),

      apps.length === 0 ? EmptyState({ icon: 'file-check', title: 'Você ainda não se candidatou', description: 'Escolha um bico no mural e toque em quero esse bico. Fica tudo registrado aqui.', actionLabel: 'Ver o mural', onAction: () => navigate('/mural') }) : h('div', { class: 'flex flex-col gap-5' },
        inProgress.length ? h('div', { class: 'flex flex-col gap-3' },
          h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Em andamento'),
          h('div', { class: 'flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5' }, ...inProgress.map((a) => appCard(a, false)))
        ) : null,
        closed.length ? h('div', { class: 'flex flex-col gap-3' },
          h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Encerradas'),
          h('div', { class: 'flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5' }, ...closed.map((a) => appCard(a, true)))
        ) : null
      )
    )
  );
}
