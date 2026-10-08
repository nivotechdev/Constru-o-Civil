import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Card } from '../../components/Card.js';
import { Rating } from '../../components/Rating.js';
import { Button } from '../../components/Button.js';
import { EmptyState } from '../../components/EmptyState.js';
import { goBack } from '../../router.js';
import * as store from '../../store.js';

export default function renderReviews(navigate, params) {
  const type = params.type === 'construtora' ? 'construtora' : 'trabalhador';
  const subject = type === 'trabalhador' ? store.getWorker(params.id) : store.getCompany(params.id);
  if (!subject) return notFound(navigate);

  const role = store.getRole();
  const allowed = type === 'trabalhador' ? role === 'recrutador' : role === 'trabalhador';
  const backTarget = type === 'trabalhador' ? '/trabalhador/' + params.id : '/construtora/' + params.id;

  if (!allowed) {
    return h('div', { class: 'flex flex-col' },
      BackBar({ title: 'Avaliações', onBack: () => goBack(backTarget) }),
      EmptyState({
        icon: 'lock', title: 'Essas avaliações não são suas para ver',
        description: type === 'trabalhador'
          ? 'Só construtoras podem ver as avaliações de um trabalhador.'
          : 'Só trabalhadores podem ver as avaliações de uma construtora.'
      })
    );
  }

  const reviews = subject.reviews || [];
  const count = type === 'trabalhador' ? subject.jobsDone : subject.reviewCount;

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Avaliações', onBack: () => goBack(backTarget) }),
    h('div', { class: 'flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4' },
      h('div', { class: 'flex flex-col gap-1.5' },
        h('span', { class: 'font-display font-bold text-2xl text-concrete-900' }, subject.name),
        Rating({ value: subject.rating, count })
      ),
      reviews.length === 0
        ? EmptyState({ icon: 'star', title: 'Ainda não há avaliações', description: `${subject.name} ainda não recebeu nenhuma avaliação na plataforma.` })
        : h('div', { class: 'flex flex-col gap-3' }, ...reviews.map((r) => Card({ padding: 'md' },
            h('div', { class: 'flex flex-col gap-2' },
              h('div', { class: 'flex items-center justify-between gap-2' }, h('span', { class: 'font-semibold text-concrete-900' }, r.company || r.author), Rating({ value: r.value, showValue: false, size: 13 })),
              h('span', { class: 'text-sm text-concrete-700' }, r.text),
              h('span', { class: 'text-xs text-concrete-400' }, r.date)
            )
          )))
    )
  );
}

function notFound(navigate) {
  return h('div', { class: 'flex flex-col items-center justify-center min-h-screen gap-3' },
    h('p', { class: 'text-concrete-500' }, 'Não encontrado.'),
    Button({ label: 'Voltar ao mural', variant: 'secondary', onClick: () => navigate('/mural') })
  );
}
