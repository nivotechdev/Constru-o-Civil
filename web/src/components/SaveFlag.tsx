import { Icon } from './icons/Icon';

/** Bookmark flag over a job's photo: save/unsave without opening the job. */
export function SaveFlag({ saved, onToggle }: { saved: boolean; onToggle: () => void }) {
  const label = saved ? 'Remover dos salvos' : 'Salvar vaga';
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={saved ? 'true' : 'false'}
      title={label}
      className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-10 h-10 rounded-full transition-transform active:scale-90 hover:scale-110"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className="relative inline-flex w-6 h-6" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}>
        <Icon
          name="bookmark-solid"
          size={24}
          color={saved ? 'var(--brand)' : 'rgba(16,20,24,0.32)'}
          className="absolute inset-0"
        />
        <Icon name="bookmark" size={24} color="#fff" className="absolute inset-0" />
      </span>
    </button>
  );
}
