import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons/Icon';
import { ResultIcon } from '../../components/ResultIcon';
import { useUI } from '../../hooks/useStore';
import { navigate } from '../../services/router';
import { isSupabaseConfigured } from '../../services/supabase';
import { AUTH_FLOW_DEFAULTS, AUTH_FLOW_KEY, type AuthFlowUI } from '../../services/sharedUI';

const REAL = isSupabaseConfigured();

export default function VerifyEmail() {
  const [flow] = useUI<AuthFlowUI>(AUTH_FLOW_KEY, AUTH_FLOW_DEFAULTS);

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50 lg:max-w-app lg:mx-auto">
      <div className="flex-1 flex flex-col items-center text-center gap-6 px-6 pt-16 pb-8">
        <ResultIcon icon="mail-check" tone="brand" />
        <div className="flex flex-col gap-2">
          <h1 className="font-display font-bold text-2xl text-concrete-900">Conta criada. Confirme seu e-mail</h1>
          <p className="text-base text-concrete-700">
            Enviamos um link de confirmação para <strong className="text-concrete-900">{flow.email}</strong>. Abra o
            link para ativar sua conta.
          </p>
        </div>
        <Card tone="sunken" padding="md" className="w-full text-left">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2.5 items-center">
              <Icon name="clock" size={20} color="var(--text-subtle)" />
              <span className="text-sm text-concrete-700">O link vale por 24 horas.</span>
            </div>
            <div className="flex gap-2.5 items-center">
              <Icon name="search-x" size={20} color="var(--text-subtle)" />
              <span className="text-sm text-concrete-700">Não chegou? Confira a caixa de spam.</span>
            </div>
          </div>
        </Card>
      </div>
      <div className="px-6 pb-8 flex flex-col gap-2">
        {REAL ? (
          // O link de confirmação não faz login sozinho (mesma decisão do front vanilla) — depois
          // de confirmar, a pessoa entra normalmente e cai em completar-perfil se ainda faltar algo.
          <Button label="Já confirmei, ir para o login" size="lg" fullWidth iconLeft="mail" onClick={() => navigate('/login')} />
        ) : (
          <Button
            label="Abrir meu e-mail"
            size="lg"
            fullWidth
            iconLeft="mail"
            onClick={() => navigate('/completar-perfil/' + flow.role)}
          />
        )}
        <Button label="Reenviar o link" variant="ghost" fullWidth onClick={() => {}} />
      </div>
    </div>
  );
}
