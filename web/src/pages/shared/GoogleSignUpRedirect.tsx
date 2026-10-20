// U37: the old "Completar cadastro" address (L13). A Google login without its account now continues in the normal
// sign-up — its side's steps, or choosing the side first — so this only sends it there.
import { useEffect } from 'react';
import { googleSignUpPath } from '../../services/googleSignUp';
import { navigate } from '../../services/router';

export default function GoogleSignUpRedirect() {
  useEffect(() => navigate(googleSignUpPath(), { replace: true }), []);
  return <div className="min-h-screen bg-concrete-50" aria-busy="true" />;
}
