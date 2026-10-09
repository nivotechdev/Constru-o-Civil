import { cx } from '../utils/cx';
import { Icon, type IconName } from './icons/Icon';

const TONES = {
  brand: { background: 'bg-brand-50', color: 'var(--brand)' },
  success: { background: 'bg-success-50', color: 'var(--green-500)' }
};

/** The big round icon on top of a result screen ("Link enviado", "Candidatura enviada", "Vaga publicada"…). */
export function ResultIcon({ icon, tone }: { icon: IconName; tone: keyof typeof TONES }) {
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center w-[4.5rem] h-[4.5rem] rounded-full',
        TONES[tone].background
      )}
    >
      <Icon name={icon} size={34} color={TONES[tone].color} />
    </span>
  );
}
