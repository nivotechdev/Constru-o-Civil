import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Rating } from '../../components/Rating.js';
import { Button } from '../../components/Button.js';
import { Dialog } from '../../components/Modal.js';
import { PhotoCarousel } from '../../components/PhotoCarousel.js';
import { Icon } from '../../utils/icons.js';
import { formatBRL } from '../../utils/format.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';
import { whenText, hoursText, diasInfo } from '../../utils/jobInfo.js';

const KEY = 'job-detail';

export default function renderJobDetail(navigate, params) {
  const job = store.getJob(params.id);
  if (!job) return notFound(navigate);
  const company = store.getCompany(job.companyId);
  const role = store.getRole();
  const worker = store.currentWorker();
  const application = role === 'trabalhador' ? store.applicationFor(job.id, worker.id) : null;
  const canCancel = application && (application.status === 'enviada' || application.status === 'em_analise');
  const ui = store.getUI(KEY, { confirmCancel: false });

  // Built fresh for each placement: the phone's sticky bottom bar and the desktop summary card.
  const actions = () => role === 'trabalhador' ? [
    application
      ? (canCancel
          ? Button({ label: 'Cancelar candidatura', size: 'lg', fullWidth: true, variant: 'secondary', onClick: () => store.setUI(KEY, { confirmCancel: true }) })
          : Button({ label: 'Ver minhas candidaturas', size: 'lg', fullWidth: true, variant: 'secondary', onClick: () => navigate('/minhas-candidaturas') }))
      : Button({ label: 'Quero esse bico', size: 'lg', fullWidth: true, onClick: () => navigate('/confirmar/' + job.id) }),
    !application ? h('span', { class: 'text-center text-xs text-concrete-500' }, 'Você não paga nada para se candidatar') : null
  ] : [];

  const summary = h('aside', { class: 'hidden lg:block lg:sticky lg:top-28' },
    h('div', { class: 'flex flex-col gap-5 p-6 bg-white rounded-2xl border border-concrete-200 shadow-float' },
      h('div', { class: 'flex flex-col gap-1' },
        h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-brand-600' }, 'Diária'),
        h('div', { class: 'flex items-baseline gap-2' },
          h('span', { class: 'font-mono font-bold text-3xl text-concrete-900' }, job.pay == null ? 'A combinar' : formatBRL(job.pay)),
          job.pay == null ? null : h('span', { class: 'text-concrete-500' }, 'por dia')
        )
      ),
      h('div', { class: 'flex flex-col rounded-xl border border-concrete-200 divide-y divide-concrete-200' },
        summaryRow('calendar', 'Quando', whenText(job)),
        diasInfo(job) ? summaryRow('calendar-days', 'Dias', diasInfo(job).label) : null,
        summaryRow('clock', 'Duração', job.duration),
        summaryRow('map-pin', 'Onde', `${job.location} · ${job.distance}`)
      ),
      ...actions(),
      h('div', { class: 'flex items-start gap-2 text-sm text-concrete-500' }, Icon('hand-coins', { size: 18, color: 'var(--text-subtle)' }), h('span', {}, 'Pagamento em PIX no fim da diária, combinado direto com a construtora.'))
    )
  );

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Detalhe da vaga', onBack: () => goBack('/mural') }),
    h('div', { class: 'flex flex-col gap-4 px-4 sm:px-0 py-4 pb-28 lg:pb-4 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-10' },
      h('div', { class: 'flex flex-col gap-4 lg:gap-6' },
        Card({ padding: 'none' },
          h('div', { class: 'relative' },
            PhotoCarousel({ job, className: 'h-60 sm:h-80 lg:h-[26rem] rounded-t-card' }),
            h('div', { class: 'absolute z-10 left-4 -bottom-6 w-[3.75rem] h-[3.75rem] rounded-full bg-white p-0.5 shadow-raised' },
              h('div', { class: 'w-full h-full rounded-full bg-brand-50 flex items-center justify-center' }, Icon('building-2', { size: 24, color: 'var(--brand)' }))
            )
          ),
          h('div', { class: 'flex items-end justify-between gap-3 pt-9 pb-4 px-4' },
            h('div', { class: 'flex flex-col gap-1 min-w-0' },
              h('span', { class: 'font-semibold text-concrete-900 truncate' }, company.name),
              Rating({ value: company.rating, count: company.reviewCount })
            ),
            Button({ label: 'Ver perfil', variant: 'secondary', size: 'sm', iconLeft: 'building-2', onClick: () => navigate('/construtora/' + company.id) })
          )
        ),

        h('div', { class: 'flex flex-col gap-1.5' },
          h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, job.role),
          job.description ? h('p', { class: 'text-sm text-concrete-700 leading-relaxed' }, job.description) : null
        ),

        Card({ tone: 'brand', padding: 'md', className: 'lg:hidden' },
          h('div', { class: 'flex flex-col gap-4' },
            h('div', { class: 'flex items-end justify-between gap-3' },
              h('div', { class: 'flex flex-col gap-0.5' },
                h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-brand-600' }, 'Diária'),
                h('span', { class: 'font-mono font-bold text-4xl text-concrete-900' }, job.pay == null ? 'A combinar' : formatBRL(job.pay))
              ),
              h('span', { class: 'text-sm text-concrete-700 text-right' }, 'Pago no fim', h('br'), 'da diária')
            ),
            h('div', { class: 'flex items-center gap-2 pt-4 border-t border-brand-200' }, Icon('calendar', { size: 20, color: 'var(--text-brand)' }), h('span', { class: 'font-display font-semibold text-lg text-concrete-900' }, whenText(job)))
          )
        ),

        section('Onde e como', Card({ padding: 'md' },
          h('div', { class: 'flex flex-col gap-3.5' },
            infoRow('map-pin', job.address, `${job.location} · ${job.distance} de você`),
            diasInfo(job) ? infoRow('calendar-days', diasInfo(job).label, diasInfo(job).hint) : null,
            infoRow('clock', hoursText(job), job.duration),
            infoRow('hand-coins', 'Pagamento em PIX no fim da diária', 'Combinado direto com a construtora')
          )
        )),

        section('O que precisa levar', Card({ padding: 'md' },
          h('div', { class: 'flex flex-col gap-3' }, ...job.requirements.map((r) => h('div', { class: 'flex gap-2.5 items-center' }, Icon('circle-check', { size: 20, color: 'var(--green-500)' }), h('span', { class: 'text-concrete-700' }, r))))
        ))
      ),

      summary
    ),

    role === 'trabalhador' ? h('div', { class: 'sticky bottom-0 px-4 sm:px-0 py-3 bg-white shadow-bar flex flex-col gap-1.5 lg:hidden' }, ...actions()) : null,

    Dialog({
      open: ui.confirmCancel, tone: 'danger', title: 'Cancelar essa candidatura?',
      description: 'Você sai da lista de candidatos dessa vaga. Se quiser, pode se candidatar de novo depois.',
      confirmLabel: 'Cancelar candidatura', onConfirm: () => { store.cancelApplication(job.id, worker.id); store.setUI(KEY, { confirmCancel: false }); navigate('/minhas-candidaturas'); },
      cancelLabel: 'Voltar', onCancel: () => store.setUI(KEY, { confirmCancel: false })
    })
  );
}

function summaryRow(icon, label, value) {
  return h('div', { class: 'flex items-center gap-3 px-4 py-3' },
    Icon(icon, { size: 18, color: 'var(--text-subtle)' }),
    h('div', { class: 'flex flex-col min-w-0' },
      h('span', { class: 'text-xs font-bold uppercase tracking-[0.06em] text-concrete-500' }, label),
      h('span', { class: 'text-sm font-semibold text-concrete-900 truncate' }, value)
    )
  );
}

function section(title, content) {
  return h('div', { class: 'flex flex-col gap-2' }, h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, title), content);
}

function infoRow(icon, main, sub) {
  return h('div', { class: 'flex gap-3 items-start' },
    Icon(icon, { size: 20, color: 'var(--text-subtle)' }),
    h('div', { class: 'flex flex-col' }, h('span', { class: 'font-semibold text-concrete-900' }, main), h('span', { class: 'text-sm text-concrete-500' }, sub))
  );
}

function notFound(navigate) {
  return h('div', { class: 'flex flex-col items-center justify-center min-h-screen gap-3' },
    h('p', { class: 'text-concrete-500' }, 'Vaga não encontrada ou encerrada.'),
    Button({ label: 'Voltar ao mural', variant: 'secondary', onClick: () => navigate('/mural') })
  );
}
