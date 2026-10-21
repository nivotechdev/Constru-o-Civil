import { useEffect, useRef, useState } from 'react';
import { passwordProblem } from '../../utils/password';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { FieldError } from '../../components/FieldError';
import { GoogleButton, OrDivider } from '../../components/GoogleButton';
import { FlowHeading, FlowLayout, FlowProgress } from '../../components/FlowLayout';
import type { IconName } from '../../components/icons/Icon';
import { Input, PasswordInput } from '../../components/Input';
import { useUI } from '../../hooks/useStore';
import {
  completeGoogleSignUp,
  isFreeForSignUp,
  leaveGoogleSignUp,
  sendWhatsAppCode,
  signInWithGoogle,
  takeSignUpPhone,
  signUp,
  verifyWhatsAppCode,
  WHATSAPP_CODE_AVAILABLE,
  type SignUpCheck,
  prepareSocialSignIn
} from '../../services/auth';
import { TERMS_VERSION } from '../../services/legal';
import type { ScreenProps } from '../../types/screen';
import { FEATURES } from '../../services/features';
import { currentPath, goBack as routerGoBack, navigate } from '../../services/router';
import { resetUI, setUI } from '../../services/store';
import type { Role } from '../../types/models';
import { isValidEmail, maskCNPJ, maskCPF, isValidMobile, maskPhone } from '../../utils/format';
import { WhatsAppCode } from './WhatsAppCode';
import { useCaptcha } from '../../components/Captcha';
import { errorMessage, ServiceError } from '../../services/errors';
import { useGoogleSignUp } from '../../hooks/useGoogleSignUp';
import { isValidCnpj, isValidCpf } from '../../utils/document';
import { PasswordStrength } from '../../components/PasswordStrength';

type FieldId = 'nome' | 'razao' | 'responsavel' | 'doc' | 'email' | 'whatsapp' | 'codigo' | 'senha';

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
  help: 'Digite o código de 6 números que mandamos no seu WhatsApp.',
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
      { ...COMUM_EMAIL, help: 'Use um e-mail que você abre: é com ele que você entra e recupera a senha.' },
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
        id: 'responsavel',
        label: 'Seu nome',
        question: 'Quem vai falar com os candidatos?',
        help: 'Quem você aprovar vê "Fale com" e esse nome no botão do WhatsApp.',
        placeholder: 'Ana Souza',
        icon: 'user'
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
      { ...COMUM_EMAIL, help: 'Use um e-mail que você abre: é com ele que você entra e recupera a senha.' },
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
  submitting: boolean;
  passwordVisible: boolean;
  accepted: boolean;
  acceptError: boolean;
  /** L14: the terms require 18+. */
  adult: boolean;
  adultError: boolean;
  /** When the last WhatsApp code was sent (ms), for the resend countdown. */
  codeSentAt: number;
  resending: boolean;
  resent: boolean;
  /** A request failed (no connection…): shown above the button, the answers stay. */
  submitError: string | null;
  /** U10: the step whose e-mail or CPF/CNPJ already has an account (offers "Entrar" and "Recuperar senha"). */
  taken: FieldId | null;
}

/** U10: the steps checked against the other accounts as soon as they are filled in. */
const CHECKED: Partial<Record<FieldId, SignUpCheck>> = { doc: 'documento', email: 'email', whatsapp: 'whatsapp' };

function takenMessage(id: FieldId, value: string): string {
  if (id === 'email') return 'Esse e-mail já tem conta na Bicos. Entre na conta ou use outro e-mail.';
  if (id === 'whatsapp') return 'Esse WhatsApp já está em outra conta da Bicos. Use outro número.';
  return `Esse ${value.replace(/\D/g, '').length === 14 ? 'CNPJ' : 'CPF'} já tem conta na Bicos. Entre na conta ou recupere a senha.`;
}

function validateField(field: SignupField, values: Values, role: Role): string | null {
  const v = String(values[field.id] || '').trim();
  if (field.id === 'nome') {
    if (!v) return 'Informe o nome completo.';
    if (v.split(/\s+/).length < 2) return 'Informe nome e sobrenome.';
    return null;
  }
  if (field.id === 'razao') return v.length < 3 ? 'Informe o nome da empresa.' : null;
  if (field.id === 'responsavel')
    return v.length < 2 ? 'Escreva seu nome.' : v.length > 60 ? 'Use até 60 caracteres.' : null;
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
  if (field.id === 'senha') return passwordProblem(v);
  return null;
}

/**
 * The steps of the form. Without a WhatsApp provider to send the code (see WHATSAPP_CODE_AVAILABLE), the
 * code step is left out and the number is kept as typed (not marked as confirmed). U37: started with Google, the
 * e-mail step is left out too (Google already confirmed it, so there is no e-mail code either); everything else is
 * the same screen as the plain sign-up (U40).
 */
function signupSteps(role: Role, google: boolean): { overline: string; fields: SignupField[] } {
  const cfg = PERFIS[role];
  return {
    ...cfg,
    fields: cfg.fields
      .filter((f) => (WHATSAPP_CODE_AVAILABLE || f.id !== 'codigo') && !(google && f.id === 'email'))
      .map((f) => {
        if (f.id === 'whatsapp' && f.help && !WHATSAPP_CODE_AVAILABLE)
          return { ...f, help: f.help.replace(/ Vamos mandar um código[^.]*\./, '') };
        return f;
      })
  };
}

export default function Signup({ params }: ScreenProps) {
  // U29: Firebase ready before the tap (the Google window must open inside it).
  useEffect(prepareSocialSignIn, []);
  const captcha = useCaptcha();
  const role: Role = params.role === 'recrutador' ? 'recrutador' : 'trabalhador';
  const key = 'cadastro-' + role;
  // U37: a Google login without its account: the same steps, without the e-mail ones.
  const google = useGoogleSignUp();
  const cfg = signupSteps(role, Boolean(google));
  const [ui, setUi] = useUI<SignupUI>(key, () => ({
    step: 0,
    // U28: a number confirmed by SMS that had no account comes filled in.
    values: ((phone) => (phone ? { whatsapp: maskPhone(phone) } : {}))(takeSignUpPhone()),
    errors: {},
    submitting: false,
    passwordVisible: false,
    accepted: false,
    acceptError: false,
    adult: false,
    adultError: false,
    codeSentAt: 0,
    resending: false,
    resent: false,
    submitError: null,
    taken: null
  }));
  // Y22: the password only lives in this screen (never in the shared store), and the draft (name,
  // document, e-mail…) is forgotten when the flow is left — except for a look at the terms.
  const [password, setPassword] = useState('');
  const values: Values = { ...ui.values, senha: password };
  // U37: the name comes from Google (the person's: the worker's full name, the company's contact), still editable.
  const googleName = google?.name ?? '';
  useEffect(() => {
    if (!googleName) return;
    const nameField: FieldId = role === 'trabalhador' ? 'nome' : 'responsavel';
    setUi((s) => (s.values[nameField] ? {} : { values: { ...s.values, [nameField]: googleName } }));
  }, [googleName, role, setUi]);
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
    if (step > 0) setUi({ step: step - 1, submitError: null });
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
      setUi((s) => ({ errors: { ...s.errors, senha: null }, submitError: null }));
      return;
    }
    setUi((s) => ({
      values: { ...s.values, [field.id]: value },
      errors: { ...s.errors, [field.id]: null },
      submitError: null,
      taken: null
    }));
  }

  function continueStep() {
    if (ui.submitting) return; // Enter while the account is being created
    const err = validateField(field, values, role);
    if (err) {
      setUi((s) => ({ errors: { ...s.errors, [field.id]: err } }));
      return;
    }
    // U10: an e-mail, CPF/CNPJ or WhatsApp that already has an account stops the sign-up right here.
    const check = CHECKED[field.id];
    if (check) {
      const value = ui.values[field.id] || '';
      setUi({ submitting: true, submitError: null, taken: null });
      isFreeForSignUp(check, value)
        .then((free) => {
          if (free) {
            setUi({ submitting: false });
            advance();
            return;
          }
          setUi((s) => ({
            submitting: false,
            taken: field.id === 'whatsapp' ? null : field.id,
            errors: { ...s.errors, [field.id]: takenMessage(field.id, value) }
          }));
        })
        .catch((e: unknown) => setUi({ submitting: false, submitError: errorMessage(e) }));
      return;
    }
    advance();
  }

  /** The step is filled in and checked: send the code, check it, go on, or create the account. */
  function advance() {
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
    if (!ui.adult || !ui.accepted) {
      setUi({ adultError: !ui.adult, acceptError: !ui.accepted });
      return;
    }
    setUi({ submitting: true, acceptError: false, adultError: false, submitError: null });
    if (google) {
      finishWithGoogle();
      return;
    }
    signUp(
      {
        role,
        name: (role === 'trabalhador' ? ui.values.nome : ui.values.razao) || '',
        doc: ui.values.doc || '',
        email: ui.values.email || '',
        whatsapp: ui.values.whatsapp || '',
        password,
        acceptedTermsVersion: TERMS_VERSION,
        adult: true,
        ...(role === 'recrutador' ? { contactName: (ui.values.responsavel || '').trim() } : {})
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
          refused();
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

  /** U37: the last step of a Google sign-up — the account is created on the Google login (no e-mail to confirm). */
  function finishWithGoogle() {
    completeGoogleSignUp({
      role,
      name: (role === 'trabalhador' ? ui.values.nome : ui.values.razao) || '',
      doc: ui.values.doc || '',
      whatsapp: ui.values.whatsapp || '',
      password,
      acceptedTermsVersion: TERMS_VERSION,
      adult: true,
      ...(role === 'recrutador' ? { contactName: (ui.values.responsavel || '').trim() } : {})
    })
      .then(() => {
        resetUI(key);
        navigate('/completar-perfil/' + role, { replace: true });
      })
      .catch((e: unknown) => {
        if (e instanceof ServiceError && e.code === 'conflito') {
          refused();
          return;
        }
        setUi({ submitting: false, submitError: errorMessage(e) });
      });
  }

  /**
   * The server refused the account without saying why (it would reveal whose the CPF/CNPJ is): back to the document
   * step, with the message under the field and "Entrar na conta" / "Recuperar senha" (U41: no big red card).
   */
  function refused() {
    const docStep = cfg.fields.findIndex((f) => f.id === 'doc');
    const doc = role === 'recrutador' ? 'esse CNPJ ou CPF' : 'esse CPF';
    setUi((s) => ({
      submitting: false,
      step: docStep,
      taken: 'doc',
      errors: {
        ...s.errors,
        doc: `Não deu para criar a conta com ${doc}. Se você já tem conta na Bicos, entre ou recupere a senha.`
      }
    }));
  }

  /** U40: "Entrar na conta" / "Recuperar senha" from the middle of a Google sign-up end the pending Google login. */
  function leaveTo(path: string) {
    if (google) void leaveGoogleSignUp();
    navigate(path);
  }

  return (
    <FlowLayout
      header={<FlowProgress step={step} total={cfg.fields.length} onBack={goBack} />}
      footer={
        <>
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
          {/* U18/U37: on the first step, the other way in — Google brings the e-mail, already confirmed. */}
          {step === 0 && FEATURES.googleLogin && !google ? (
            <>
              <OrDivider />
              <GoogleButton
                onClick={() => signInWithGoogle(role).catch((e: unknown) => setUi({ submitError: errorMessage(e) }))}
              />
            </>
          ) : null}
        </>
      }
    >
      <FlowHeading overline={cfg.overline} title={field.question} help={field.help} />
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
        // U41: one password field with the eye (no "repeat the password"), its strength in one line and the two
        // agreements with the links inside their own text — the whole step fits the screen.
        <div className="flex flex-col gap-4 short:gap-3">
          <div className="flex flex-col gap-2">
            <PasswordInput
              id={key + '-senha'}
              label={field.label}
              placeholder={field.placeholder}
              value={password}
              error={ui.errors.senha}
              visible={ui.passwordVisible}
              onToggleVisible={() => setUi({ passwordVisible: !ui.passwordVisible })}
              autoComplete="new-password"
              onInput={setValue}
              onEnter={continueByEnter}
            />
            <PasswordStrength password={password} />
          </div>
          <div className="flex flex-col pt-1 border-t border-concrete-200">
            <Checkbox
              label="Tenho 18 anos ou mais"
              checked={ui.adult}
              onChange={(v) => setUi({ adult: v, adultError: false })}
            />
            {ui.adultError ? (
              <span className="pl-9 -mt-1 text-sm text-danger-500">A Bicos é só para maiores de 18 anos.</span>
            ) : null}
            <Checkbox
              label={
                <>
                  Li e aceito os <DocLink path="/termos">Termos de uso</DocLink> e a{' '}
                  <DocLink path="/privacidade">Política de privacidade</DocLink>
                </>
              }
              checked={ui.accepted}
              onChange={(v) => setUi({ accepted: v, acceptError: false })}
            />
            {ui.acceptError ? (
              <span className="pl-9 -mt-1 text-sm text-danger-500">Aceite as condições para criar sua conta.</span>
            ) : null}
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
          autoComplete={fieldAutoComplete(field, role)}
          onInput={setValue}
          onEnter={continueByEnter}
          autoFocus
        />
      )}
      {ui.taken === field.id ? (
        <div className="flex gap-2 -mt-2 short:-mt-1">
          <Button
            label="Entrar na conta"
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => leaveTo('/login')}
          />
          <Button
            label="Recuperar senha"
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => leaveTo('/esqueci-senha')}
          />
        </div>
      ) : null}
    </FlowLayout>
  );
}

/** X04: what the browser may fill in each step (documents never: it would offer someone else's). */
function fieldAutoComplete(field: SignupField, role: Role): string | undefined {
  if (field.type === 'email') return 'email';
  if (field.mask === 'phone') return 'tel';
  if (field.mask) return 'off';
  if (field.id === 'nome') return role === 'recrutador' ? 'organization' : 'name';
  if (field.id === 'responsavel') return 'name';
  return undefined;
}

/** A link to the terms or the privacy policy inside an agreement's text: opens it without ticking the box. */
function DocLink({ path, children }: { path: string; children: string }) {
  return (
    <button
      type="button"
      className="font-semibold text-brand-600 underline underline-offset-2"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(path);
      }}
    >
      {children}
    </button>
  );
}
