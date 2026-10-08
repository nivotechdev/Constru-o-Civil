import { h } from '../../dom.js';
import { Card } from '../../components/Card.js';
import { Button } from '../../components/Button.js';
import { BackBar } from '../../components/TopBar.js';
import { Icon } from '../../utils/icons.js';
import { formatBRL } from '../../utils/format.js';
import { getJob, getCompany } from '../../store.js';
import { goBack } from '../../router.js';
import { dateText } from '../../utils/jobInfo.js';

export default function renderApplicationSent(navigate, params) {
  const job = getJob(params.id);
  if (!job) return h('div', { class: 'p-6 text-concrete-500' }, 'Vaga não encontrada.');
  const company = getCompany(job.companyId);

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Bicos', onBack: () => goBack('/mural') }),
    h('div', { class: 'flex flex-col items-center text-center gap-5 px-6 pt-10 pb-8 lg:max-w-app lg:mx-auto' },
      h('span', { class: 'inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full bg-success-50' }, Icon('circle-check', { size: 34, color: 'var(--green-500)' })),
      h('div', { class: 'flex flex-col gap-2' },
        h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, 'Candidatura enviada'),
        h('p', { class: 'text-base text-concrete-700' }, 'A construtora recebeu seu perfil. Avisamos quando você avançar de etapa.')
      ),
      Card({ tone: 'sunken', padding: 'md', className: 'w-full' },
        h('div', { class: 'flex items-center justify-between gap-3' },
          h('div', { class: 'flex flex-col gap-0.5 min-w-0' }, h('span', { class: 'font-semibold text-concrete-900' }, job.role), h('span', { class: 'text-sm text-concrete-500' }, `${company.name} · ${dateText(job)}`)),
          h('span', { class: 'font-mono font-bold text-xl text-concrete-900' }, job.pay == null ? 'A combinar' : formatBRL(job.pay))
        )
      ),
      h('div', { class: 'w-full flex flex-col gap-2 pt-2' },
        Button({ label: 'Ver minhas candidaturas', fullWidth: true, onClick: () => navigate('/minhas-candidaturas') }),
        Button({ label: 'Voltar ao mural', variant: 'ghost', fullWidth: true, onClick: () => navigate('/mural') })
      )
    )
  );
}
