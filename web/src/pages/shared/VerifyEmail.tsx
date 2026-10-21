// "Confirme seu e-mail" (U11): the 6-number code sent to the e-mail of the new account. The code is typed or
// pasted in one go ("Colar código", or the phone's own paste/autofill) and checks itself when the sixth
// number is in; then the account goes on to completing the profile. U43: a wrong address is changed right
// here ("Trocar") — the new one gets a code at once, and the screen never leaves nor starts the sign-up over.
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { useCaptcha } from '../../components/Captcha';
import { CodeInput } from '../../components/CodeInput';
import { FieldError } from '../../components/FieldError';
import { FlowBar, FlowHeading, FlowLayout, FlowSignOut } from '../../components/FlowLayout';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { useBusyWhile } from '../../hooks/useBusy';
import { useInnerBack } from '../../hooks/useInnerBack';
import { useSession, useScreenUI } from '../../hooks/useStore';
import { changePendingEmail, resendConfirmationEmail, SAME_EMAIL, verifyEmailCode } from '../../services/auth';
import { errorMessage } from '../../services/errors';
import { homeFor } from '../../services/guards';
import { IS_DEMO } from '../../services/mode';
import { navigate } from '../../services/router';
import { askSignOut } from '../../services/sharedUI';
import { getSession, resetUI } from '../../services/store';
import { CODE_LENGTH } from '../../utils/code';
import { cx } from '../../utils/cx';
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
  /** "Trocar" open, with what is being typed. */
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
const NEW_EMAIL_FIELD = 'verificar-novo-email';

/** Focuses the new-address field with the caret at the end (an e-mail field has no setSelectionRange). */
function focusNewEmail() {
  requestAnimationFrame(() => {
    const field = document.getElementById(NEW_EMAIL_FIELD);
    if (!(field instanceof HTMLInputElement)) return;
    field.focus();
    const value = field.value;
    field.value = '';
    field.value = value;
  });
}

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

  function startEditing() {
    setUi({ editing: true, newEmail: email, newEmailError: null, error: null });
  }

  function stopEditing() {
    if (!ui.changing) setUi({ editing: false, newEmail: '', newEmailError: null });
  }

  /** U43: the new address replaces the old one and gets a new code in the same tap. */
  function changeEmail() {
    if (ui.changing) return;
    const next = ui.newEmail.trim().toLowerCase();
    const problem = !isValidEmail(next)
      ? 'E-mail inválido. Confira se tem @ e o domínio.'
      : next === email.toLowerCase()
        ? SAME_EMAIL
        : null;
    if (problem) {
      setUi({ newEmailError: problem });
      focusNewEmail();
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
                ? 'Esse e-mail já tem conta na Bicos. Digite outro e-mail.'
                : 'Não deu para usar esse e-mail. Confira e tente de novo.'
          });
          focusNewEmail();
          return;
        }
        // Back to the code, counted from now, with the new address on the card.
        setUi({
          changing: false,
          editing: false,
          newEmail: '',
          code: '',
          codeError: null,
          resentTo: next,
          sentAt: Date.now()
        });
      })
      .catch((e: unknown) => {
        setUi({ changing: false, newEmailError: errorMessage(e) });
        focusNewEmail();
      });
  }

  // U45: while the code is checked or sent, nothing else takes a tap; with "Trocar" open, the phone's back button
  // closes it (the e-mail stays as it was).
  useBusyWhile(ui.confirming || ui.changing || ui.resending);
  useInnerBack(ui.editing, stopEditing);

  // Opening "Trocar" puts the caret at the end of the address, ready to fix it (the app's autofocus works
  // only on the first field a page ever shows, so it is done here).
  useEffect(() => {
    if (ui.editing) focusNewEmail();
  }, [ui.editing]);

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
              label="Enviar código para esse e-mail"
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
      <span className="sr-only" role="status">
        {ui.resentTo && !ui.editing ? `Pronto! Enviamos um código novo para ${ui.resentTo}.` : ''}
      </span>
      {ui.editing ? (
        <FlowHeading
          overline="Trocar e-mail"
          title="Qual é o e-mail certo?"
          help="Mandamos um código novo para ele na hora. O código anterior deixa de valer."
        />
      ) : (
        <FlowHeading
          overline="Falta pouco"
          title="Confirme seu e-mail"
          help="Digite o código de 6 números que enviamos para o seu e-mail."
        />
      )}

      {ui.editing ? (
        <div className="flex flex-col gap-2">
          <Input
            id={NEW_EMAIL_FIELD}
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            icon="mail"
            placeholder="voce@email.com"
            value={ui.newEmail}
            error={ui.newEmailError}
            onInput={(v) => setUi({ newEmail: v, newEmailError: null })}
            onEnter={changeEmail}
          />
          <Button
            label="Cancelar"
            variant="ghost"
            size="sm"
            className="self-center"
            disabled={ui.changing}
            onClick={stopEditing}
          />
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3.5 short:p-3 rounded-card bg-concrete-0 border border-concrete-200">
          {/* A new code (after "Trocar" or "Reenviar") shows right on the card: no extra line to make it taller. */}
          <span
            className={cx(
              'inline-flex items-center justify-center w-10 h-10 rounded-full shrink-0',
              ui.resentTo ? 'bg-success-50' : 'bg-brand-50'
            )}
          >
            <Icon
              name={ui.resentTo ? 'circle-check' : 'mail'}
              size={20}
              color={ui.resentTo ? 'rgb(var(--c-success-500))' : 'var(--brand)'}
            />
          </span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span
              className={
                ui.resentTo ? 'text-xs font-semibold text-success-600 truncate' : 'text-xs text-concrete-500 truncate'
              }
            >
              {ui.resentTo ? 'Enviado agora para' : 'Código enviado para'}
            </span>
            <span className="font-semibold text-concrete-900 truncate">{email}</span>
          </span>
          <button
            type="button"
            aria-label="Trocar e-mail"
            disabled={ui.confirming}
            className="relative tap-target inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-60 shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
            onClick={startEditing}
          >
            <Icon name="pencil" size={15} />
            Trocar
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
