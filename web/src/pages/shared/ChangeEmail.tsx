// "Trocar e-mail" (F08): the new address and the password. With the real backend nothing changes until
// the link sent to the new address is opened; the screen says so.
import { useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { useCaptcha } from '../../components/Captcha';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { Icon } from '../../components/icons/Icon';
import { Input, PasswordInput } from '../../components/Input';
import { ResultIcon } from '../../components/ResultIcon';
import { useAction } from '../../hooks/useAction';
import { useSession } from '../../hooks/useStore';
import { changeEmail } from '../../services/auth';
import { IS_DEMO } from '../../services/mode';
import { goBack } from '../../services/router';
import { showToast } from '../../services/toast';

export default function ChangeEmail() {
  const session = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const captcha = useCaptcha();
  const back = () => goBack('/configuracoes');
  const save = useAction(
    () => changeEmail(email, password, captcha.getToken),
    () => {
      if (IS_DEMO) {
        showToast('E-mail trocado');
        back();
      } else setSentTo(email.trim().toLowerCase());
    }
  );

  if (sentTo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center gap-5 px-6 bg-concrete-0 lg:max-w-app lg:mx-auto">
        <ResultIcon icon="mail-check" tone="brand" />
        <h1 className="font-display font-bold text-2xl text-concrete-900">Confirme o e-mail novo</h1>
        <p className="text-base text-concrete-700">
          Enviamos um link para <strong className="text-concrete-900">{sentTo}</strong>. Seu e-mail só muda quando você
          abrir esse link. Até lá, continue entrando com o e-mail de sempre.
        </p>
        <Button label="Voltar às configurações" size="lg" onClick={back} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Trocar e-mail" onBack={back} />
      <form
        className="flex-1 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save.run();
        }}
      >
        <div className="flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4">
          <Card tone="sunken" padding="sm">
            <div className="flex items-center gap-2.5">
              <Icon name="mail" size={20} color="var(--text-subtle)" />
              <span className="flex-1 text-sm text-concrete-700">{`E-mail atual: ${session?.email ?? ''}`}</span>
            </div>
          </Card>
          <Input
            id="email-novo"
            label="E-mail novo"
            placeholder="voce@email.com"
            icon="mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onInput={(v) => {
              setEmail(v);
              save.reset();
            }}
          />
          <PasswordInput
            id="email-senha"
            label="Sua senha"
            autoComplete="current-password"
            value={password}
            visible={visible}
            onToggleVisible={() => setVisible(!visible)}
            onInput={(v) => {
              setPassword(v);
              save.reset();
            }}
          />
        </div>
        <div className="sticky bottom-0 px-4 sm:px-6 lg:px-0 py-3 bg-concrete-0 shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none">
          {captcha.widget}
          {save.error ? <FieldError message={save.error} /> : null}
          <Button label="Trocar e-mail" type="submit" size="lg" fullWidth loading={save.loading} />
        </div>
      </form>
    </div>
  );
}
