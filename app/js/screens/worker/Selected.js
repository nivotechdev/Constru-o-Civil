import { h } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Badge } from '../../components/Badge.js';
import { Card } from '../../components/Card.js';
import { Button } from '../../components/Button.js';
import { Icon } from '../../utils/icons.js';
import { formatBRL } from '../../utils/format.js';
import { goBack } from '../../router.js';
import { traduzirErroSupabase } from '../../utils/erros.js';
import * as store from '../../store.js';

const KEY = 'selected';

export default function renderSelected(navigate, params) {
  store.ensureJobsLoaded();
  store.ensureMyApplicationsLoaded();
  const job = store.getJob(params.id);
  if (!job) return h('div', { class: 'p-6 text-concrete-500' }, 'Vaga não encontrada.');
  const company = store.getCompany(job.companyId);
  const hired = store.applicationFor(job.id, store.currentWorkerId());
  const ui = store.getUI(KEY, { abrindo: false, erro: null, concluindo: false });
  const title = hired && hired.status === 'contratado' ? `Você foi contratado pela ${company.name}` : `A ${company.name} quer falar com você`;
  const podeConcluir = hired && (hired.status === 'pre_selecionado' || hired.status === 'contratado');

  async function concluirDiaria() {
    store.setUI(KEY, { concluindo: true, erro: null });
    try {
      await store.markConcluded(job.id, store.currentWorkerId());
      navigate('/minhas-candidaturas');
    } catch (error) {
      store.setUI(KEY, { concluindo: false, erro: traduzirErroSupabase(error) });
    }
  }

  async function abrirWhatsapp() {
    if (!hired) return;
    store.setUI(KEY, { abrindo: true, erro: null });
    try {
      const numero = await store.getWhatsappContato(hired.id);
      store.setUI(KEY, { abrindo: false });
      if (numero) window.open('https://wa.me/' + numero.replace(/\D/g, ''), '_blank');
      else store.setUI(KEY, { erro: 'A construtora ainda não cadastrou um WhatsApp de contato.' });
    } catch (error) {
      store.setUI(KEY, { abrindo: false, erro: traduzirErroSupabase(error) });
    }
  }

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Você avançou', onBack: () => goBack('/minhas-candidaturas') }),
    h('div', { class: 'bg-brand-500 text-white px-4 sm:px-6 py-7 flex flex-col gap-3 lg:rounded-card' },
      Badge({ label: hired && hired.status === 'contratado' ? 'Contratado' : 'Pré-selecionado', tone: 'inverse', icon: 'circle-check' }),
      h('h1', { class: 'font-display font-bold text-3xl leading-tight text-white' }, title),
      h('p', { class: 'text-white/85' }, `${job.role} · ${job.date}`)
    ),
    h('div', { class: 'flex flex-col gap-4 px-4 sm:px-0 py-4 lg:max-w-app' },
      Card({ padding: 'md' },
        h('div', { class: 'flex flex-col gap-4' },
          h('div', { class: 'flex items-center gap-3' },
            h('span', { class: 'inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 shrink-0' }, Icon('building-2', { size: 24, color: 'var(--brand)' })),
            h('div', { class: 'flex flex-col gap-0.5' }, h('span', { class: 'font-semibold text-concrete-900' }, company.name), h('span', { class: 'text-sm text-concrete-500' }, company.tipoObra || 'Construção civil'))
          ),
          Button({ label: 'Falar no WhatsApp', variant: 'accent', size: 'lg', fullWidth: true, iconLeft: 'message-circle', loading: ui.abrindo, onClick: abrirWhatsapp }),
          ui.erro ? h('span', { class: 'text-sm text-danger-500' }, ui.erro) : null,
          h('span', { class: 'text-sm text-concrete-700' }, 'Combine ponto de encontro, horário e pagamento direto com a construtora. A Bicos não cobra taxa e não entra na negociação.')
        )
      ),
      Card({ tone: 'sunken', padding: 'md' },
        h('div', { class: 'flex flex-col gap-3' },
          kv('Diária combinada', job.pay == null ? 'A combinar' : formatBRL(job.pay)),
          kv('Local', job.location),
          kv('Contato liberado', 'Hoje · 9h10')
        )
      ),
      podeConcluir ? Button({ label: 'Marcar diária como concluída', fullWidth: true, iconLeft: 'circle-check', loading: ui.concluindo, onClick: concluirDiaria }) : null,
      Button({ label: 'Ver a vaga de novo', variant: 'secondary', fullWidth: true, onClick: () => navigate('/vaga/' + job.id) })
    )
  );
}

function kv(label, value) {
  return h('div', { class: 'flex items-center justify-between gap-3' }, h('span', { class: 'text-sm text-concrete-500' }, label), h('span', { class: 'font-mono font-bold text-concrete-900' }, value));
}
