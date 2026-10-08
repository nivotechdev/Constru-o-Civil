import { h } from '../../dom.js';
import { Card } from '../../components/Card.js';
import { Rating } from '../../components/Rating.js';
import { Tag } from '../../components/Tag.js';
import { Input } from '../../components/Input.js';
import { Button } from '../../components/Button.js';
import { BackBar } from '../../components/TopBar.js';
import { getUI, setUI, getJob, getCompany, currentWorkerId, markReviewed } from '../../store.js';
import { goBack } from '../../router.js';
import { dateText } from '../../utils/jobInfo.js';

const KEY = 'rate-job';
const OPTIONS = [
  { id: 'pagou', label: 'Pagou no dia', icon: 'hand-coins' },
  { id: 'epi', label: 'EPI no local', icon: 'hard-hat' },
  { id: 'horario', label: 'Horário combinado', icon: 'clock' },
  { id: 'equipe', label: 'Equipe respeitosa', icon: 'users' }
];

export default function renderRateJob(navigate, params) {
  const job = getJob(params.id);
  if (!job) return h('div', { class: 'p-6 text-concrete-500' }, 'Vaga não encontrada.');
  const company = getCompany(job.companyId);
  const ui = getUI(KEY, { rating: 5, selected: ['pagou'], comment: '' });

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Avaliar a diária', onBack: () => goBack('/minhas-candidaturas') }),
    h('div', { class: 'flex flex-col gap-5 px-4 sm:px-0 py-4' },
      h('div', { class: 'flex flex-col gap-1' },
        h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, 'Como foi a diária?'),
        h('span', { class: 'text-sm text-concrete-500' }, `${job.role} · ${company.name} · ${dateText(job)}`)
      ),
      Card({ padding: 'md' },
        h('div', { class: 'flex flex-col items-center gap-3' },
          h('span', { class: 'font-semibold text-concrete-900' }, 'Sua nota para a construtora'),
          Rating({ value: ui.rating, editable: true, onChange: (v) => setUI(KEY, { rating: v }) })
        )
      ),
      h('div', { class: 'flex flex-col gap-2.5' },
        h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'O que aconteceu'),
        h('div', { class: 'flex flex-wrap gap-2' }, ...OPTIONS.map((o) => Tag({
          label: o.label, icon: o.icon, selected: ui.selected.includes(o.id),
          onClick: () => setUI(KEY, { selected: ui.selected.includes(o.id) ? ui.selected.filter((x) => x !== o.id) : ui.selected.concat([o.id]) })
        })))
      ),
      Input({
        id: 'rate-comment', label: 'Quer escrever algo? (opcional)', placeholder: 'Ex.: obra organizada, pagamento em PIX no fim do dia',
        hint: 'Sua avaliação aparece no perfil da construtora.', value: ui.comment, onInput: (v) => setUI(KEY, { comment: v })
      }),
      h('div', { class: 'pt-1' }, Button({
        label: 'Enviar avaliação', size: 'lg', fullWidth: true,
        onClick: () => { markReviewed(job.id, currentWorkerId()); navigate('/minhas-candidaturas'); }
      }))
    )
  );
}
