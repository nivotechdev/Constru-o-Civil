import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { FieldError } from '../../components/FieldError';
import { IconButton } from '../../components/IconButton';
import type { IconName } from '../../components/icons/Icon';
import { Input, PasswordInput } from '../../components/Input';
import { useUI } from '../../hooks/useStore';
import { sendWhatsAppCode, signUp, verifyWhatsAppCode, WHATSAPP_CODE_AVAILABLE } from '../../services/auth';
import { TERMS_VERSION } from '../../services/legal';
import type { ScreenProps } from '../../types/screen';
import { currentPath, goBack as routerGoBack, navigate } from '../../services/router';
import { resetUI, setUI } from '../../services/store';
import type { Role } from '../../types/models';
import {
  isValidEmail,
  maskCNPJ,
  maskCPF,
  isValidMobile,
  maskPhone,
  passwordStrength,
  STRENGTH_LABEL,
  strengthBarColor
} from '../../utils/format';
import { WhatsAppCode } from './WhatsAppCode';
import { useCaptcha } from '../../components/Captcha';
import { errorMessage } from '../../services/errors';
import { isValidCnpj, isValidCpf } from '../../utils/document';

type FieldId = 'nome' | 'razao' | 'doc' | 'email' | 'whatsapp' | 'codigo' | 'senha';

interface SignupField {
  id: FieldId;
  label: string;
  question: string;
  help: string;
  placeholder: string;
  icon?: IconName;
  type?: string;
  mask?: 'cpf' | 'cnpj' | 'cpfCnpj' | 'phone';
  /** The WhatsApp confirmation code step. */
  isCode?: boolean;
  mono?: boolean;
  isPassword?: boolean;
}

const COMUM_EMAIL = {
  id: 'email',
  label: 'E-mail',
  question: 'Qual é o seu e-mail?',
  placeholder: 'voce@email.com',
  icon: 'mail',
  type: 'email'
} as const;
const COMUM_WHATSAPP = {
  id: 'whatsapp',
  label: 'WhatsApp',
  question: 'Qual é o seu WhatsApp?',
  placeholder: '(11) 90000-0000',
  icon: 'message-circle',
  type: 'tel',
  mask: 'phone',
  mono: true
} as const;
const COMUM_CODIGO: SignupField = {
  id: 'codigo',
  label: 'Código',
  question: 'Confirme seu WhatsApp',
  help: 'Mandamos uma mensagem no WhatsApp com um código de 6 números. Digite o código abaixo.',
  placeholder: '',
  isCode: true
};
const COMUM_SENHA: SignupField = {
  id: 'senha',
  label: 'Senha',
  question: 'Crie uma senha',
  help: 'Use 8 caracteres ou mais, misturando letras e números.',
  placeholder: 'Sua senha',
  isPassword: true
};

const PERFIS: Record<Role, { overline: string; fields: SignupField[] }> = {
  trabalhador: {
    overline: 'Cadastro de trabalhador',
    fields: [
      {
        id: 'nome',
        label: 'Nome completo',
        question: 'Como você se chama?',
        help: 'Escreva o nome completo, igual ao do seu RG ou CNH.',
        placeholder: 'Jorge Mendes da Silva',
        icon: 'user'
      },
      {
        id: 'doc',
        label: 'CPF',
        question: 'Qual é o seu CPF?',
        help: 'Serve para conferir sua identidade. A construtora não vê esse número.',
        placeholder: '000.000.000-00',
        icon: 'id-card',
        mask: 'cpf',
        mono: true
      },
      { ...COMUM_EMAIL, help: 'É por aqui que avisamos quando uma construtora escolher você.' },
      {
        ...COMUM_WHATSAPP,
        help: 'É por ele que as construtoras falam com você. Vamos mandar um código para confirmar o número.'
      },
      COMUM_CODIGO,
      COMUM_SENHA
    ]
  },
  recrutador: {
    overline: 'Cadastro de recrutador',
    fields: [
      {
        id: 'razao',
        label: 'Nome da empresa',
        question: 'Qual é o nome da empresa?',
        help: 'É esse nome que aparece no seu perfil e nas vagas que você publicar.',
        placeholder: 'Meridiano Construções',
        icon: 'building-2'
      },
      {
        id: 'doc',
        label: 'CNPJ ou CPF',
        question: 'Qual é o CNPJ da empresa?',
        help: 'Trabalha por conta própria? Use seu CPF. O CPF nunca aparece no perfil; do CNPJ, só o começo.',
        placeholder: '00.000.000/0000-00',
        icon: 'id-card',
        mask: 'cpfCnpj',
        mono: true
      },
      { ...COMUM_EMAIL, help: 'É por aqui que avisamos cada novo candidato da sua vaga.' },
      {
        ...COMUM_WHATSAPP,
        help: 'É por ele que os candidatos falam com a empresa. Vamos mandar um código para confirmar o número.'
      },
      COMUM_CODIGO,
      COMUM_SENHA
    ]
  }
};

type Values = Partial<Record<FieldId, string>>;

interface SignupUI {
  step: number;
  values: Values;
  errors: Partial<Record<FieldId, string | null>>;
  generalError: boolean;
  submitting: boolean;
  passwordVisible: boolean;
  confirmError: string | null;
  accepted: boolean;
  acceptError: boolean;
  /** When the last WhatsApp code was sent (ms), for the resend countdown. */
  codeSentAt: number;
  resending: boolean;
  resent: boolean;
  /** A request failed (no connection…): shown above the button, the answers stay. */
  submitError: string | null;
}

function validateField(field: SignupField, values: Values, role: Role): string | null {
  const v = String(values[field.id] || '').trim();
  if (field.id === 'nome') {
    if (!v) return 'Informe o nome completo.';
    if (v.split(/\s+/).length < 2) return 'Informe nome e sobrenome.';
    return null;
  }
  if (field.id === 'razao') return v.length < 3 ? 'Informe o nome da empresa.' : null;
  if (field.id === 'doc') {
    // Y17: the check digits too (the server refuses the same documents).
    if (role === 'recrutador')
      return isValidCnpj(v) || isValidCpf(v) ? null : 'CNPJ ou CPF inválido. Confira os números.';
    return isValidCpf(v) ? null : 'CPF inválido. Confira os 11 números.';
  }
  if (field.id === 'email') return isValidEmail(v) ? null : 'E-mail inválido. Confira se tem @ e o domínio.';
  if (field.id === 'whatsapp') {
    return isValidMobile(v) ? null : 'Número inválido. Use o celular com DDD (11 números).';
  }
  if (field.id === 'codigo') return /^\d{6}$/.test(v) ? null : 'Digite os 6 números do código.';
  if (field.id === 'senha') {
    if (v.length < 8) return 'Senha curta. Use 8 caracteres ou mais.';
    if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return 'Misture letras e números na senha.';
    return null;
  }
  return null;
}

/**
 * The steps of the form. Without a WhatsApp provider to send the code (see WHATSAPP_CODE_AVAILABLE), the
 * code step is left out and the number is kept as typed (not marked as confirmed).
 */
function signupSteps(role: Role): { overline: string; fields: SignupField[] } {
  const cfg = PERFIS[role];
  if (WHATSAPP_CODE_AVAILABLE) return cfg;
  return {
    ...cfg,
    fields: cfg.fields
      .filter((f) => f.id !== 'codigo')
      .map((f) =>
        f.id === 'whatsapp' && f.help ? { ...f, help: f.help.replace(/ Vamos mandar um código[^.]*\./, '') } : f
      )
  };
}

export default function Signup({ params }: ScreenProps) {
  const captcha = useCaptcha();
  const role: Role = params.role === 'recrutador' ? 'recrutador' : 'trabalhador';
  const key = 'cadastro-' + role;
  const cfg = signupSteps(role);
  const [ui, setUi] = useUI<SignupUI>(key, () => ({
    step: 0,
    values: {},
    errors: {},
    generalError: false,
    submitting: false,
    passwordVisible: false,
    confirmError: null,
    accepted: false,
    acceptError: false,
    codeSentAt: 0,
    resending: false,
    resent: false,
    submitError: null
  }));
  // Y22: the password only lives in this screen (never in the shared store), and the draft (name,
  // document, e-mail…) is forgotten when the flow is left — except for a look at the terms.
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const values: Values = { ...ui.values, senha: password };
  useEffect(
    () => () => {
      const to = currentPath();
      if (!['/termos', '/privacidade', '/cadastro/' + role].includes(to)) resetUI(key);
    },
    [key, role]
  );
  const step = Math.max(0, Math.min(ui.step, cfg.fields.length - 1));
  const field = cfg.fields[step];
  const isLast = step === cfg.fields.length - 1;
  const fieldDomId = key + '-' + (field.isPassword ? 'senha' : field.id);

  // Enter moves to the next step: put the caret in its field so the keyboard flow continues.
  const advancedByEnter = useRef(false);
  useEffect(() => {
    if (!advancedByEnter.current) return;
    advancedByEnter.current = false;
    document.getElementById(fieldDomId)?.focus();
  }, [fieldDomId]);
  const continueByEnter = () => {
    advancedByEnter.current = true;
    continueStep();
  };

  function resendCode() {
    if (ui.resending) return;
    setUi({ resending: true, submitError: null });
    sendWhatsAppCode(ui.values.whatsapp || '', captcha.getToken)
      .then(() =>
        setUi((s) => ({
          resending: false,
          resent: true,
          codeSentAt: Date.now(),
          values: { ...s.values, codigo: '' },
          errors: { ...s.errors, codigo: null }
        }))
      )
      .catch((e: unknown) => setUi({ resending: false, submitError: errorMessage(e) }));
  }

  function goBack() {
    if (step > 0) setUi({ step: step - 1, generalError: false, submitError: null });
    else routerGoBack('/escolha-perfil');
  }

  function setValue(v: string) {
    let value = v;
    if (field.mask === 'cpf') value = maskCPF(v);
    if (field.mask === 'cnpj') value = maskCNPJ(v);
    if (field.mask === 'cpfCnpj') value = v.replace(/\D/g, '').length > 11 ? maskCNPJ(v) : maskCPF(v);
    if (field.mask === 'phone') value = maskPhone(v);
    if (field.id === 'senha') {
      setPassword(value);
      setUi((s) => ({ errors: { ...s.errors, senha: null }, generalError: false, submitError: null }));
      return;
    }
    setUi((s) => ({
      values: { ...s.values, [field.id]: value },
      errors: { ...s.errors, [field.id]: null },
      generalError: false,
      submitError: null
    }));
  }

  function continueStep() {
    if (ui.submitting) return; // Enter while the account is being created
    const err = validateField(field, values, role);
    if (err) {
      setUi((s) => ({ errors: { ...s.errors, [field.id]: err } }));
      return;
    }
    if (field.id === 'whatsapp' && WHATSAPP_CODE_AVAILABLE) {
      setUi({ submitting: true, submitError: null });
      sendWhatsAppCode(ui.values.whatsapp || '', captcha.getToken)
        .then(() =>
          setUi((s) => ({
            submitting: false,
            step: step + 1,
            codeSentAt: Date.now(),
            resent: false,
            values: { ...s.values, codigo: '' },
            errors: { ...s.errors, codigo: null }
          }))
        )
        .catch((e: unknown) => setUi({ submitting: false, submitError: errorMessage(e) }));
      return;
    }
    if (field.id === 'codigo') {
      setUi({ submitting: true, submitError: null });
      verifyWhatsAppCode(ui.values.whatsapp || '', ui.values.codigo || '')
        .then((ok) =>
          setUi((s) =>
            ok
              ? { submitting: false, step: step + 1 }
              : {
                  submitting: false,
                  errors: { ...s.errors, codigo: 'Código incorreto. Confira a mensagem no WhatsApp e tente de novo.' }
                }
          )
        )
        .catch((e: unknown) => setUi({ submitting: false, submitError: errorMessage(e) }));
      return;
    }
    if (!isLast) {
      setUi({ step: step + 1 });
      return;
    }
    if (confirmPassword !== password) {
      setUi({ confirmError: 'As senhas não são iguais. Confira os dois campos.' });
      return;
    }
    if (!ui.accepted) {
      setUi({ acceptError: true });
      return;
    }
    setUi({ submitting: true, acceptError: false, submitError: null });
    signUp(
      {
        role,
        name: (role === 'trabalhador' ? ui.values.nome : ui.values.razao) || '',
        doc: ui.values.doc || '',
        email: ui.values.email || '',
        whatsapp: ui.values.whatsapp || '',
        password,
        acceptedTermsVersion: TERMS_VERSION
      },
      captcha.getToken
    )
      .then((result) => {
        if (!result.ok && result.reason === 'email-taken') {
          const emailStep = cfg.fields.findIndex((f) => f.id === 'email');
          setUi((s) => ({
            submitting: false,
            step: emailStep,
            errors: { ...s.errors, email: 'Esse e-mail já tem conta na Bicos. Entre na conta ou use outro e-mail.' }
          }));
          return;
        }
        if (!result.ok) {
          // Refused without a reason (it would reveal whether the CPF/CNPJ has an account): back to the
          // document step, with the general error.
          const docStep = cfg.fields.findIndex((f) => f.id === 'doc');
          setUi({ submitting: false, step: docStep, generalError: true });
          return;
        }
        // The account now exists and is logged in; the route guard takes it to "Confirme seu e-mail".
        resetUI(key);
        setUI<{ fromSignup: boolean }>('verificar-email', { fromSignup: true });
        navigate('/verificar-email', { replace: true });
      })
      // Y20: the service's own message (no internet, too many attempts, weak password…).
      .catch((e: unknown) => setUi({ submitting: false, submitError: errorMessage(e) }));
  }

  const strength = passwordStrength(password);
  const strengthColor = strengthBarColor(strength);
  const strengthTextColor = strength === 3 ? 'text-success-500' : strength ? 'text-warning-500' : 'text-concrete-500';

  return (
    <div className="min-h-screen flex flex-col bg-white lg:min-h-0 lg:h-[calc(100vh-5rem)] lg:max-w-app lg:mx-auto lg:shadow-card lg:my-10 lg:rounded-card lg:overflow-hidden">
      <div className="sticky top-0 z-10 bg-white border-b border-concrete-200 px-2 pb-3">
        <div className="flex items-center gap-1.5 min-h-14">
          <IconButton icon="arrow-left" label="Voltar" onClick={goBack} />
          <span className="flex-1 text-sm font-semibold text-concrete-500">{`Passo ${step + 1} de ${cfg.fields.length}`}</span>
        </div>
        <div className="h-1 mx-2 rounded-full bg-concrete-200 overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-200"
            style={{ width: ((step + 1) / cfg.fields.length) * 100 + '%' }}
          />
        </div>
      </div>
      <div className="flex-1 px-5 sm:px-8 py-8 flex flex-col gap-7 bg-concrete-50 lg:min-h-0 lg:overflow-y-auto">
        {ui.generalError ? (
          <div className="flex flex-col gap-3.5 p-4 bg-danger-50 border border-danger-500 rounded-card">
            <div className="flex gap-2.5 items-start">
              <span className="shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-danger-500">Não deu para criar a conta com esses dados.</span>
                <span className="text-sm text-concrete-700">
                  {`Confira o ${role === 'recrutador' ? 'CNPJ ou CPF' : 'CPF'} e o e-mail. Se você já tem conta na Bicos, entre ou recupere a senha. Se não foi você quem criou, fale com a gente pelo WhatsApp.`}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                label="Entrar na conta"
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => navigate('/login')}
              />
              <Button
                label="Recuperar senha"
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => navigate('/esqueci-senha')}
              />
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">{cfg.overline}</span>
          <h1 className="font-display font-bold text-3xl text-concrete-900">{field.question}</h1>
          <p className="text-base text-concrete-700">{field.help}</p>
        </div>
        {field.isCode ? (
          <WhatsAppCode
            id={fieldDomId}
            phone={ui.values.whatsapp || ''}
            code={ui.values.codigo || ''}
            error={ui.errors.codigo}
            sentAt={ui.codeSentAt}
            resending={ui.resending}
            resent={ui.resent}
            onCode={setValue}
            onEnter={continueByEnter}
            onResend={resendCode}
            onEditNumber={goBack}
          />
        ) : field.isPassword ? (
          <div className="flex flex-col gap-5">
            <PasswordInput
              id={key + '-senha'}
              label={field.label}
              placeholder={field.placeholder}
              value={password}
              error={ui.errors.senha}
              visible={ui.passwordVisible}
              onToggleVisible={() => setUi({ passwordVisible: !ui.passwordVisible })}
              onInput={setValue}
              onEnter={continueByEnter}
            />
            <PasswordInput
              id={key + '-confirm'}
              label="Confirme a senha"
              placeholder="Repita a senha"
              value={confirmPassword}
              error={ui.confirmError}
              visible={ui.passwordVisible}
              onToggleVisible={() => setUi({ passwordVisible: !ui.passwordVisible })}
              onInput={(v) => {
                setConfirmPassword(v);
                setUi({ confirmError: null });
              }}
              onEnter={continueByEnter}
            />
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="flex-1 h-1 rounded-full bg-concrete-200 overflow-hidden">
                  <span
                    className={`block h-full rounded-full ${strengthColor} transition-all`}
                    style={{ width: (strength / 3) * 100 + '%' }}
                  />
                </span>
                <span className={`text-sm whitespace-nowrap ${strengthTextColor}`}>
                  {STRENGTH_LABEL[strength] || 'Senha fraca'}
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-1 border-t border-concrete-200">
                <Checkbox
                  label="Li e aceito os Termos de uso e a Política de privacidade"
                  checked={ui.accepted}
                  onChange={(v) => setUi({ accepted: v, acceptError: false })}
                />
                <div className="flex gap-4 pl-9">
                  <button
                    type="button"
                    className="text-sm text-brand-600 underline"
                    onClick={() => navigate('/termos')}
                  >
                    Termos de uso
                  </button>
                  <button
                    type="button"
                    className="text-sm text-brand-600 underline"
                    onClick={() => navigate('/privacidade')}
                  >
                    Política de privacidade
                  </button>
                </div>
                {ui.acceptError ? (
                  <span className="flex items-center gap-2 pl-9 text-sm text-danger-500">
                    Aceite as condições para criar sua conta.
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <Input
            key={field.id}
            id={key + '-' + field.id}
            label={field.label}
            placeholder={field.placeholder}
            icon={field.icon}
            type={field.type || 'text'}
            value={ui.values[field.id] || ''}
            error={ui.errors[field.id]}
            mono={Boolean(field.mono)}
            inputMode={
              field.mask === 'phone' ? 'tel' : field.mask ? 'numeric' : field.type === 'email' ? 'email' : 'text'
            }
            onInput={setValue}
            onEnter={continueByEnter}
            autoFocus
          />
        )}
      </div>
      <div className="px-5 sm:px-8 py-3 bg-white shadow-bar flex flex-col gap-2">
        {captcha.widget}
        {ui.submitError ? <FieldError message={ui.submitError} /> : null}
        <Button
          label={
            isLast
              ? 'Criar minha conta'
              : field.id === 'whatsapp' && WHATSAPP_CODE_AVAILABLE
                ? 'Enviar código'
                : field.isCode
                  ? 'Confirmar número'
                  : 'Continuar'
          }
          size="lg"
          fullWidth
          loading={ui.submitting}
          onClick={continueStep}
        />
      </div>
    </div>
  );
}
