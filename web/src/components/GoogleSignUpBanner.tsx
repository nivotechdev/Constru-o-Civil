// U37: on every step of a sign-up started with Google — which account it is, that its e-mail is already confirmed
// (so there is no e-mail step), and a way out to sign up with another e-mail.
import { GoogleIcon, Icon } from './icons/Icon';

export function GoogleSignUpBanner({ email, onSwitch }: { email: string; onSwitch: () => void }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-card bg-concrete-0 border border-concrete-200 shadow-card">
      <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-concrete-50 border border-concrete-200">
        <GoogleIcon size={18} />
      </span>
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-sm font-semibold text-concrete-900 truncate">{email || 'Sua conta Google'}</span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-600">
          <Icon name="circle-check" size={13} color="currentColor" />
          E-mail confirmado pelo Google
        </span>
      </div>
      <button
        type="button"
        onClick={onSwitch}
        className="tap-target shrink-0 px-2 text-sm font-semibold text-brand-600 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        Trocar
      </button>
    </div>
  );
}
