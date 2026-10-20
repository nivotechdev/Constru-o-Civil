// U37: the Google sign-up in progress (a Google login whose account isn't created yet), for the sign-up screens.
import { useEffect } from 'react';
import { loadGoogleSignUp } from '../services/auth';
import {
  GOOGLE_SIGNUP_DEFAULTS,
  GOOGLE_SIGNUP_KEY,
  type GoogleIdentity,
  type GoogleSignUpUI
} from '../services/googleSignUp';
import { useUI } from './useStore';

export function useGoogleSignUp(): GoogleIdentity | null {
  const [ui] = useUI<GoogleSignUpUI>(GOOGLE_SIGNUP_KEY, GOOGLE_SIGNUP_DEFAULTS);
  // Read again as the screen opens: after a reload, or coming back from Supabase's own Google page.
  useEffect(() => {
    void loadGoogleSignUp().catch(() => undefined);
  }, []);
  return ui.identity;
}
