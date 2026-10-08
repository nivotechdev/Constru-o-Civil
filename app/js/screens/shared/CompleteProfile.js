import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { Select } from '../../components/Select.js';
import { Tag } from '../../components/Tag.js';
import { PhotoSlot } from '../../components/PhotoSlot.js';
import { IconButton } from '../../components/IconButton.js';
import { getUI, setUI, setRole } from '../../store.js';
import { CARGOS_TRABALHADOR, REGIOES_TRABALHADOR, ESPECIALIDADES, TIPOS_OBRA, REGIOES_RECRUTADOR } from '../../data/seed.js';

export default function renderCompleteProfile(navigate, params) {
  const role = params.role === 'recrutador' ? 'recrutador' : 'trabalhador';
  return role === 'recrutador' ? recruiterFlow(navigate) : workerFlow(navigate);
}

function shell(step, total, onBack, children, onContinue, label) {
  return h('div', { class: 'min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto lg:shadow-card lg:my-10 lg:rounded-card lg:overflow-hidden' },
    h('div', { class: 'sticky top-0 z-10 bg-white border-b border-concrete-200 px-2 pb-3' },
      h('div', { class: 'flex items-center gap-1.5 min-h-14' },
        step > 0 ? IconButton({ icon: 'arrow-left', label: 'Voltar', onClick: onBack }) : h('span', { class: 'w-11 h-11' }),
        h('span', { class: 'flex-1 text-sm font-semibold text-concrete-500' }, `Passo ${step + 1} de ${total}`)
      ),
      h('div', { class: 'h-1 mx-2 rounded-full bg-concrete-200 overflow-hidden' },
        h('div', { class: 'h-full bg-brand-500 rounded-full transition-all duration-200', style: { width: ((step + 1) / total * 100) + '%' } })
      )
    ),
    h('div', { class: 'flex-1 px-5 sm:px-8 py-8 flex flex-col gap-7 bg-concrete-50' }, ...children),
    h('div', { class: 'px-5 sm:px-8 py-3 bg-white shadow-bar' },
      Button({ label, size: 'lg', fullWidth: true, onClick: onContinue })
    )
  );
}

function heading(overline, title, help) {
  return h('div', { class: 'flex flex-col gap-2.5' },
    h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, overline),
    h('h1', { class: 'font-display font-bold text-3xl text-concrete-900' }, title),
    h('p', { class: 'text-base text-concrete-700' }, help)
  );
}

function workerFlow(navigate) {
  const key = 'completar-trabalhador';
  const ui = getUI(key, { step: 0, photo: null, cargo: '', regiao: '', especialidades: [], errors: {} });

  if (ui.step === 0) {
    return shell(0, 2, () => navigate('/verificar-email'), [
      heading('Completar perfil', 'Uma foto e o seu cargo', 'Isso aparece no seu perfil para as construtoras que virem seu bico.'),
      h('div', { class: 'flex flex-col items-center gap-3' },
        PhotoSlot({ shape: 'circle', value: ui.photo, onChange: (v) => setUI(key, { photo: v }), className: 'w-24 h-24', placeholder: 'Sua foto' }),
        Button({ label: 'Pular por enquanto', variant: 'ghost', onClick: () => setUI(key, { step: 1 }) })
      ),
      Select({
        label: 'Cargo ou especialidade principal', placeholder: 'Selecione seu cargo', options: CARGOS_TRABALHADOR,
        value: ui.cargo, error: ui.errors.cargo, onChange: (v) => setUI(key, { cargo: v, errors: Object.assign({}, ui.errors, { cargo: null }) })
      })
    ], () => {
      if (!ui.cargo) { setUI(key, { errors: { cargo: 'Selecione seu cargo ou especialidade principal.' } }); return; }
      setUI(key, { step: 1, errors: {} });
    }, 'Continuar');
  }

  return shell(1, 2, () => setUI(key, { step: 0 }), [
    heading('Completar perfil', 'Onde e no que você trabalha', 'Usamos para mostrar bicos perto de você e do jeito certo para seu ofício.'),
    Select({
      label: 'Região de atuação', placeholder: 'Selecione bairro e cidade', options: REGIOES_TRABALHADOR,
      value: ui.regiao, error: ui.errors.regiao, onChange: (v) => setUI(key, { regiao: v, errors: Object.assign({}, ui.errors, { regiao: null }) })
    }),
    h('div', { class: 'flex flex-col gap-2.5' },
      h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Especialidades'),
      h('div', { class: 'flex flex-wrap gap-2' }, ...ESPECIALIDADES.map((e) => Tag({
        label: e, selected: ui.especialidades.includes(e),
        onClick: () => setUI(key, { especialidades: ui.especialidades.includes(e) ? ui.especialidades.filter((x) => x !== e) : ui.especialidades.concat([e]), errors: Object.assign({}, ui.errors, { especialidades: null }) })
      }))),
      ui.errors.especialidades ? h('span', { class: 'text-sm text-danger-500' }, ui.errors.especialidades) : null
    )
  ], () => {
    const errors = {};
    if (!ui.regiao) errors.regiao = 'Selecione sua região de atuação.';
    if (ui.especialidades.length === 0) errors.especialidades = 'Escolha ao menos uma especialidade.';
    if (Object.keys(errors).length) { setUI(key, { errors }); return; }
    setRole('trabalhador');
    navigate('/mural');
  }, 'Concluir perfil');
}

function recruiterFlow(navigate) {
  const key = 'completar-recrutador';
  const ui = getUI(key, { step: 0, capa: null, logo: null, tipoObra: '', regiao: '', errors: {} });

  if (ui.step === 0) {
    return shell(0, 2, () => navigate('/verificar-email'), [
      heading('Completar perfil', 'Capa e logo da construtora', 'Isso aparece no perfil que os candidatos veem antes de se candidatar.'),
      h('div', { class: 'flex flex-col gap-2' },
        h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Foto de capa'),
        PhotoSlot({ shape: 'rect', value: ui.capa, onChange: (v) => setUI(key, { capa: v }), height: '7.5rem', placeholder: 'Capa da construtora' })
      ),
      h('div', { class: 'flex items-center gap-4' },
        PhotoSlot({ shape: 'circle', value: ui.logo, onChange: (v) => setUI(key, { logo: v }), className: 'w-[4.5rem] h-[4.5rem] shrink-0', placeholder: 'Logo' }),
        h('div', { class: 'flex flex-col gap-1' },
          h('span', { class: 'text-sm font-semibold text-concrete-900' }, 'Foto ou logo de perfil'),
          Button({ label: 'Pular por enquanto', variant: 'ghost', size: 'sm', onClick: () => setUI(key, { step: 1 }) })
        )
      )
    ], () => setUI(key, { step: 1 }), 'Continuar');
  }

  return shell(1, 2, () => setUI(key, { step: 0 }), [
    heading('Completar perfil', 'Sobre a sua obra', 'Usamos para destacar o tipo de obra e mostrar suas vagas na região certa.'),
    Select({ label: 'Tipo de obra', placeholder: 'Selecione o tipo de obra', options: TIPOS_OBRA, value: ui.tipoObra, error: ui.errors.tipoObra, onChange: (v) => setUI(key, { tipoObra: v, errors: Object.assign({}, ui.errors, { tipoObra: null }) }) }),
    Select({ label: 'Região de atuação', placeholder: 'Selecione a região', options: REGIOES_RECRUTADOR, value: ui.regiao, error: ui.errors.regiao, onChange: (v) => setUI(key, { regiao: v, errors: Object.assign({}, ui.errors, { regiao: null }) }) })
  ], () => {
    const errors = {};
    if (!ui.tipoObra) errors.tipoObra = 'Selecione o tipo de obra.';
    if (!ui.regiao) errors.regiao = 'Selecione sua região de atuação.';
    if (Object.keys(errors).length) { setUI(key, { errors }); return; }
    setRole('recrutador');
    navigate('/mural');
  }, 'Concluir perfil');
}
