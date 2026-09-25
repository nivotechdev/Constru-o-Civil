import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Badge } from '../../components/Badge.js';
import { Button } from '../../components/Button.js';
import { PhotoSlot } from '../../components/PhotoSlot.js';
import { CandidateRow } from '../../components/CandidateRow.js';
import { EmptyState } from '../../components/EmptyState.js';
import { Dialog } from '../../components/Modal.js';
import { Icon } from '../../utils/icons.js';
import { formatBRL } from '../../utils/format.js';
import { goBack } from '../../router.js';
import { traduzirErroSupabase } from '../../utils/erros.js';
import * as store from '../../store.js';

const KEY = 'job-manage';

export default function renderJobManage(navigate, params) {
  store.ensureJobsLoaded();
  const job = store.getJob(params.id);
  if (!job) return h('div', { class: 'p-6 text-concrete-500' }, 'Vaga não encontrada.');
  store.ensureApplicationsForJobLoaded(job.id);

  if (job.companyId !== store.currentCompanyId()) {
    return h('div', { class: 'flex flex-col' },
      BackBar({ title: 'Sua vaga', onBack: () => goBack('/mural') }),
      EmptyState({
        icon: 'lock', title: 'Essa vaga não é sua',
        description: 'Só a construtora que publicou o bico pode ver os candidatos e a quantidade de vagas.'
      })
    );
  }

  const ui = store.getUI(KEY, { confirmClose: false, deciding: false, error: null, photoUploading: false });

  async function trocarFoto(objectUrl, file) {
    store.setUI(KEY, { photoUploading: true, error: null });
    try {
      const url = await store.uploadImage(file, 'vaga-' + job.id);
      await store.updateJob(job.id, { photo: url });
      store.setUI(KEY, { photoUploading: false });
    } catch (error) {
      store.setUI(KEY, { photoUploading: false, error: traduzirErroSupabase(error) });
    }
  }

  const applications = store.applicationsForJob(job.id);
  const slots = job.slots || 1;
  const approved = store.approvedCount(job.id);
  const pending = store.pendingCount(job.id);
  const closed = store.isJobClosed(job);
  const status = jobStatus(job, approved, pending);

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Sua vaga', onBack: () => goBack('/mural') }),
    h('div', { class: 'flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-6' },
      h('div', { class: 'flex flex-col gap-4' },
        h('div', { class: 'flex flex-col gap-1.5' },
          h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Foto da vaga'),
          PhotoSlot({ shape: 'rect', height: '9rem', placeholder: 'Toque para escolher uma foto do canteiro', value: job.photo, onChange: trocarFoto })
        ),
        h('div', { class: 'flex flex-col gap-1.5' },
          h('div', { class: 'flex items-center gap-2' }, Badge(status), h('span', { class: 'font-mono text-xs text-concrete-500' }, job.id)),
          h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, job.role),
          job.description ? h('p', { class: 'text-sm text-concrete-700 leading-relaxed' }, job.description) : null
        ),

        Card({ tone: 'brand', padding: 'md' },
          h('div', { class: 'flex flex-col gap-4' },
            h('div', { class: 'flex items-end justify-between gap-3' },
              h('div', { class: 'flex flex-col gap-0.5' }, h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-brand-600' }, 'Diária que você ofereceu'), h('span', { class: 'font-mono font-bold text-4xl text-concrete-900' }, job.pay == null ? 'A combinar' : formatBRL(job.pay))),
              h('span', { class: 'text-sm text-concrete-700 text-right' }, 'Pago no fim', h('br'), 'da diária')
            ),
            h('div', { class: 'flex items-center gap-2 pt-4 border-t border-brand-200' }, Icon('calendar', { size: 20, color: 'var(--text-brand)' }), h('span', { class: 'font-display font-semibold text-lg text-concrete-900' }, job.dateLong || job.date))
          )
        ),

        Card({ padding: 'md' },
          h('div', { class: 'flex flex-col gap-3' },
            h('div', { class: 'flex items-baseline justify-between gap-3' },
              h('span', { class: 'font-semibold text-concrete-900' }, `${approved} de ${slots} ${slots === 1 ? 'vaga preenchida' : 'vagas preenchidas'}`),
              h('span', { class: 'font-mono text-sm text-concrete-500' }, `${slots} no total`)
            ),
            h('div', { class: 'flex gap-1.5' }, ...Array.from({ length: slots }).map((_, i) => h('span', { class: `flex-1 h-2 rounded-full ${i < approved ? 'bg-brand-500' : 'bg-concrete-200'}` }))),
            h('span', { class: `text-sm ${closed ? 'text-success-500' : 'text-concrete-500'}` }, closed ? 'Bico fechado. A vaga saiu do mural e não recebe mais candidatura.' : 'Aprove candidatos até preencher todas as vagas. Aí o bico fecha sozinho.')
          )
        ),

        h('div', { class: 'flex flex-col gap-2' },
          h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Onde e como'),
          Card({ padding: 'md' },
            h('div', { class: 'flex flex-col gap-3.5' },
              infoRow('map-pin', job.address, job.location),
              infoRow('clock', job.hours, job.duration),
              infoRow('hand-coins', 'Pagamento em PIX no fim da diária', 'Combinado direto com o trabalhador')
            )
          )
        ),

        h('div', { class: 'flex flex-col gap-2' },
          h('div', { class: 'flex items-center justify-between gap-2' },
            h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, applications.length === 1 ? '1 candidato' : `${applications.length} candidatos`),
            pending ? h('span', { class: 'text-xs text-brand-600' }, `${pending} ${pending === 1 ? 'novo' : 'novos'}`) : null
          ),
          ui.error ? h('span', { class: 'text-sm text-danger-500' }, ui.error) : null,
          applications.length
            ? h('div', { class: 'bg-white border border-concrete-200 rounded-card shadow-card overflow-hidden' }, ...applications.map((a) => {
                const worker = store.getWorker(a.workerId);
                const decision = a.status === 'pre_selecionado' || a.status === 'contratado' ? 'aprovado' : a.status === 'nao_selecionado' ? 'recusado' : null;
                async function decidir(d) {
                  store.setUI(KEY, { deciding: true, error: null });
                  try {
                    await store.decideApplication(job.id, worker.id, d);
                    store.setUI(KEY, { deciding: false });
                    if (d === 'aprovado' && store.isJobClosed(store.getJob(job.id))) navigate('/fechado/' + job.id);
                  } catch (error) {
                    store.setUI(KEY, { deciding: false, error: traduzirErroSupabase(error) });
                  }
                }
                return CandidateRow({
                  worker, summary: worker.role + ' · ' + worker.region, distance: worker.distance, isNew: worker.novo, decision,
                  onClick: () => navigate(`/trabalhador/${worker.id}/${job.id}`),
                  onApprove: !decision && !closed && !ui.deciding ? (e) => { e.stopPropagation(); decidir('aprovado'); } : null,
                  onReject: !decision && !closed && !ui.deciding ? (e) => { e.stopPropagation(); decidir('recusado'); } : null
                });
              }))
            : EmptyState({ icon: 'users', title: 'Nenhum candidato ainda', description: 'Vagas com valor acima da média da região costumam receber candidato no mesmo dia. Você também pode impulsionar.', actionLabel: 'Impulsionar vaga', onAction: () => navigate('/impulsionar/' + job.id) })
        )
      ),
      h('div', {})
    ),
    !closed ? h('div', { class: 'sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex gap-3 lg:static lg:bg-transparent lg:shadow-none lg:max-w-app' },
      Button({ label: 'Editar vaga', variant: 'secondary', iconLeft: 'pencil', className: 'flex-1', onClick: () => {} }),
      Button({ label: 'Encerrar vaga', variant: 'ghost', className: 'flex-1', onClick: () => store.setUI(KEY, { confirmClose: true }) })
    ) : null,
    Dialog({
      open: ui.confirmClose, tone: 'danger', title: 'Encerrar essa vaga?',
      description: 'A vaga sai do mural imediatamente e para de receber candidaturas. Isso não pode ser desfeito.',
      confirmLabel: 'Encerrar vaga', onConfirm: async () => {
        store.setUI(KEY, { confirmClose: false });
        try { await store.closeJob(job.id); navigate('/mural'); }
        catch (error) { store.setUI(KEY, { error: traduzirErroSupabase(error) }); }
      },
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
