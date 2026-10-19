import { h } from '../../dom.js';
import { Button } from '../../components/Button.js';
import { Input, PasswordInput } from '../../components/Input.js';
import { Checkbox } from '../../components/Checkbox.js';
import { IconButton } from '../../components/IconButton.js';
import { getUI, setUI, resetUI } from '../../store.js';
import { maskCPF, maskCNPJ, isValidEmail, passwordStrength, STRENGTH_LABEL } from '../../utils/format.js';
import { goBack as routerGoBack } from '../../router.js';

const COMUM_EMAIL = { id: 'email', label: 'E-mail', question: 'Qual é o seu e-mail?', placeholder: 'voce@email.com', icon: 'mail', type: 'email' };
const COMUM_SENHA = { id: 'senha', label: 'Senha', question: 'Crie uma senha', help: 'Use 8 caracteres ou mais, misturando letras e números.', placeholder: 'Sua senha', isPassword: true };

const PERFIS = {
  trabalhador: {
    overline: 'Cadastro de trabalhador',
    fields: [
      { id: 'nome', label: 'Nome completo', question: 'Como você se chama?', help: 'Escreva o nome completo, igual ao do seu RG ou CNH.', placeholder: 'Jorge Mendes da Silva', icon: 'user' },
      { id: 'doc', label: 'CPF', question: 'Qual é o seu CPF?', help: 'Serve para conferir sua identidade. A construtora não vê esse número.', placeholder: '000.000.000-00', icon: 'id-card', mask: 'cpf', mono: true },
      Object.assign({}, COMUM_EMAIL, { help: 'É por aqui que avisamos quando uma construtora escolher você.' }),
      COMUM_SENHA
    ]
  },
  recrutador: {
    overline: 'Cadastro de recrutador',
    fields: [
      { id: 'razao', label: 'Nome da empresa', question: 'Qual é o nome da empresa?', help: 'É esse nome que aparece no seu perfil e nas vagas que você publicar.', placeholder: 'Meridiano Construções', icon: 'building-2' },
      { id: 'doc', label: 'CNPJ', question: 'Qual é o CNPJ da empresa?', help: 'Conferimos o CNPJ antes de liberar a publicação de vagas.', placeholder: '00.000.000/0000-00', icon: 'id-card', mask: 'cnpj', mono: true },
      Object.assign({}, COMUM_EMAIL, { help: 'É por aqui que avisamos cada novo candidato da sua vaga.' }),
      COMUM_SENHA
    ]
  }
};

// Demo-only sentinel that reproduces the "documento já cadastrado" form-level error state.
const TAKEN_DOC = ['111.111.111-11', '11.111.111/1111-11'];

function validateField(field, values, role) {
  const v = String(values[field.id] || '').trim();
  if (field.id === 'nome') {
    if (!v) return 'Informe o nome completo.';
    if (v.split(/\s+/).length < 2) return 'Informe nome e sobrenome.';
    return null;
  }
  if (field.id === 'razao') return v.length < 3 ? 'Informe o nome da empresa.' : null;
  if (field.id === 'doc') {
    const digits = v.replace(/\D/g, '');
    const need = role === 'recrutador' ? 14 : 11;
    if (digits.length !== need) return role === 'recrutador' ? 'CNPJ inválido. Confira os 14 números.' : 'CPF inválido. Confira os 11 números.';
    return null;
  }
  if (field.id === 'email') return isValidEmail(v) ? null : 'E-mail inválido. Confira se tem @ e o domínio.';
  if (field.id === 'senha') {
    if (v.length < 8) return 'Senha curta. Use 8 caracteres ou mais.';
    if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return 'Misture letras e números na senha.';
    return null;
  }
  return null;
}

export default function renderSignup(navigate, params) {
  const role = params.role === 'recrutador' ? 'recrutador' : 'trabalhador';
  const key = 'cadastro-' + role;
  const cfg = PERFIS[role];
  const ui = getUI(key, () => ({ step: 0, values: {}, errors: {}, generalError: false, submitting: false, passwordVisible: false, confirmPassword: '', confirmError: null, accepted: false, acceptError: false }));
  const step = Math.max(0, Math.min(ui.step, cfg.fields.length - 1));
  const field = cfg.fields[step];
  const isLast = step === cfg.fields.length - 1;

  function goBack() {
    if (step > 0) setUI(key, { step: step - 1, generalError: false });
    else routerGoBack('/escolha-perfil');
  }

  function setValue(v) {
    let value = v;
    if (field.mask === 'cpf') value = maskCPF(v);
    if (field.mask === 'cnpj') value = maskCNPJ(v);
    setUI(key, (s) => ({ values: Object.assign({}, s.values, { [field.id]: value }), errors: Object.assign({}, s.errors, { [field.id]: null }), generalError: false }));
  }

  function continueStep() {
    const err = validateField(field, ui.values, role);
    if (err) { setUI(key, (s) => ({ errors: Object.assign({}, s.errors, { [field.id]: err }) })); return; }
    if (!isLast) { setUI(key, { step: step + 1 }); return; }
    if (ui.confirmPassword !== ui.values.senha) { setUI(key, { confirmError: 'As senhas não são iguais. Confira os dois campos.' }); return; }
    if (!ui.accepted) { setUI(key, { acceptError: true }); return; }
    setUI(key, { submitting: true, acceptError: false });
    setTimeout(() => {
      if (TAKEN_DOC.indexOf(ui.values.doc) >= 0) {
        const docStep = cfg.fields.findIndex((f) => f.id === 'doc');
        setUI(key, { submitting: false, step: docStep, generalError: true });
        return;
      }
      setUI(key, { submitting: false });
      setUI('authFlow', { role, email: ui.values.email || 'voce@email.com' });
      resetUI(key);
      navigate('/verificar-email');
    }, 700);
  }

  const strength = passwordStrength(ui.values.senha);
  const strengthColor = strength === 3 ? 'bg-success-500' : strength ? 'bg-warning-500' : 'bg-concrete-200';
  const strengthTextColor = strength === 3 ? 'text-success-500' : strength ? 'text-warning-500' : 'text-concrete-500';

  const header = h('div', { class: 'sticky top-0 z-10 bg-white border-b border-concrete-200 px-2 pb-3' },
    h('div', { class: 'flex items-center gap-1.5 min-h-14' },
      IconButton({ icon: 'arrow-left', label: 'Voltar', onClick: goBack }),
      h('span', { class: 'flex-1 text-sm font-semibold text-concrete-500' }, `Passo ${step + 1} de ${cfg.fields.length}`)
    ),
    h('div', { class: 'h-1 mx-2 rounded-full bg-concrete-200 overflow-hidden' },
      h('div', { class: 'h-full bg-brand-500 rounded-full transition-all duration-200', style: { width: ((step + 1) / cfg.fields.length * 100) + '%' } })
    )
  );

  const generalErrorBox = ui.generalError ? h('div', { class: 'flex flex-col gap-3.5 p-4 bg-danger-50 border border-danger-500 rounded-card' },
    h('div', { class: 'flex gap-2.5 items-start' },
      h('span', { class: 'shrink-0 mt-0.5' }),
      h('div', { class: 'flex flex-col gap-1' },
        h('span', { class: 'font-semibold text-danger-500' }, role === 'recrutador' ? 'Esse CNPJ já tem conta na Bicos.' : 'Esse CPF já tem conta na Bicos.'),
        h('span', { class: 'text-sm text-concrete-700' }, 'Entre com o e-mail cadastrado ou recupere a senha. Se não foi você, fale com a gente pelo WhatsApp.')
      )
    ),
    h('div', { class: 'flex gap-2' },
      Button({ label: 'Entrar na conta', variant: 'secondary', size: 'sm', className: 'flex-1', onClick: () => navigate('/login') }),
      Button({ label: 'Recuperar senha', variant: 'ghost', size: 'sm', className: 'flex-1', onClick: () => navigate('/esqueci-senha') })
    )
  ) : null;

  const questionBlock = h('div', { class: 'flex flex-col gap-2.5' },
    h('span', { class: 'text-xs font-bold tracking-[0.08em] uppercase text-concrete-500' }, cfg.overline),
    h('h1', { class: 'font-display font-bold text-3xl text-concrete-900' }, field.question),
    h('p', { class: 'text-base text-concrete-700' }, field.help)
  );

  let fieldBlock;
  if (field.isPassword) {
    fieldBlock = h('div', { class: 'flex flex-col gap-5' },
      PasswordInput({
        id: key + '-senha', label: field.label, placeholder: field.placeholder, value: ui.values.senha || '',
        error: ui.errors.senha, visible: ui.passwordVisible, onToggleVisible: () => setUI(key, { passwordVisible: !ui.passwordVisible }),
        onInput: setValue
      }),
      PasswordInput({
        id: key + '-confirm', label: 'Confirme a senha', placeholder: 'Repita a senha', value: ui.confirmPassword,
        error: ui.confirmError, visible: ui.passwordVisible, onToggleVisible: () => setUI(key, { passwordVisible: !ui.passwordVisible }),
        onInput: (v) => setUI(key, { confirmPassword: v, confirmError: null })
      }),
      h('div', { class: 'flex flex-col gap-5' },
        h('div', { class: 'flex items-center gap-3' },
          h('span', { class: 'flex-1 h-1 rounded-full bg-concrete-200 overflow-hidden' },
            h('span', { class: `block h-full rounded-full ${strengthColor} transition-all`, style: { width: (strength / 3 * 100) + '%' } })
          ),
          h('span', { class: `text-sm whitespace-nowrap ${strengthTextColor}` }, STRENGTH_LABEL[strength] || 'Senha fraca')
        ),
        h('div', { class: 'flex flex-col gap-1 pt-1 border-t border-concrete-200' },
          Checkbox({ label: 'Li e aceito as condições de uso da Bicos', checked: ui.accepted, onChange: (v) => setUI(key, { accepted: v, acceptError: false }) }),
          h('div', { class: 'flex gap-4 pl-9' },
            h('a', { href: '#', class: 'text-sm text-brand-600 underline' }, 'Termos de uso'),
            h('a', { href: '#', class: 'text-sm text-brand-600 underline' }, 'Política de privacidade')
          ),
          ui.acceptError ? h('span', { class: 'flex items-center gap-2 pl-9 text-sm text-danger-500' }, 'Aceite as condições para criar sua conta.') : null
        )
      )
    );
  } else {
    fieldBlock = Input({
      id: key + '-' + field.id, label: field.label, placeholder: field.placeholder, icon: field.icon,
      type: field.type || 'text', value: ui.values[field.id] || '', error: ui.errors[field.id],
      mono: Boolean(field.mono), inputMode: field.mask ? 'numeric' : (field.type === 'email' ? 'email' : 'text'),
      onInput: setValue, autoFocus: true
    });
  }

  return h('div', { class: 'min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto lg:shadow-card lg:my-10 lg:rounded-card lg:overflow-hidden' },
    header,
    h('div', { class: 'flex-1 px-5 sm:px-8 py-8 flex flex-col gap-7 bg-concrete-50' },
      generalErrorBox, questionBlock, fieldBlock
    ),
    h('div', { class: 'px-5 sm:px-8 py-3 bg-white shadow-bar' },
      Button({ label: isLast ? 'Criar minha conta' : 'Continuar', size: 'lg', fullWidth: true, loading: ui.submitting, onClick: continueStep })
    )
  );
}
