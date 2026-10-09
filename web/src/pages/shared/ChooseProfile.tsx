import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { RadioCard } from '../../components/Radio';
import { useUI } from '../../hooks/useStore';
import { goBack, navigate } from '../../services/router';
import type { Role } from '../../types/models';

export default function ChooseProfile() {
  const [ui, setUi] = useUI<{ role: Role }>('escolhaPerfil', { role: 'trabalhador' });

  return (
    <div className="min-h-screen flex flex-col bg-concrete-50">
      <BackBar title="Criar minha conta" onBack={() => goBack('/login')} />
      <div className="flex-1 max-w-app w-full mx-auto px-5 sm:px-8 pt-6 sm:pt-10 pb-8 flex flex-col gap-7">
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Criar conta</span>
          <h1 className="font-display font-bold text-3xl text-concrete-900">Como você vai usar o Bicos?</h1>
          <p className="text-base text-concrete-700">Dá para trocar depois no seu perfil.</p>
        </div>
        <div className="flex flex-col gap-3">
          <RadioCard
            name="perfil-cadastro"
            icon="hard-hat"
            label="Quero pegar bico"
            description="Sou pedreiro, servente, pintor ou eletricista"
            checked={ui.role === 'trabalhador'}
            onChange={() => setUi({ role: 'trabalhador' })}
          />
          <RadioCard
            name="perfil-cadastro"
            icon="building-2"
            label="Quero contratar"
            description="Represento uma construtora ou uma obra"
            checked={ui.role === 'recrutador'}
            onChange={() => setUi({ role: 'recrutador' })}
          />
        </div>
      </div>
      <div className="max-w-app w-full mx-auto px-5 sm:px-8 py-3 sticky bottom-0 bg-white shadow-bar sm:static sm:bg-transparent sm:shadow-none">
        <Button
          label="Continuar"
          size="lg"
          fullWidth
          iconRight="arrow-right"
          onClick={() => navigate('/cadastro/' + ui.role)}
        />
      </div>
    </div>
  );
}
