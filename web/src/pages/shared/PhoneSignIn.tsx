// "Entrar com o celular" (U28): the number, a 6-number code by SMS (Firebase, with an invisible "I'm not a robot"),
// and the account whose WhatsApp is that number opens. A number without an account is offered the sign-up, which
// starts with it filled in.
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { CodeInput } from '../../components/CodeInput';
import { FieldError } from '../../components/FieldError';
import { FlowBar, FlowHeading, FlowLayout } from '../../components/FlowLayout';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { confirmPhoneSignInCode, sendPhoneSignInCode } from '../../services/auth';
import { errorMessage } from '../../services/errors';
import { goBack, navigate } from '../../services/router';
import { CODE_LENGTH } from '../../utils/code';
import { isValidMobile, maskPhone } from '../../utils/format';

type Step = 'numero' | 'codigo' | 'sem-conta';
const RESEND_SECONDS = 60;

export default function PhoneSignIn() {
  const robot = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>('numero');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const wait = sentAt ? Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000)) : 0;

  function send() {
    if (busy || !robot.current) return;
    if (!isValidMobile(phone)) {
      setError('Use o celular com DDD (11 números).');
      return;
    }
    setBusy(true);
    setError(null);
    sendPhoneSignInCode(phone, robot.current)
      .then(() => {
        setStep('codigo');
        setCode('');
        setSentAt(Date.now());
      })
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  }

  function confirm(typed = code) {
    if (busy) return;
    if (typed.length !== CODE_LENGTH) {
      setError('Digite os 6 números do SMS.');
      return;
    }
    setBusy(true);
    setError(null);
    confirmPhoneSignInCode(phone, typed)
      .then((result) => {
        if (result === 'sem-conta') setStep('sem-conta');
        // Signed in: the session sends the person to the app (or to finish the sign-up).
      })
      .catch((e: unknown) => {
        setCode('');
        setError(errorMessage(e));
      })
      .finally(() => setBusy(false));
  }

  return (
    <FlowLayout
      header={<FlowBar title="Entrar com o celular" onBack={() => goBack('/login')} />}
      footer={
        step === 'numero' ? (
          <Button
            label="Receber código por SMS"
            size="lg"
            fullWidth
            iconLeft="message-circle"
            loading={busy}
            onClick={send}
          />
        ) : step === 'codigo' ? (
          <Button label="Entrar" size="lg" fullWidth loading={busy} onClick={() => confirm()} />
        ) : (
          <>
            <Button
              label="Criar conta com esse número"
              size="lg"
              fullWidth
              onClick={() => navigate('/escolha-perfil')}
            />
            <Button label="Entrar com e-mail e senha" variant="ghost" fullWidth onClick={() => navigate('/login')} />
          </>
        )
      }
    >
      {step === 'numero' ? (
        <>
          <FlowHeading
            overline="Sem senha"
            title="Qual é o seu celular?"
            help="O mesmo número de WhatsApp da sua conta na Bicos. Vamos mandar um código por SMS."
          />
          <Input
            id="celular-numero"
            label="Celular com DDD"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            icon="phone"
            placeholder="(54) 99999-9999"
            value={phone}
            error={error}
            autoFocus
            onInput={(v) => {
              setPhone(maskPhone(v));
              setError(null);
            }}
            onEnter={send}
          />
        </>
      ) : step === 'codigo' ? (
        <>
          <FlowHeading overline="Falta pouco" title="Digite o código do SMS" />
          <div className="flex items-center gap-3 p-3.5 rounded-card bg-concrete-0 border border-concrete-200">
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-50 shrink-0">
              <Icon name="message-circle" size={20} color="var(--brand)" />
            </span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs text-concrete-500">Código enviado para</span>
              <span className="font-semibold text-concrete-900">{phone}</span>
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50 shrink-0"
              onClick={() => {
                setStep('numero');
                setError(null);
              }}
            >
              <Icon name="pencil" size={15} />
              Trocar
            </button>
          </div>
          <CodeInput
            id="celular-codigo"
            label="Código do SMS"
            code={code}
            error={error}
            disabled={busy}
            pasteButton
            autoFocus
            onCode={(v) => {
              setCode(v);
              setError(null);
              if (v.length === CODE_LENGTH && v !== code) confirm(v);
            }}
            onEnter={() => confirm()}
          />
          <div className="flex justify-center">
            {wait > 0 ? (
              <span className="text-sm text-concrete-500">{`Não chegou? Peça outro em 0:${String(wait).padStart(2, '0')}`}</span>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold text-brand-600 hover:bg-brand-50"
                onClick={send}
              >
                <Icon name="message-circle" size={16} />
                Reenviar código
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <FlowHeading
            overline="Número confirmado"
            title="Esse número ainda não tem conta"
            help={`Não achamos conta na Bicos com o celular ${phone}. Crie sua conta — o número já vai preenchido.`}
          />
          {error ? <FieldError message={error} /> : null}
        </>
      )}
      {/* Firebase's invisible "I'm not a robot" lives here. */}
      <div ref={robot} />
    </FlowLayout>
  );
}
