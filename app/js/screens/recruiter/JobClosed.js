import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Badge } from '../../components/Badge.js';
import { Card } from '../../components/Card.js';
import { Button } from '../../components/Button.js';
import { Icon } from '../../utils/icons.js';
import { formatBRL } from '../../utils/format.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';
import { dateText } from '../../utils/jobInfo.js';

export default function renderJobClosed(navigate, params) {
  const job = store.getJob(params.id);
  const team = job ? store.applicationsForJob(job.id).filter((a) => a.status === 'pre_selecionado' || a.status === 'contratado').map((a) => store.getWorker(a.workerId)) : [];
  if (!job || team.length === 0) {
    return h('div', { class: 'flex flex-col items-center justify-center min-h-screen gap-3' },
      h('p', { class: 'text-concrete-500' }, 'Esse bico ainda não foi fechado.'),
      Button({ label: 'Voltar ao início', variant: 'secondary', onClick: () => navigate('/mural') })
    );
  }
  const title = team.length === 1 ? `${team[0].name} está contratado` : `${team.length} trabalhadores contratados`;
  const total = (job.pay || 0) * Math.max(team.length, 1);

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Bico fechado', onBack: () => goBack('/mural') }),
    h('div', { class: 'bg-brand-500 text-white px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card' },
      Badge({ label: 'Bico fechado', tone: 'inverse', icon: 'circle-check' }),
      h('h1', { class: 'font-display font-bold text-3xl leading-tight text-white' }, title),
      h('p', { class: 'text-white/85' }, `${job.role} · ${dateText(job)}`)
    ),
    h('div', { class: 'flex flex-col gap-4 px-4 sm:px-0 py-4' },
      Card({ tone: 'sunken', padding: 'sm' },
        h('div', { class: 'flex items-center gap-3' },
          Icon('circle-check', { size: 20, color: 'var(--green-500)' }),
          h('span', { class: 'flex-1 text-sm text-concrete-700' }, 'A vaga saiu do mural. Quem não foi aprovado recebeu o aviso de que o bico foi fechado.')
        )
      ),
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Equipe contratada'),
      h('div', { class: 'flex flex-col gap-3' }, ...team.map((worker) => Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-3.5' },
          h('div', { class: 'flex items-center gap-3' },
            h('span', { class: 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent-50 text-accent-600 font-bold shrink-0' }, worker.initials),
            h('div', { class: 'flex-1 min-w-0 flex flex-col' }, h('span', { class: 'font-semibold text-concrete-900' }, worker.name), h('span', { class: 'text-sm text-concrete-500' }, `${worker.role} · ${worker.region}`))
          ),
          Button({ label: 'Falar no WhatsApp', variant: 'accent', fullWidth: true, iconLeft: 'message-circle', onClick: () => {} })
        )
      ))),
      Card({ tone: 'sunken', padding: 'md' },
        h('div', { class: 'flex flex-col gap-3' },
          kv('Diária combinada', job.pay == null ? 'A combinar' : formatBRL(job.pay)),
          kv('Local', job.location),
          kv('Total do bico', formatBRL(total))
        )
      ),
      Button({ label: 'Voltar ao início', variant: 'secondary', fullWidth: true, onClick: () => navigate('/mural') })
    )
  );
}

function kv(label, value) {
  return h('div', { class: 'flex items-center justify-between gap-3' }, h('span', { class: 'text-sm text-concrete-500' }, label), h('span', { class: 'font-mono font-bold text-concrete-900' }, value));
}
