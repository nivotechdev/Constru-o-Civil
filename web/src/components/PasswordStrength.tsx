// The bar and label under a new password (sign-up, new password, change password). Nothing typed → a hint,
// never "Senha fraca" (P08).
import { passwordStrength, STRENGTH_LABEL, strengthBarColor } from '../utils/format';

export function PasswordStrength({ password }: { password: string }) {
  const strength = passwordStrength(password);
  const text = strength === 3 ? 'text-success-500' : strength ? 'text-warning-500' : 'text-concrete-500';
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <span className="flex-1 h-1 rounded-full bg-concrete-200 overflow-hidden">
        <span
          className={`block h-full rounded-full ${strengthBarColor(strength)} transition-all`}
          style={{ width: (strength / 3) * 100 + '%' }}
        />
      </span>
      <span className={`text-sm whitespace-nowrap ${text}`}>{STRENGTH_LABEL[strength] ?? '8 caracteres ou mais'}</span>
    </div>
  );
}
