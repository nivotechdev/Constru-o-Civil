// AUD-025: the sign-up's draft (the step and what was typed, but never the password) is kept in this tab's
// sessionStorage, so a reload does not start the form over. It is forgotten when the account is created or the
// flow is left. Every access is guarded: private mode or blocked storage just means no draft.

export interface SignupDraft {
  step: number;
  values: Partial<Record<string, string>>;
  accepted: boolean;
  adult: boolean;
}

const keyOf = (role: string) => `bicos.cadastro.${role}`;

export function saveSignupDraft(role: string, draft: SignupDraft): void {
  // The password never leaves the screen: it is dropped here, whatever the caller passed.
  const values = Object.fromEntries(Object.entries(draft.values).filter(([k]) => k !== 'senha'));
  try {
    sessionStorage.setItem(keyOf(role), JSON.stringify({ ...draft, values }));
  } catch {
    // no storage: the draft stays in memory only
  }
}

export function loadSignupDraft(role: string): SignupDraft | null {
  try {
    const raw = sessionStorage.getItem(keyOf(role));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupDraft>;
    if (typeof parsed.step !== 'number' || typeof parsed.values !== 'object' || parsed.values === null) return null;
    const values = Object.fromEntries(
      Object.entries(parsed.values).filter(([k, v]) => k !== 'senha' && typeof v === 'string')
    );
    return { step: parsed.step, values, accepted: Boolean(parsed.accepted), adult: Boolean(parsed.adult) };
  } catch {
    return null;
  }
}

export function forgetSignupDraft(role: string): void {
  try {
    sessionStorage.removeItem(keyOf(role));
  } catch {
    // nothing to forget
  }
}
