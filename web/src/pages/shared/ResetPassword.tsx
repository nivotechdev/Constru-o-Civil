import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { PasswordInput } from '../../components/Input';
import { ResultIcon } from '../../components/ResultIcon';
import { useState } from 'react';
import { PasswordStrength } from '../../components/PasswordStrength';
import { resetPassword } from '../../services/auth';
import { goBack, navigate } from '../../services/router';
import { errorMessage } from '../../services/errors';

export default function ResetPassword() {
  // Y22: the new password lives only in this screen.
  const [ui, setState] = useState({
    senha: '',
    confirm: '',
    visible: false,
    error: null as string | null,
    done: false,
    submitting: false
  });
  const setUi = (patch: Partial<typeof ui>) => setState((s) => ({ ...s, ...patch }));

  if (ui.done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center gap-5 px-6 bg-white lg:max-w-app lg:mx-auto">
        <ResultIcon icon="circle-check" tone="success" />
        <h1 className="font-display font-bold text-2xl text-concrete-900">Senha redefinida</h1>
        <p className="text-base text-concrete-700">Use sua nova senha para entrar na sua conta.</p>
        <Button label="Ir para o login" size="lg" onClick={() => navigate('/login')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white lg:max-w-app lg:mx-auto">
      <div className="flex items-center gap-1.5 min-h-14 px-2 border-b border-concrete-200">
        <IconButton icon="arrow-left" label="Voltar" onClick={() => goBack('/login')} />
        <span className="font-display font-semibold text-xl text-concrete-900">Criar nova senha</span>
      </div>
      <div className="flex-1 flex flex-col gap-7 px-5 sm:px-8 py-8">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-display font-bold text-3xl text-concrete-900">Escolha uma senha nova</h1>
          <p className="text-base text-concrete-700">Use 8 caracteres ou mais, misturando letras e números.</p>
        </div>
        <PasswordInput
          id="reset-senha"
          value={ui.senha}
          visible={ui.visible}
          onToggleVisible={() => setUi({ visible: !ui.visible })}
          onInput={(v) => setUi({ senha: v, error: null })}
        />
        <PasswordStrength password={ui.senha} />
        <PasswordInput
          id="reset-confirm"
          label="Confirme a senha nova"
          value={ui.confirm}
          visible={ui.visible}
          onToggleVisible={() => setUi({ visible: !ui.visible })}
          error={ui.error}
          onInput={(v) => setUi({ confirm: v, error: null })}
        />
      </div>
      <div className="px-5 sm:px-8 py-3">
        <Button
          label="Salvar nova senha"
          size="lg"
          fullWidth
          loading={ui.submitting}
          onClick={() => {
            if (ui.senha.length < 8) {
              setUi({ error: 'Senha curta. Use 8 caracteres ou mais.' });
              return;
            }
            if (ui.senha !== ui.confirm) {
              setUi({ error: 'As senhas não são iguais. Confira os dois campos.' });
              return;
            }
            if (ui.submitting) return;
            setUi({ submitting: true, error: null });
            resetPassword(ui.senha)
              .then(() => setUi({ submitting: false, done: true }))
              .catch((e: unknown) => setUi({ submitting: false, error: errorMessage(e) }));
          }}
        />
      </div>
    </div>
  );
}
