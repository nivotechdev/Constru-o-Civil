// "Confirme seu e-mail" (U11): the 6-number code sent to the e-mail of the new account. The code is typed or
// pasted in one go ("Colar código", or the phone's own paste/autofill) and checks itself when the sixth
// number is in; then the account goes on to completing the profile. A wrong address is fixed right here:
// the new one gets the code and the sign-up doesn't start over.
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { useCaptcha } from '../../components/Captcha';
import { CodeInput } from '../../components/CodeInput';
import { FieldError } from '../../components/FieldError';
import { FlowBar, FlowHeading, FlowLayout, FlowSignOut } from '../../components/FlowLayout';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { useSession, useScreenUI } from '../../hooks/useStore';
import {
  canChangePendingEmail,
  changePendingEmail,
  resendConfirmationEmail,
  signOut,
  verifyEmailCode
} from '../../services/auth';
import { errorMessage } from '../../services/errors';
import { homeFor } from '../../services/guards';
import { IS_DEMO } from '../../services/mode';
import { navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { getSession, resetUI } from '../../services/store';
import { CODE_LENGTH } from '../../utils/code';
import { isValidEmail } from '../../utils/format';

interface VerifyEmailUI {
  /** Came straight from the sign-up (the code was just sent). */
  fromSignup: boolean;
  code: string;
  codeError: string | null;
  confirming: boolean;
  resending: boolean;
  /** The address the last new code went to (shown as "Enviamos um novo código para…"). */
  resentTo: string | null;
  /** When the last code was sent (ms): "Reenviar" unlocks 60 s later. */
  sentAt: number;
  /** "Corrigir e-mail" open, with what is being typed. */
  editing: boolean;
  newEmail: string;
  newEmailError: string | null;
  changing: boolean;
  error: string | null;
}

const DEFAULTS: VerifyEmailUI = {
  fromSignup: false,
  code: '',
  codeError: null,
  confirming: false,
  resending: false,
  resentTo: null,
  sentAt: 0,
  editing: false,
  newEmail: '',
  newEmailError: null,
  changing: false,
  error: null
};
const RESEND_SECONDS = 60;

export default function VerifyEmail() {
  const session = useSession();
  const captcha = useCaptcha();
  const [stored, setUi] = useScreenUI<VerifyEmailUI>('verificar-email', DEFAULTS);
  // The sign-up opens this screen with only `fromSignup` set: the rest comes from the defaults.
  const ui: VerifyEmailUI = { ...DEFAULTS, ...stored };
  const [mountedAt] = useState(() => Date.now());
  const email = session?.email ?? '';
  // Counted from the sign-up (the first code) or the last one sent.
  const wait = useSecondsLeft(ui.sentAt || (ui.fromSignup ? mountedAt : 0), RESEND_SECONDS);

  function confirm(code = ui.code) {
    if (ui.confirming) return;
    if (code.length !== CODE_LENGTH) {
      setUi({ codeError: 'Digite os 6 números do código.' });
      return;
    }
    setUi({ confirming: true, codeError: null, error: null });
    verifyEmailCode(email, code)
      .then(() => {
        resetUI('verificar-email');
        const next = getSession();
        if (next) navigate(homeFor(next), { replace: true });
      })
      .catch((e: unknown) => setUi({ confirming: false, code: '', codeError: errorMessage(e) }));
  }

  function typed(code: string) {
    setUi({ code, codeError: null, error: null });
    // The sixth number (or a pasted code) checks it right away.
    if (code.length === CODE_LENGTH && code !== ui.code) confirm(code);
  }

  function resend() {
    if (ui.resending || wait > 0) return;
    setUi({ resending: true, resentTo: null, error: null });
    resendConfirmationEmail(email)
      .then(() => setUi({ resending: false, resentTo: email, sentAt: Date.now(), code: '', codeError: null }))
      .catch((e: unknown) => setUi({ resending: false, error: errorMessage(e) }));
  }

  /** Without the sign-up in memory (the page was reloaded), fixing the address means signing up again. */
  function startOver() {
    const role = session?.role ?? 'trabalhador';
    void signOut()
      .catch(() => undefined)
      .then(() => navigate('/cadastro/' + role, { replace: true }));
  }

  function changeEmail() {
    if (ui.changing) return;
    const next = ui.newEmail.trim();
    if (!isValidEmail(next)) {
      setUi({ newEmailError: 'E-mail inválido. Confira se tem @ e o domínio.' });
      return;
    }
    setUi({ changing: true, newEmailError: null, error: null });
    changePendingEmail(next, captcha.getToken)
      .then((result) => {
        if (!result.ok) {
          setUi({
            changing: false,
            newEmailError:
              result.reason === 'email-taken'
                ? 'Esse e-mail já tem conta na Bicos. Use outro ou entre na conta.'
                : 'Não deu para usar esse e-mail. Confira e tente de novo.'
          });
          return;
        }
        setUi({
          changing: false,
          editing: false,
          newEmail: '',
          code: '',
          codeError: null,
          resentTo: next.toLowerCase(),
          sentAt: Date.now()
        });
      })
      .catch((e: unknown) => setUi({ changing: false, newEmailError: errorMessage(e) }));
  }

  return (
    <FlowLayout
      // U41: the way out ("Sair") on top, so the bottom holds only the main button and the screen never scrolls.
      header={<FlowBar title="Criar minha conta" action={<FlowSignOut onClick={askSignOut} />} />}
      footer={
        <>
          {captcha.widget}
          {ui.error ? <FieldError message={ui.error} /> : null}
          {ui.editing ? (
            <Button
              label="Enviar código para o novo e-mail"
              size="lg"
              fullWidth
              iconLeft="mail"
              loading={ui.changing}
              onClick={changeEmail}
            />
          ) : (
            <Button label="Confirmar e-mail" size="lg" fullWidth loading={ui.confirming} onClick={() => confirm()} />
          )}
        </>
      }
    >
      <FlowHeading
        overline="Falta pouco"
        title="Confirme seu e-mail"
        help="Digite o código de 6 números que enviamos para o seu e-mail."
      />

      {ui.editing ? (
        <div className="flex flex-col gap-3 p-4 rounded-card bg-concrete-0 border border-concrete-200">
          <Input
            id="verificar-novo-email"
            label="E-mail certo"
            type="email"
            inputMode="email"
            autoComplete="email"
            icon="mail"
            placeholder="voce@email.com"
            value={ui.newEmail}
            error={ui.newEmailError}
            hint="O código vai para esse e-mail. O anterior deixa de valer."
            autoFocus
            onInput={(v) => setUi({ newEmail: v, newEmailError: null })}
            onEnter={changeEmail}
          />
          <Button
            label="Cancelar"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setUi({ editing: false, newEmail: '', newEmailError: null })}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3.5 short:p-3 rounded-card bg-concrete-0 border border-concrete-200">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0">
            <Icon name="mail" size={20} color="var(--brand)" />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-xs text-concrete-500">Código enviado para</span>
            <span className="font-semibold text-concrete-900 truncate">{email}</span>
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 shrink-0"
            onClick={() =>
              canChangePendingEmail() ? setUi({ editing: true, newEmail: email, newEmailError: null }) : startOver()
            }
          >
            <Icon name="pencil" size={15} />
            Corrigir
          </button>
        </div>
      )}

      {ui.editing ? null : (
        <>
          <CodeInput
            id="verificar-codigo"
            label="Código do e-mail"
            code={ui.code}
            error={ui.codeError}
            disabled={ui.confirming}
            pasteButton
            autoFocus
            onCode={typed}
            onEnter={() => confirm()}
          />
          <div className="flex flex-col items-center gap-1.5 text-center">
            {ui.resentTo ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-500" role="status">
                <Icon name="circle-check" size={16} />
                {`Enviamos um novo código para ${ui.resentTo}.`}
              </span>
            ) : null}
            {wait > 0 ? (
              <span className="text-sm text-concrete-500">
                Não chegou? Você pode pedir outro código em{' '}
                <span className="font-mono font-bold text-concrete-700">{clock(wait)}</span>
              </span>
            ) : (
              <button
                type="button"
                disabled={ui.resending}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60"
                onClick={resend}
              >
                <Icon name="mail" size={16} />
                {ui.resending ? 'Enviando…' : 'Reenviar código'}
              </button>
            )}
            <span className="text-xs text-concrete-500">
              {IS_DEMO
                ? 'Demonstração: qualquer código de 6 números confirma.'
                : 'Não achou o e-mail? Confira a caixa de spam ou promoções.'}
            </span>
          </div>
        </>
      )}
    </FlowLayout>
  );
}

/** Seconds left until `from + seconds`, re-read every second. */
function useSecondsLeft(from: number, seconds: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return from ? Math.max(0, seconds - Math.floor((now - from) / 1000)) : 0;
}

/** 60 → "1:00", 45 → "0:45". */
function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
