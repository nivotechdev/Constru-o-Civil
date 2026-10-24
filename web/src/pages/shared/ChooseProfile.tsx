import { useEffect } from 'react';
import { Button } from '../../components/Button';
import { FieldError } from '../../components/FieldError';
import { GoogleButton, OrDivider } from '../../components/GoogleButton';
import { FlowBar, FlowHeading, FlowLayout } from '../../components/FlowLayout';
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
  // U40: going back to the login ends the pending Google login (the login and the plain sign-up start clean).
  const back = () => {
    if (googleSignUp) void leaveGoogleSignUp();
    goBack('/login');
  };
  const next = () => {
    if (googleSignUp) rememberGoogleRole(ui.role);
    navigate('/cadastro/' + ui.role);
  };

  return (
    <FlowLayout
      header={<FlowBar title="Criar minha conta" onBack={back} />}
      className="pt-6 sm:pt-10 short:pt-5"
      footer={
        <>
          <Button label="Continuar" size="lg" fullWidth onClick={next} />
          {/* U18: the side chosen above goes along to Google and comes back marked. */}
          {FEATURES.googleLogin && !googleSignUp ? (
            <>
              <OrDivider />
              {google.error ? <FieldError message={google.error} /> : null}
              {/* U69: no spinner on the button — like the login and the sign-up (U68), the Google window is what shows;
                  closed without an account, nothing stays loading. */}
              <GoogleButton onClick={() => void google.run(ui.role)} />
            </>
          ) : null}
        </>
      }
    >
      <FlowHeading overline="Criar conta" title="Como você vai usar o Bicos?" />
      <div className="flex flex-col gap-3 short:gap-2.5">
        <RadioCard
          name="perfil-cadastro"
          icon="briefcase"
          label="Quero pegar bico"
          description="Procuro bicos e diárias perto de mim"
          checked={ui.role === 'trabalhador'}
          onChange={() => setUi({ role: 'trabalhador' })}
        />
        <RadioCard
          name="perfil-cadastro"
          icon="building-2"
          label="Quero contratar"
          description="Tenho uma empresa ou preciso de alguém para um serviço"
          checked={ui.role === 'recrutador'}
          onChange={() => setUi({ role: 'recrutador' })}
        />
      </div>
    </FlowLayout>
  );
}
