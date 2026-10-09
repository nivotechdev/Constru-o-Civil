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
}

/** Tap-to-choose photo well (cover banner, avatar, job-site photo). No backend — stores a local object URL. */
export function PhotoSlot({
  shape = 'rect',
  value,
  onChange,
  placeholder = 'Toque para escolher uma foto',
  className = '',
  height = '9rem'
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
