import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Button } from '../../components/Button.js';
import { Icon } from '../../utils/icons.js';
import { getUI, setUI, getJob } from '../../store.js';
import { goBack } from '../../router.js';

const KEY = 'boost-job';
const PLANS = [
  { id: '24h', label: 'Topo do mural por 24h', desc: 'Aparece antes das outras vagas da região.', price: 'R$ 12' },
  { id: '3d', label: 'Topo do mural por 3 dias', desc: 'Para vaga com data mais distante.', price: 'R$ 28' },
  { id: 'whats', label: '24h + aviso por WhatsApp', desc: 'Avisamos quem tem o perfil da vaga por perto.', price: 'R$ 39' }
];

export default function renderBoostJob(navigate, params) {
  const job = getJob(params.id);
  if (!job) return h('div', { class: 'p-6 text-concrete-500' }, 'Vaga não encontrada.');
  const ui = getUI(KEY, { plan: '24h' });
  const chosen = PLANS.find((p) => p.id === ui.plan);

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Impulsionar vaga', onBack: () => goBack('/vaga-gerenciar/' + job.id) }),
    h('div', { class: 'flex flex-col gap-5 px-4 sm:px-0 py-4' },
      h('div', { class: 'flex flex-col gap-1' },
        h('h1', { class: 'font-display font-bold text-2xl text-concrete-900' }, 'Sua vaga no topo do mural'),
        h('span', { class: 'text-sm text-concrete-700' }, `${job.role} · ${job.location}`)
      ),
      Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-3.5' },
          fact('zap', 'A vaga aparece no bloco de cima do mural, antes das outras da mesma região.', 'var(--brand)'),
          fact('users', 'Vagas impulsionadas na região recebem em média 4 candidatos a mais.', 'var(--text-subtle)'),
          fact('triangle-alert', 'Impulsionar não garante candidato. Se ninguém se candidatar, devolvemos o valor em 3 dias.', 'var(--amber-500)')
        )
      ),
      h('div', { class: 'flex flex-col gap-2.5' },
        h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'Por quanto tempo'),
        h('div', { class: 'flex flex-col gap-2' }, ...PLANS.map((p) => {
          const active = ui.plan === p.id;
          return h('button', {
            type: 'button', onClick: () => setUI(KEY, { plan: p.id }),
            class: `flex items-center gap-3 w-full min-h-[4.5rem] px-4 py-3.5 rounded-card border transition-colors text-left ${active ? 'bg-brand-50 border-brand-500' : 'bg-white border-concrete-300 shadow-card'}`
          },
            h('span', { class: `shrink-0 w-5 h-5 rounded-full border-2 ${active ? 'border-brand-500 bg-brand-500' : 'border-concrete-400'}` }),
            h('span', { class: 'flex-1 min-w-0 flex flex-col gap-0.5' },
              h('span', { class: `font-semibold ${active ? 'text-brand-600' : 'text-concrete-900'}` }, p.label),
              h('span', { class: 'text-sm text-concrete-500' }, p.desc)
            ),
            h('span', { class: 'font-mono font-bold text-lg text-concrete-900' }, p.price)
          );
        }))
      ),
      h('span', { class: 'text-sm text-concrete-500' }, 'Cobrança única no cartão cadastrado. Sem renovação automática. O trabalhador nunca paga nada.')
    ),
    h('div', { class: 'px-4 sm:px-0 py-3 flex flex-col gap-2' },
      Button({ label: `Impulsionar por ${chosen.price}`, size: 'lg', fullWidth: true, onClick: () => { job.boosted = true; job.urgent = true; navigate('/vaga-gerenciar/' + job.id); } }),
      Button({ label: 'Agora não', variant: 'ghost', fullWidth: true, onClick: () => navigate('/vaga-gerenciar/' + job.id) })
    )
  );
}

function fact(icon, text, color) {
  return h('div', { class: 'flex gap-2.5 items-start' }, Icon(icon, { size: 20, color }), h('span', { class: 'text-sm text-concrete-700' }, text));
}
