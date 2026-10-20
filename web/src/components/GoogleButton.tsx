// U18: "Continuar com o Google", drawn the way Google's branding rules ask for the light button — white, a thin
// #747775 border, the four-colour "G" untouched on the left and the text in #1F1F1F — so people recognise it at
// once. The same button on the login, on "Criar minha conta" and on the first step of the sign-up. It only
// exists when the Google provider is configured (FEATURES.googleLogin): no button that can't work.
import { cx } from '../utils/cx';
import { GoogleIcon, Icon } from './icons/Icon';

export function GoogleButton({
  onClick,
  loading = false,
  className
}: {
  onClick: () => void;
  loading?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      aria-busy={loading || undefined}
      onClick={onClick}
      className={cx(
        'relative tap-target inline-flex items-center justify-center gap-3 w-full h-12 px-4 rounded-control',
        'bg-white border border-[#747775] text-[#1F1F1F] font-body font-semibold text-base whitespace-nowrap',
        'hover:bg-[#F8FAFF] active:bg-[#EEF2FB] disabled:opacity-70 transition-colors duration-150',
        // U21: Google's own dark button in the dark theme.
        'dark:bg-[#131314] dark:border-[#8E918F] dark:text-[#E3E3E3] dark:hover:bg-[#1F1F21] dark:active:bg-[#2A2A2C]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
        className
      )}
    >
      {loading ? (
        <span
          className="animate-spin-token w-5 h-5 rounded-full border-2 border-[#747775] border-r-transparent"
          aria-hidden="true"
        />
      ) : (
        <GoogleIcon size={20} />
      )}
      Continuar com o Google
    </button>
  );
}

/** U28: "Continuar com o celular" — the SMS code instead of the password; same size and weight as the Google one. */
export function PhoneButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'relative tap-target inline-flex items-center justify-center gap-3 w-full h-12 px-4 rounded-control',
        'bg-concrete-0 border border-concrete-300 text-concrete-900 font-body font-semibold text-base whitespace-nowrap',
        'hover:bg-concrete-50 active:bg-concrete-100 transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500'
      )}
    >
      <Icon name="phone" size={20} color="var(--brand)" />
      Continuar com o celular
    </button>
  );
}

/** The "ou" line between the e-mail way and the Google button. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 py-1" aria-hidden="true">
      <span className="flex-1 h-px bg-concrete-200" />
      <span className="text-xs text-concrete-500">ou</span>
      <span className="flex-1 h-px bg-concrete-200" />
    </div>
  );
}
