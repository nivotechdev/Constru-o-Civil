import { IconButton } from './IconButton';

interface BackBarProps {
  title: string;
  onBack?: () => void;
}

/** Contextual header for "compromise" screens (job detail, confirm, candidate, …). */
export function BackBar({ title, onBack }: BackBarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-1.5 min-h-14 px-2 bg-white border-b border-concrete-200 lg:static lg:bg-transparent lg:border-0 lg:-ml-3 lg:px-0 lg:pb-4 lg:mb-2">
      {onBack ? <IconButton icon="arrow-left" label="Voltar" onClick={() => onBack()} /> : null}
      <h1 className="flex-1 min-w-0 font-display font-semibold text-xl text-concrete-900 truncate">{title}</h1>
    </header>
  );
}
