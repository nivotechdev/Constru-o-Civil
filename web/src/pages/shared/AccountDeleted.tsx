import { Button } from '../../components/Button';
import { ResultIcon } from '../../components/ResultIcon';
import { navigate } from '../../services/router';

/** After the account was deleted (no session any more). */
export default function AccountDeleted() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center gap-6 px-6 bg-concrete-50">
      <ResultIcon icon="circle-check" tone="success" />
      <div className="flex flex-col gap-2 max-w-sm">
        <h1 className="font-display font-bold text-2xl text-concrete-900">Conta excluída</h1>
        <p className="text-concrete-700">
          Seu perfil, suas fotos e seus contatos foram apagados, e a sessão foi encerrada. As avaliações e o histórico
          dos bicos continuam, sem o seu nome. Obrigado por ter usado a Bicos.
        </p>
      </div>
      <Button label="Voltar ao início" variant="secondary" onClick={() => navigate('/splash', { replace: true })} />
    </div>
  );
}
