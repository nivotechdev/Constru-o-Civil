import { useEffect, useSyncExternalStore } from 'react';
import { Button } from '../../components/Button';
import { navigate } from '../../services/router';
import { isSupabaseConfigured } from '../../services/supabase';
import { isAuthReady, isSignedIn, profileNeedsCompleting, getRole, subscribe } from '../../services/store';

export default function Splash() {
  // Subscribed (not a one-off check on mount): `initAuth()` resolves asynchronously, so whether
  // there's already a session is only known a render or two after this screen first mounts.
  const authReady = useSyncExternalStore(subscribe, isAuthReady);
  const signedIn = useSyncExternalStore(subscribe, isSignedIn);

  useEffect(() => {
    if (!isSupabaseConfigured() || !authReady || !signedIn) return;
    // Deferred a tick: the router navigates via flushSync when the target chunk is already loaded,
    // which React refuses while still committing the effect that triggered it ("flushSync was called
    // from inside a lifecycle method") — escaping to a microtask lets that commit finish first.
    queueMicrotask(() => {
      navigate(profileNeedsCompleting() ? '/completar-perfil/' + getRole() : '/mural', { replace: true });
    });
  }, [authReady, signedIn]);

  return (
    <div className="min-h-screen flex flex-col bg-brand-500">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="font-display font-bold text-5xl sm:text-6xl text-white tracking-tight">Bicos</span>
        <p className="max-w-xs sm:max-w-sm text-base sm:text-lg text-white/85">
          Diárias de obra perto de você. Sem taxa para o trabalhador.
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
