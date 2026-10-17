import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Button } from '../../components/Button.js';
import { formatBRL } from '../../utils/format.js';
import { getUI, setUI, getJob, getCompany, currentWorker, applyToJob } from '../../store.js';
import { goBack } from '../../router.js';
import { dateText } from '../../utils/jobInfo.js';

const KEY = 'confirm-application';

export default function renderConfirmApplication(navigate, params) {
  const job = getJob(params.id);
  if (!job) return h('div', { class: 'p-6 text-concrete-500' }, 'Vaga não encontrada.');
  const company = getCompany(job.companyId);
  const worker = currentWorker();
  const ui = getUI(KEY, { submitting: false });

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Confirmar candidatura', onBack: () => goBack('/vaga/' + job.id) }),
    h('div', { class: 'flex flex-col gap-4 px-4 sm:px-0 py-4' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Confira antes de enviar'),
      Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-4' },
          h('div', { class: 'flex flex-col gap-0.5' },
            h('span', { class: 'font-display font-semibold text-xl text-concrete-900' }, job.role),
            h('span', { class: 'text-sm text-concrete-700' }, company.name)
          ),
          h('div', { class: 'flex gap-3' },
            h('div', { class: 'flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5' }, h('span', { class: 'text-xs text-concrete-500' }, 'Diária'), h('span', { class: 'font-mono font-bold text-2xl text-concrete-900' }, job.pay == null ? 'A combinar' : formatBRL(job.pay))),
            h('div', { class: 'flex-1 bg-concrete-100 rounded-control p-3 flex flex-col gap-0.5' }, h('span', { class: 'text-xs text-concrete-500' }, 'Data'), h('span', { class: 'font-semibold text-concrete-900' }, dateText(job)))
          ),
          h('div', { class: 'flex items-center gap-2.5 pt-4 border-t border-concrete-200' },
            h('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-50 text-accent-600 font-bold text-sm shrink-0' }, worker.initials),
            h('div', { class: 'flex flex-col' }, h('span', { class: 'font-semibold text-concrete-900' }, worker.name), h('span', { class: 'text-sm text-concrete-500' }, `${worker.role} · ${worker.rating}`))
          )
        )
      ),
      h('span', { class: 'text-sm text-concrete-500' }, 'A construtora vai ver seu perfil, suas especialidades e suas avaliações. O contato por WhatsApp só abre se ela te escolher.')
    ),
    h('div', { class: 'px-4 sm:px-0 py-3 flex flex-col gap-2' },
      Button({
        label: 'Sim, quero esse bico', size: 'lg', fullWidth: true, loading: ui.submitting,
        onClick: () => {
          setUI(KEY, { submitting: true });
          setTimeout(() => { setUI(KEY, { submitting: false }); applyToJob(job.id, worker.id); navigate('/enviado/' + job.id); }, 600);
        }
      }),
      Button({ label: 'Voltar para a vaga', variant: 'ghost', fullWidth: true, onClick: () => navigate('/vaga/' + job.id) })
    )
  );
}
