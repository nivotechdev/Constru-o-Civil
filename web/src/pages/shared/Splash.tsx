import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { navigate } from '../../services/router';

export default function Splash() {
  return (
    <div className="min-h-screen flex flex-col bg-brand-500">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1>
          <Logo inverse height={52} />
        </h1>
        <p className="max-w-xs sm:max-w-sm text-base sm:text-lg text-white/85">
          Bicos e diárias perto de você. Sem taxa para o trabalhador.
        </p>
      </div>
      <div className="flex flex-col gap-3 px-6 pb-10 sm:pb-14 w-full max-w-app mx-auto">
        <Button label="Entrar" size="lg" fullWidth variant="secondary" onClick={() => navigate('/login')} />
        <Button
          label="Criar minha conta"
          size="lg"
          fullWidth
          variant="inverse"
          onClick={() => navigate('/escolha-perfil')}
        />
      </div>
    </div>
  );
}
