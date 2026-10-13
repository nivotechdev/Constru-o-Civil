import { mediaUrl } from '../services/media';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';
import { resetFileInput } from '../utils/fileInput';

interface PhotoSlotProps {
  shape?: 'rect' | 'circle';
  value?: string | null;
  onChange?: (url: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
  /** 0–1 while the picture uploads: a bar over it (Z12). */
  progress?: number | null;
}

/** Tap-to-choose photo well (cover banner, avatar, job-site photo). No backend — stores a local object URL. */
export function PhotoSlot({
  shape = 'rect',
  value,
  onChange,
  placeholder = 'Toque para escolher uma foto',
  className = '',
  height = '9rem',
  progress = null
}: PhotoSlotProps) {
  const isCircle = shape === 'circle';
  return (
    <label
      className={cx(
        'relative flex items-center justify-center overflow-hidden cursor-pointer bg-concrete-200 border-2 border-dashed border-concrete-300 hover:border-brand-400 transition-colors',
        isCircle ? 'rounded-full' : 'rounded-card w-full',
        className
      )}
      style={isCircle ? {} : { height }}
    >
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          if (file) resetFileInput(e.target);
          if (file && onChange) onChange(mediaUrl(file));
        }}
      />
      {progress !== null ? (
        <span
          className="absolute inset-x-0 bottom-0 z-10 h-1.5 bg-black/20"
          role="progressbar"
          aria-label="Enviando a foto"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span
            className="block h-full bg-brand-500 transition-[width]"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </span>
      ) : null}
      {value ? (
        <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1.5 text-concrete-500 px-3 text-center">
          <Icon name="camera" size={isCircle ? 20 : 24} />
          <span className="text-xs font-semibold">{placeholder}</span>
        </span>
      )}
    </label>
  );
}
