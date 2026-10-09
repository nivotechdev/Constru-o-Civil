import { Icon, type IconName } from './icons/Icon';

/** Icon + two lines (e.g. the address and "bairro · distância") on the job pages. */
export function InfoRow({ icon, main, sub }: { icon: IconName; main: string; sub: string }) {
  return (
    <div className="flex gap-3 items-start">
      <Icon name={icon} size={20} color="var(--text-subtle)" />
      <div className="flex flex-col">
        <span className="font-semibold text-concrete-900">{main}</span>
        <span className="text-sm text-concrete-500">{sub}</span>
      </div>
    </div>
  );
}
