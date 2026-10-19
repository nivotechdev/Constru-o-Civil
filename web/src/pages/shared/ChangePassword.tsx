// "Trocar senha" (L15): the current password and the new one, twice. Everything typed stays in this
// screen (Y22).
import { useState } from 'react';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { useCaptcha } from '../../components/Captcha';
import { FieldError } from '../../components/FieldError';
import { PasswordInput } from '../../components/Input';
import { PasswordStrength } from '../../components/PasswordStrength';
import { useAction } from '../../hooks/useAction';
import { changePassword } from '../../services/auth';
import { serviceError } from '../../services/errors';
import { goBack } from '../../services/router';
import { showToast } from '../../services/toast';

export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const captcha = useCaptcha();
  const back = () => goBack('/configuracoes');
  const save = useAction(
    async () => {
      if (!current) throw serviceError('validacao', 'Digite sua senha atual.');
      if (next !== confirm) throw serviceError('validacao', 'As senhas novas não são iguais. Confira os dois campos.');
      await changePassword(current, next, captcha.getToken);
    },
    () => {
      showToast('Senha trocada');
      back();
    }
  );
  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:bg-transparent lg:min-h-0">
      <BackBar title="Trocar senha" onBack={back} />
      <form
        className="flex-1 flex flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void save.run();
        }}
      >
        <div className="flex-1 flex flex-col gap-5 px-4 sm:px-6 lg:px-0 py-4">
          <PasswordInput
            id="senha-atual"
            label="Senha atual"
            autoComplete="current-password"
            value={current}
            visible={visible}
            onToggleVisible={() => setVisible(!visible)}
            onInput={(v) => {
              setCurrent(v);
              save.reset();
            }}
          />
          <PasswordInput
            id="senha-nova"
            label="Senha nova"
            autoComplete="new-password"
            value={next}
            visible={visible}
            onToggleVisible={() => setVisible(!visible)}
            onInput={(v) => {
              setNext(v);
              save.reset();
            }}
          />
          <PasswordStrength password={next} />
          <PasswordInput
            id="senha-confirmar"
            label="Confirme a senha nova"
            autoComplete="new-password"
            value={confirm}
            visible={visible}
            onToggleVisible={() => setVisible(!visible)}
            onInput={(v) => {
              setConfirm(v);
              save.reset();
            }}
          />
        </div>
        <div className="sticky bottom-0 px-4 sm:px-6 lg:px-0 py-3 bg-white shadow-bar flex flex-col gap-2 lg:static lg:bg-transparent lg:shadow-none">
          {captcha.widget}
          {save.error ? <FieldError message={save.error} /> : null}
          <Button label="Salvar senha nova" type="submit" size="lg" fullWidth loading={save.loading} />
        </div>
      </form>
    </div>
  );
}
