import { useEffect } from 'react';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { GoogleButton, OrDivider } from '../../components/GoogleButton';
import { GoogleSignUpBanner } from '../../components/GoogleSignUpBanner';
import { FlowBar, FlowLayout } from '../../components/FlowLayout';
import { RadioCard } from '../../components/Radio';
import { useAction } from '../../hooks/useAction';
import { useScreenUI } from '../../hooks/useStore';
import { leaveGoogleSignUp, signInWithGoogle, prepareSocialSignIn } from '../../services/auth';
import { rememberGoogleRole } from '../../services/googleSignUp';
import { useGoogleSignUp } from '../../hooks/useGoogleSignUp';
import { FEATURES } from '../../services/features';
import { goBack, navigate } from '../../services/router';
import type { Role } from '../../types/models';

export default function ChooseProfile() {
  // U29: Firebase ready before the tap (the Google window must open inside it).
  useEffect(prepareSocialSignIn, []);
  const [ui, setUi] = useScreenUI<{ role: Role }>('escolhaPerfil', { role: 'trabalhador' });
  const google = useAction(signInWithGoogle);
  // U37: came back from Google without an account: choose the side, then the same sign-up without the e-mail.
  const googleSignUp = useGoogleSignUp();
  const next = () => {
    if (googleSignUp) rememberGoogleRole(ui.role);
    navigate('/cadastro/' + ui.role);
  };

  return (
    <FlowLayout
      header={<FlowBar title="Criar minha conta" onBack={() => goBack('/login')} />}
      className="pt-6 sm:pt-10"
      footer={
        <>
          <Button label="Continuar" size="lg" fullWidth onClick={next} />
          {/* U18: the side chosen above goes along to Google and comes back marked. */}
          {FEATURES.googleLogin && !googleSignUp ? (
            <>
              <OrDivider />
              {google.error ? <FieldError message={google.error} /> : null}
              <GoogleButton loading={google.loading} onClick={() => void google.run(ui.role)} />
            </>
          ) : null}
        </>
      }
    >
      {googleSignUp ? (
        <GoogleSignUpBanner email={googleSignUp.email} onSwitch={() => void leaveGoogleSignUp()} />
      ) : null}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-bold tracking-[0.08em] uppercase text-concrete-500">Criar conta</span>
        <h1 className="font-display font-bold text-3xl text-concrete-900">Como você vai usar o Bicos?</h1>
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
    </FlowLayout>
  );
}
