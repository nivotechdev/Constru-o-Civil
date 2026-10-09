import { mediaUrl } from '../services/media';
import { resetFileInput } from '../utils/fileInput';
import { Icon } from './icons/Icon';

interface PhotoManagerProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  max?: number;
}

/** Editable row of a job's photos (first one is the cover) plus an "add" tile, centred. */
export function PhotoManager({ photos, onChange, max = 6 }: PhotoManagerProps) {
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {photos.map((src, i) => (
        <div
          key={i}
          className="relative w-[6.75rem] sm:w-32 aspect-square rounded-card overflow-hidden bg-concrete-200 shadow-card"
        >
          <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
          {i === 0 ? (
            <span className="absolute bottom-1.5 left-1.5 px-2 h-5 inline-flex items-center rounded-full bg-black/60 text-white text-[0.625rem] font-bold uppercase tracking-wide">
              Capa
            </span>
          ) : null}
          <button
            type="button"
            aria-label={`Remover foto ${i + 1}`}
            title="Remover foto"
            className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-concrete-900 shadow-raised hover:bg-white"
            onClick={() => onChange(photos.filter((_, k) => k !== i))}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      {photos.length < max ? (
        <label className="relative w-[6.75rem] sm:w-32 aspect-square flex flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-concrete-300 bg-concrete-25 text-concrete-500 cursor-pointer transition-colors hover:border-brand-400 hover:text-brand-600">
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              resetFileInput(e.target);
              if (files.length) onChange(photos.concat(files.map((f) => mediaUrl(f))).slice(0, max));
            }}
          />
          <Icon name="camera" size={22} />
          <span className="text-xs font-semibold text-center px-2">
            {photos.length ? 'Adicionar foto' : 'Escolher fotos'}
          </span>
        </label>
      ) : null}
    </div>
  );
}
