import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Badge } from '../../components/Badge.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Icon } from '../../utils/icons.js';
import { formatBRL } from '../../utils/format.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';
import { dateText } from '../../utils/jobInfo.js';

const STATUS = {
  concluida: { label: 'Avaliar o trabalhador', tone: 'accent', icon: 'star', hint: 'Avaliar' },
  avaliada: { label: 'Diária concluída', tone: 'success', icon: 'circle-check', hint: 'Ver o bico' },
  contratado: { label: 'Diária concluída', tone: 'success', icon: 'circle-check', hint: 'Ver o bico' }
};

export default function renderHistory(navigate) {
  const companyId = store.currentCompanyId();
  const items = store.allJobs()
    .filter((j) => j.companyId === companyId && j.closed)
    .flatMap((job) => store.applicationsForJob(job.id).filter((a) => STATUS[a.status]).map((a) => ({ job, app: a, worker: store.getWorker(a.workerId) })))
    .filter((x) => x.worker);

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Bicos fechados', onBack: () => goBack('/empresa') }),
    h('div', { class: 'flex flex-col gap-3 px-4 sm:px-0 py-4' },
      items.length === 0
        ? EmptyState({ icon: 'file-check', title: 'Nenhuma vaga encerrada', description: 'Quando você fechar ou encerrar um bico, ele fica guardado aqui.', actionLabel: 'Ver vagas abertas', onAction: () => navigate('/mural') })
        : h('div', { class: 'flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-5' }, ...items.map(({ job, app, worker }) => {
            const s = STATUS[app.status];
            return Card({ padding: 'sm', onClick: () => navigate('/vaga-gerenciar/' + job.id) },
              h('div', { class: 'flex flex-col gap-3' },
                h('div', { class: 'flex items-center gap-3' },
                  h('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0' }, worker.initials),
                  h('div', { class: 'flex-1 min-w-0 flex flex-col' }, h('span', { class: 'font-semibold text-concrete-900 truncate' }, worker.name), h('span', { class: 'text-sm text-concrete-500 truncate' }, `${job.role} · ${dateText(job)}`)),
                  h('span', { class: 'font-mono font-bold text-lg text-concrete-900 shrink-0' }, job.pay == null ? 'A combinar' : formatBRL(job.pay))
                ),
                h('div', { class: 'flex items-center justify-between gap-2 pt-3 border-t border-concrete-200' },
                  Badge({ label: s.label, tone: s.tone, icon: s.icon }),
                  h('span', { class: 'inline-flex items-center gap-0.5 text-sm font-semibold text-brand-600' }, s.hint, Icon('chevron-right', { size: 16, color: 'var(--text-brand)' }))
                )
              )
            );
          }))
    )
  );
}
