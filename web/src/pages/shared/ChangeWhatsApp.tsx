// "Trocar WhatsApp" (Y25), for workers and companies: the new number (mobile with DDD), then — when the
// code by WhatsApp is set up — the code, and only then the change. Without the code the number is saved
// unconfirmed. Everything typed here is this screen's own (nothing left in the store).
import { useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { useCaptcha } from '../../components/Captcha';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input } from '../../components/Input';
import { useDb, useSession } from '../../hooks/useStore';
import { sendWhatsAppCode, verifyWhatsAppCode, WHATSAPP_CODE_AVAILABLE } from '../../services/auth';
import { errorMessage } from '../../services/errors';
import { changeWhatsApp } from '../../services/profiles';
import { goBack } from '../../services/router';
import { showToast } from '../../services/toast';
import { isValidMobile, maskPhone } from '../../utils/format';
import { WhatsAppCode } from './WhatsAppCode';

export default function ChangeWhatsApp() {
  const session = useSession();
  const db = useDb();
  const account = session ? db.accounts[session.accountId] : undefined;
  const captcha = useCaptcha();
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'numero' | 'codigo'>('numero');
  const [code, setCode] = useState('');
  const [sentAt, setSentAt] = useState(0);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const back = () => goBack(session?.role === 'recrutador' ? '/empresa/editar' : '/perfil/editar');
  const same = account ? phone.replace(/\D/g, '') === account.whatsapp.replace(/\D/g, '') : false;

  const finish = async () => {
    await changeWhatsApp(phone);
    showToast(WHATSAPP_CODE_AVAILABLE ? 'WhatsApp trocado e confirmado' : 'WhatsApp trocado');
    back();
  };

  const submitNumber = () => {
    if (busy) return;
    if (!isValidMobile(phone)) {
      setError('Número inválido. Use o celular com DDD (11 números).');
      return;
    }
    if (same) {
      setError('Esse já é o seu número.');
      return;
    }
    setBusy(true);
    setError(null);
    const next = WHATSAPP_CODE_AVAILABLE
      ? sendWhatsAppCode(phone, captcha.getToken).then(() => {
          setStep('codigo');
          setCode('');
          setSentAt(Date.now());
          setResent(false);
        })
      : finish();
    next.catch((e: unknown) => setError(errorMessage(e))).finally(() => setBusy(false));
  };

  const submitCode = () => {
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Digite os 6 números do código.');
      return;
    }
    setBusy(true);
    setCodeError(null);
    verifyWhatsAppCode(phone, code)
      .then((ok) => {
        if (!ok) {
          setCodeError('Código incorreto. Confira a mensagem no WhatsApp e tente de novo.');
          return;
        }
        return finish();
      })
      .catch((e: unknown) => setCodeError(errorMessage(e)))
      .finally(() => setBusy(false));
  };

  const resend = () => {
    if (resending) return;
    setResending(true);
    sendWhatsAppCode(phone, captcha.getToken)
      .then(() => {
        setSentAt(Date.now());
        setResent(true);
        setCode('');
      })
      .catch((e: unknown) => setCodeError(errorMessage(e)))
      .finally(() => setResending(false));
  };

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Trocar WhatsApp" onBack={back} />
      <div className="flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4">
        {step === 'numero' ? (
          <>
            {account?.whatsapp ? (
              <Card tone="sunken" padding="sm">
                <div className="flex items-center gap-2.5">
                  <Icon name="phone" size={20} color="var(--text-subtle)" />
                  <span className="flex-1 text-sm text-concrete-700">
                    {`Número atual: ${maskPhone(account.whatsapp)}`}
                    {account.whatsappVerifiedAt ? ' · confirmado' : ' · sem confirmação'}
                  </span>
                </div>
              </Card>
            ) : null}
            <Input
              id="trocar-whatsapp"
              label="Novo WhatsApp"
              placeholder="(11) 98888-7777"
              icon="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              error={error}
              onInput={(v) => {
                setPhone(maskPhone(v));
                setError(null);
              }}
              onEnter={submitNumber}
            />
            <span className="text-sm text-concrete-500">
              {session?.role === 'recrutador'
                ? 'É por ele que os candidatos falam com a empresa.'
                : 'É por ele que as construtoras falam com você.'}{' '}
              {WHATSAPP_CODE_AVAILABLE
                ? 'Vamos mandar um código para confirmar o número.'
                : 'Por enquanto o número fica sem confirmação por código.'}
            </span>
            {captcha.widget}
          </>
        ) : (
          <WhatsAppCode
            id="trocar-whatsapp-codigo"
            phone={phone}
            code={code}
            error={codeError}
            sentAt={sentAt}
            resending={resending}
            resent={resent}
            onCode={(v) => {
              setCode(v);
              setCodeError(null);
            }}
            onEnter={submitCode}
            onResend={resend}
            onEditNumber={() => setStep('numero')}
          />
        )}
      </div>
      <div className="sticky bottom-0 px-4 sm:px-6 lg:px-0 py-3 bg-concrete-0 shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none">
        {step === 'codigo' && !codeError && error ? <FieldError message={error} /> : null}
        <Button
          label={step === 'codigo' ? 'Confirmar número' : WHATSAPP_CODE_AVAILABLE ? 'Enviar código' : 'Salvar número'}
          size="lg"
          fullWidth
          loading={busy}
          onClick={step === 'codigo' ? submitCode : submitNumber}
        />
      </div>
    </div>
  );
}
