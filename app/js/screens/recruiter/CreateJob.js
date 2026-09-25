import { h, cx } from '../../dom.js';
import { BackBar } from '../../components/TopBar.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { Tag } from '../../components/Tag.js';
import { Switch } from '../../components/Radio.js';
import { Card } from '../../components/Card.js';
import { Button } from '../../components/Button.js';
import { PhotoSlot } from '../../components/PhotoSlot.js';
import { Icon } from '../../utils/icons.js';
import { getUI, setUI, resetUI, currentCompanyId, createJob } from '../../store.js';
import { formatJobDate } from '../../utils/format.js';
import { traduzirErroSupabase } from '../../utils/erros.js';
import { goBack } from '../../router.js';
import { REQUISITOS_OPCOES, LOCAIS_BAIRRO } from '../../data/seed.js';

const KEY = 'create-job';

function digits(v, max) {
  return String(v).replace(/\D/g, '').slice(0, max);
}

function hojeISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export default function renderCreateJob(navigate) {
  const ui = getUI(KEY, {
    step: 1, foto: null, tipo: '', bairro: '', local: '', data: '', periodoInicio: '7', periodoFim: '17', diarias: '1', vagas: '1',
    valor: '', negociavel: false, requisitos: ['Botina e capacete próprios'], detalhe: '', urgente: false,
    errors: {}, publishing: false, serverError: null
  });

  const previaRole = ui.tipo.trim() || 'Vaga sem tipo';
  const previaPay = ui.negociavel ? 'A combinar' : (ui.valor ? 'R$ ' + ui.valor : 'R$ —');
  const previaData = ui.data ? formatJobDate(ui.data) : 'data a definir';
  const previaMeta = `${ui.local || 'Endereço da obra'} · ${previaData}`;

  function validateStep1() {
    const errors = {};
    if (!ui.tipo.trim()) errors.tipo = 'Escreva o tipo de serviço da vaga.';
    if (!ui.bairro) errors.bairro = 'Selecione o bairro da obra.';
    if (!ui.local.trim()) errors.local = 'Informe o endereço da obra.';
    if (!ui.data.trim()) errors.data = 'Informe a data da diária.';
    else if (ui.data < hojeISO()) errors.data = 'A data não pode ser no passado.';
    if (!ui.periodoInicio || !ui.periodoFim) errors.periodo = 'Informe o horário de início e fim.';
    if (!ui.diarias || Number(ui.diarias) < 1) errors.diarias = 'Informe quantas diárias.';
    if (!ui.vagas || Number(ui.vagas) < 1) errors.vagas = 'Informe quantas pessoas a vaga precisa.';
    return errors;
  }
  function validateStep2() {
    const errors = {};
    if (!ui.negociavel) {
      const n = parseInt(ui.valor, 10);
      if (!ui.valor.trim()) errors.valor = 'Informe o valor da diária, ou marque como a combinar.';
      else if (!n || n < 80) errors.valor = 'Informe um valor de R$ 80 ou mais.';
    }
    if (!ui.detalhe.trim()) errors.detalhe = 'Descreva o serviço da vaga.';
    return errors;
  }

  async function advance() {
    if (ui.step === 1) {
      const errors = validateStep1();
      if (Object.keys(errors).length) { setUI(KEY, { errors }); return; }
      setUI(KEY, { step: 2, errors: {} });
      return;
    }
    const errors = validateStep2();
    if (Object.keys(errors).length) { setUI(KEY, { errors }); return; }
    setUI(KEY, { publishing: true, serverError: null });

    const hours = `${ui.periodoInicio}h–${ui.periodoFim}h`;
    const diariasNum = Number(ui.diarias) || 1;
    try {
      const id = await createJob({
        companyId: currentCompanyId(), role: ui.tipo.trim(), pay: ui.negociavel ? null : parseInt(ui.valor, 10),
        location: ui.bairro, address: ui.local, date: ui.data,
        hours, duration: diariasNum === 1 ? '1 diária' : `${diariasNum} diárias`, urgent: ui.urgente, slots: Number(ui.vagas) || 1, requirements: ui.requisitos,
        description: ui.detalhe.trim(), photo: ui.foto
      });
      setUI(KEY, { publishing: false });
      resetUI(KEY);
      navigate('/vaga-publicada/' + id);
    } catch (error) {
      setUI(KEY, { publishing: false, serverError: traduzirErroSupabase(error) });
    }
  }

  const step1 = h('div', { class: 'flex flex-col gap-6' },
    h('div', { class: 'flex flex-col gap-1.5' },
      h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Foto da vaga (opcional)'),
      PhotoSlot({ shape: 'rect', height: '9rem', placeholder: 'Toque para escolher uma foto do canteiro', value: ui.foto, onChange: (v) => setUI(KEY, { foto: v }) }),
      h('span', { class: 'text-sm text-concrete-500' }, 'Aparece no card da vaga no mural. Você pode trocar depois em "Sua vaga".')
    ),
    Input({
      id: 'create-job-tipo', label: 'Tipo de serviço', placeholder: 'Ex.: Pedreiro de acabamento', icon: 'hammer',
      value: ui.tipo, error: ui.errors.tipo, onInput: (v) => setUI(KEY, { tipo: v, errors: Object.assign({}, ui.errors, { tipo: null }) })
    }),
    Select({
      id: 'create-job-bairro', label: 'Bairro da obra', placeholder: 'Selecione o bairro', options: LOCAIS_BAIRRO,
      value: ui.bairro, error: ui.errors.bairro, onChange: (v) => setUI(KEY, { bairro: v, errors: Object.assign({}, ui.errors, { bairro: null }) })
    }),
    Input({ id: 'create-job-local', label: 'Endereço da obra', placeholder: 'Rua, número e complemento', icon: 'map-pin', value: ui.local, error: ui.errors.local, onInput: (v) => setUI(KEY, { local: v, errors: Object.assign({}, ui.errors, { local: null }) }) }),
    Input({ id: 'create-job-data', label: 'Data da diária', type: 'date', icon: 'calendar', value: ui.data, error: ui.errors.data, onInput: (v) => setUI(KEY, { data: v, errors: Object.assign({}, ui.errors, { data: null }) }) }),
    h('div', { class: 'flex flex-col gap-1.5' },
      h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Período de trabalho'),
      h('div', { class: 'flex items-end gap-3' },
        h('div', { class: 'flex-1 min-w-0' }, Input({ id: 'create-job-periodo-inicio', label: 'Das', placeholder: '7', suffix: 'h', inputMode: 'numeric', value: ui.periodoInicio, onInput: (v) => setUI(KEY, { periodoInicio: digits(v, 2), errors: Object.assign({}, ui.errors, { periodo: null }) }) })),
        h('div', { class: 'flex-1 min-w-0' }, Input({ id: 'create-job-periodo-fim', label: 'Até', placeholder: '17', suffix: 'h', inputMode: 'numeric', value: ui.periodoFim, onInput: (v) => setUI(KEY, { periodoFim: digits(v, 2), errors: Object.assign({}, ui.errors, { periodo: null }) }) }))
      ),
      ui.errors.periodo ? h('span', { class: 'text-sm text-danger-500' }, ui.errors.periodo) : null
    ),
    Input({
      id: 'create-job-diarias', label: 'Quantidade de diárias', placeholder: '1', suffix: 'diária(s)', inputMode: 'numeric',
      value: ui.diarias, error: ui.errors.diarias, onInput: (v) => setUI(KEY, { diarias: digits(v, 2), errors: Object.assign({}, ui.errors, { diarias: null }) })
    }),
    Input({
      id: 'create-job-vagas', label: 'Quantidade de pessoas para a vaga', placeholder: '1', suffix: 'pessoa(s)', inputMode: 'numeric',
      hint: 'Quantos trabalhadores você precisa contratar para esse bico.', error: ui.errors.vagas,
      value: ui.vagas, onInput: (v) => setUI(KEY, { vagas: digits(v, 2), errors: Object.assign({}, ui.errors, { vagas: null }) })
    })
  );

  const step2 = h('div', { class: 'flex flex-col gap-6' },
    h('div', { class: 'flex flex-col gap-2' },
      Input({
        id: 'create-job-valor', label: 'Valor da diária', placeholder: '220', suffix: 'reais', inputMode: 'numeric',
        value: ui.negociavel ? '' : ui.valor, error: ui.errors.valor,
        hint: ui.errors.valor || ui.negociavel ? null : 'O trabalhador vê esse valor no mural. Mínimo de R$ 80.',
        onInput: (v) => setUI(KEY, { valor: digits(v, 5), errors: Object.assign({}, ui.errors, { valor: null }) })
      }),
      ui.negociavel ? null : Button({ label: 'Deixar valor a combinar', variant: 'ghost', size: 'sm', iconLeft: 'handshake', onClick: () => setUI(KEY, { negociavel: true, valor: '', errors: Object.assign({}, ui.errors, { valor: null }) }) }),
      ui.negociavel ? h('div', { class: 'flex items-center gap-2 p-3 rounded-control bg-brand-50 border border-brand-200' },
        Icon('handshake', { size: 18, color: 'var(--text-brand)' }),
        h('span', { class: 'flex-1 text-sm text-brand-600' }, 'O trabalhador vê "A combinar" no lugar do valor, e negocia direto com você.'),
        Button({ label: 'Definir um valor', variant: 'ghost', size: 'sm', onClick: () => setUI(KEY, { negociavel: false }) })
      ) : null
    ),
    h('div', { class: 'flex flex-col gap-2.5' },
      h('div', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, 'O que o trabalhador precisa levar'),
      h('div', { class: 'flex flex-wrap gap-2' }, ...REQUISITOS_OPCOES.map((r) => Tag({ label: r, selected: ui.requisitos.includes(r), onClick: () => setUI(KEY, { requisitos: ui.requisitos.includes(r) ? ui.requisitos.filter((x) => x !== r) : ui.requisitos.concat([r]) }) })))
    ),
    h('div', { class: 'flex flex-col gap-1.5 w-full' },
      h('label', { for: 'create-job-detalhe', class: 'text-sm font-semibold text-concrete-900' }, 'Descrição do bico'),
      h('textarea', {
        id: 'create-job-detalhe', 'data-focus-id': 'create-job-detalhe', rows: 3,
        placeholder: 'Ex.: reboco de duas paredes internas, argamassa e areia já estão no local.',
        value: ui.detalhe,
        class: cx(
          'w-full px-3 py-2.5 bg-white rounded-control border outline-none text-base text-concrete-900 placeholder:text-concrete-400 resize-none transition-colors duration-150',
          ui.errors.detalhe ? 'border-danger-500' : 'border-concrete-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100'
        ),
        oninput: (e) => setUI(KEY, { detalhe: e.target.value, errors: Object.assign({}, ui.errors, { detalhe: null }) })
      }),
      ui.errors.detalhe
        ? h('span', { class: 'flex items-center gap-1.5 text-sm text-danger-500' }, Icon('circle-alert', { size: 14 }), ui.errors.detalhe)
        : h('span', { class: 'text-sm text-concrete-500' }, 'Quanto mais claro, menos desencontro no canteiro. Essa descrição aparece para quem ver o bico.')
    ),
    h('div', { class: 'pt-1 border-t border-concrete-200' }, Switch({ label: 'Marcar como urgente', description: 'A vaga aparece no topo do mural com selo de urgente.', checked: ui.urgente, onChange: (v) => setUI(KEY, { urgente: v }) })),
    Card({ tone: 'sunken', padding: 'md' },
      h('div', { class: 'flex flex-col gap-2.5' },
        h('span', { class: 'font-semibold text-concrete-900' }, 'Como vai aparecer no mural'),
        h('div', { class: 'flex items-center gap-3' },
          h('div', { class: 'flex-1 min-w-0 flex flex-col gap-0.5' }, h('span', { class: 'font-display font-semibold text-lg text-concrete-900 truncate' }, previaRole), h('span', { class: 'text-sm text-concrete-500' }, previaMeta)),
          ui.negociavel
            ? h('div', { class: 'shrink-0 w-24 h-16 rounded-card bg-white border-[1.5px] border-brand-200 flex flex-col items-center justify-center gap-1' },
                Icon('handshake', { size: 16, color: 'var(--text-brand)' }),
                h('span', { class: 'text-xs font-semibold text-brand-600' }, 'A combinar')
              )
            : h('div', { class: 'shrink-0 w-24 h-16 rounded-card bg-brand-500 shadow-card flex flex-col items-center justify-center gap-0.5' },
                h('span', { class: 'font-mono font-bold text-lg text-white' }, previaPay),
                h('span', { class: 'text-[0.5625rem] font-semibold tracking-wide uppercase text-white/85' }, 'por diária')
              )
        )
      )
    )
  );

  return h('div', { class: 'flex flex-col' },
    BackBar({ title: 'Publicar vaga', onBack: () => (ui.step === 2 ? setUI(KEY, { step: 1 }) : goBack('/mural')) }),
    h('div', { class: 'flex items-center gap-2 px-4 sm:px-0 pt-3' },
      stepDot(1, ui.step >= 1), h('span', { class: 'text-sm text-concrete-500' }, 'Serviço, local e data'),
      h('span', { class: 'flex-1 h-px bg-concrete-200' }),
      stepDot(2, ui.step >= 2), h('span', { class: 'text-sm text-concrete-500' }, 'Valor e requisitos')
    ),
    h('div', { class: 'px-4 sm:px-0 py-5 lg:max-w-app flex flex-col gap-4' },
      ui.serverError ? h('div', { class: 'flex gap-2.5 items-start p-3.5 bg-danger-50 border border-danger-500 rounded-card' },
        h('span', { class: 'text-sm text-danger-500' }, ui.serverError)
      ) : null,
      ui.step === 1 ? step1 : step2
    ),
    h('div', { class: 'px-4 sm:px-0 py-3 flex flex-col gap-1.5 lg:max-w-app' },
      Button({ label: ui.step === 1 ? 'Continuar' : 'Publicar vaga', size: 'lg', fullWidth: true, loading: ui.publishing, onClick: advance }),
      h('span', { class: 'text-center text-xs text-concrete-500' }, 'Publicar é grátis. Você paga só se impulsionar.')
    )
  );
}

function stepDot(n, active) {
  return h('span', { class: `inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${active ? 'bg-brand-500 text-white' : 'bg-concrete-100 text-concrete-500'}` }, String(n));
}
