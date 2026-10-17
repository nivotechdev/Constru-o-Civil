import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Badge } from '../../components/Badge.js';
import { Button } from '../../components/Button.js';
import { PhotoManager } from '../../components/PhotoCarousel.js';
import { jobPhotos } from '../../components/JobCover.js';
import { CandidateRow } from '../../components/CandidateRow.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Dialog } from '../../components/Modal.js';
import { Icon } from '../../utils/icons.js';
import { formatBRL } from '../../utils/format.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';
import { whenText, hoursText, diasInfo } from '../../utils/jobInfo.js';

const KEY = 'job-manage';

export default function renderJobManage(navigate, params) {
  const job = store.getJob(params.id);
  if (!job) return h('div', { class: 'p-6 text-concrete-500' }, 'Vaga não encontrada.');

  if (job.companyId !== store.currentCompanyId()) {
    return h('div', { class: 'flex flex-col' },
      BackBar({ title: 'Sua vaga', onBack: () => goBack('/mural') }),
      EmptyState({
        icon: 'lock', title: 'Essa vaga não é sua',
        description: 'Só a construtora que publicou o bico pode ver os candidatos e a quantidade de vagas.'
      })
    );
  }

  const ui = store.getUI(KEY, { confirmClose: false });

  const applications = store.applicationsForJob(job.id);
  const slots = job.slots || 1;
  const approved = store.approvedCount(job.id);
  const pending = store.pendingCount(job.id);
  const closed = store.isJobClosed(job);
  const status = jobStatus(job, approved, pending);

  // Pay, headcount and actions are built fresh for each placement: in the page flow on
  // phones, and in the sticky side card on tablet/desktop.
  const payCard = (className) => Card({ tone: 'brand', padding: 'md', className },
    h('div', { class: 'flex flex-col gap-4' },
      h('div', { class: 'flex items-end justify-between gap-3' },
        h('div', { class: 'flex flex-col gap-0.5' }, h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-brand-600' }, 'Diária que você ofereceu'), h('span', { class: 'font-mono font-bold text-4xl text-concrete-900' }, job.pay == null ? 'A combinar' : formatBRL(job.pay))),
        h('span', { class: 'text-sm text-concrete-700 text-right' }, 'Pago no fim', h('br'), 'da diária')
      ),
      h('div', { class: 'flex items-center gap-2 pt-4 border-t border-brand-200' }, Icon('calendar', { size: 20, color: 'var(--text-brand)' }), h('span', { class: 'font-display font-semibold text-lg text-concrete-900' }, whenText(job)))
    )
  );
  const slotsCard = (className) => Card({ padding: 'md', className },
    h('div', { class: 'flex flex-col gap-3' },
      h('div', { class: 'flex items-baseline justify-between gap-3' },
        h('span', { class: 'font-semibold text-concrete-900' }, `${approved} de ${slots} ${slots === 1 ? 'vaga preenchida' : 'vagas preenchidas'}`),
        h('span', { class: 'font-mono text-sm text-concrete-500' }, `${slots} no total`)
      ),
      h('div', { class: 'flex gap-1.5' }, ...Array.from({ length: slots }).map((_, i) => h('span', { class: `flex-1 h-2 rounded-full ${i < approved ? 'bg-brand-500' : 'bg-concrete-200'}` }))),
      h('span', { class: `text-sm ${closed ? 'text-success-500' : 'text-concrete-500'}` }, closed ? 'Bico fechado. A vaga saiu do mural e não recebe mais candidatura.' : 'Aprove candidatos até preencher todas as vagas. Aí o bico fecha sozinho.')
    )
  );
  const actions = () => [
    Button({ label: 'Editar vaga', variant: 'secondary', iconLeft: 'pencil', className: 'flex-1', onClick: () => {} }),
    Button({ label: 'Encerrar vaga', variant: 'ghost', className: 'flex-1', onClick: () => store.setUI(KEY, { confirmClose: true }) })
  ];

  const side = h('aside', { class: 'hidden lg:flex lg:flex-col lg:gap-4 lg:sticky lg:top-28' },
    payCard(),
    slotsCard(),
    !closed ? h('div', { class: 'flex gap-3' }, ...actions()) : null
  );

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Sua vaga', onBack: () => goBack('/mural') }),
    h('div', { class: 'flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10' },
      h('div', { class: 'flex flex-col gap-4 lg:gap-6' },
        h('div', { class: 'flex flex-col gap-1.5' },
          h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Fotos da vaga'),
          PhotoManager({ photos: jobPhotos(job), onChange: (photos) => store.updateJob(job.id, { photos }) }),
          h('span', { class: 'text-xs text-concrete-500' }, 'Até 6 fotos. A primeira é a capa do bico no mural.')
        ),
        h('div', { class: 'flex flex-col gap-1.5' },
          h('div', { class: 'flex items-center gap-2' }, Badge(status), h('span', { class: 'font-mono text-xs text-concrete-500' }, job.id)),
          h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, job.role),
          job.description ? h('p', { class: 'text-sm text-concrete-700 leading-relaxed' }, job.description) : null
        ),

        payCard('lg:hidden'),
        slotsCard('lg:hidden'),

        h('div', { class: 'flex flex-col gap-2' },
          h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Onde e como'),
          Card({ padding: 'md' },
            h('div', { class: 'flex flex-col gap-3.5' },
              infoRow('map-pin', job.address, job.location),
              diasInfo(job) ? infoRow('calendar-days', diasInfo(job).label, diasInfo(job).hint) : null,
              infoRow('clock', hoursText(job), job.duration),
              infoRow('hand-coins', 'Pagamento em PIX no fim da diária', 'Combinado direto com o trabalhador')
            )
          )
        ),

        h('div', { class: 'flex flex-col gap-2' },
          h('div', { class: 'flex items-center justify-between gap-2' },
            h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, applications.length === 1 ? '1 candidato' : `${applications.length} candidatos`),
            pending ? h('span', { class: 'text-xs text-brand-600' }, `${pending} ${pending === 1 ? 'novo' : 'novos'}`) : null
          ),
          applications.length
            ? h('div', { class: 'bg-white border border-concrete-200 rounded-card shadow-card overflow-hidden' }, ...applications.map((a) => {
                const worker = store.getWorker(a.workerId);
                const decision = a.status === 'pre_selecionado' || a.status === 'contratado' ? 'aprovado' : a.status === 'nao_selecionado' ? 'recusado' : null;
                return CandidateRow({
                  worker, summary: worker.role + ' · ' + worker.region, distance: worker.distance, isNew: worker.novo, decision,
                  onClick: () => navigate(`/trabalhador/${worker.id}/${job.id}`),
                  onApprove: !decision && !closed ? (e) => { e.stopPropagation(); store.decideApplication(job.id, worker.id, 'aprovado'); if (store.isJobClosed(job)) navigate('/fechado/' + job.id); } : null,
                  onReject: !decision && !closed ? (e) => { e.stopPropagation(); store.decideApplication(job.id, worker.id, 'recusado'); } : null
                });
              }))
            : EmptyState({ icon: 'users', title: 'Nenhum candidato ainda', description: 'Vagas com valor acima da média da região costumam receber candidato no mesmo dia. Você também pode impulsionar.', actionLabel: 'Impulsionar vaga', onAction: () => navigate('/impulsionar/' + job.id) })
        )
      ),
      side
    ),
    !closed ? h('div', { class: 'sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex gap-3 lg:hidden' }, ...actions()) : null,
    Dialog({
      open: ui.confirmClose, tone: 'danger', title: 'Encerrar essa vaga?',
      description: 'A vaga sai do mural imediatamente e para de receber candidaturas. Isso não pode ser desfeito.',
      confirmLabel: 'Encerrar vaga', onConfirm: () => { store.closeJob(job.id); store.setUI(KEY, { confirmClose: false }); navigate('/mural'); },
      cancelLabel: 'Cancelar', onCancel: () => store.setUI(KEY, { confirmClose: false })
    })
  );
}

function jobStatus(job, approved, pending) {
  if (job.closed && job.semContratacao) return { label: 'Encerrada sem contratação', tone: 'danger', icon: 'circle-x' };
  if (store.isJobClosed(job)) return { label: `Bico fechado · ${approved} de ${job.slots || 1}`, tone: 'success', icon: 'circle-check' };
  if (pending) return { label: pending === 1 ? '1 aguardando análise' : `${pending} aguardando análise`, tone: 'warning', icon: 'clock' };
  const total = store.applicationsForJob(job.id).length;
  if (total) return { label: total === 1 ? '1 candidato' : `${total} candidatos`, tone: 'brand', icon: 'users' };
  return { label: 'Sem candidatos ainda', tone: 'neutral', icon: 'search-x' };
}

function infoRow(icon, main, sub) {
  return h('div', { class: 'flex gap-3 items-start' },
    Icon(icon, { size: 20, color: 'var(--text-subtle)' }),
    h('div', { class: 'flex flex-col' }, h('span', { class: 'font-semibold text-concrete-900' }, main), h('span', { class: 'text-sm text-concrete-500' }, sub))
  );
}
