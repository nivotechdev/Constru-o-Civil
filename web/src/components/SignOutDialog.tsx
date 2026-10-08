import { useUI } from '../hooks/useStore';
import { signOut } from '../services/auth';
import { navigate } from '../services/router';
import { SIGN_OUT_DEFAULTS, SIGN_OUT_KEY, type SignOutUI } from '../services/sharedUI';
import { Dialog } from './Modal';

/**
 * "Sair da conta?" — one dialog for the whole app (menu, Configurações…), opened through
 * `askSignOut()` (services/sharedUI.ts). Signing out clears the session and every screen's state.
 */
export function SignOutDialog() {
  const [ui, setUi] = useUI<SignOutUI>(SIGN_OUT_KEY, SIGN_OUT_DEFAULTS);
  function confirm() {
    setUi({ busy: true, error: null });
    signOut()
      .then(() => navigate('/login', { replace: true }))
      .catch(() => setUi({ busy: false, error: 'Não deu para sair agora. Confira sua internet e tente de novo.' }));
  }
  return (
    <Dialog
      open={ui.open}
      title="Sair da conta?"
      description={ui.error ?? 'Para voltar, é só entrar de novo com seu e-mail e senha. Nada da sua conta é apagado.'}
      confirmLabel="Sair"
      tone="danger"
      loading={ui.busy}
      onConfirm={confirm}
      onCancel={() => setUi({ open: false, error: null })}
    />
  );
}
