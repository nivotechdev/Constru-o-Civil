import type { MouseEvent } from 'react';
import { cx } from '../utils/cx';
import { Icon } from './icons/Icon';

const LABEL = 'Falar no WhatsApp';
const SHORT_LABEL = 'WhatsApp';

const SIZES = {
  sm: 'h-9 px-3.5 gap-1.5 text-sm',
  lg: 'h-14 px-5 gap-2 text-base'
};

interface WhatsAppButtonProps {
  href: string | null;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
  round?: boolean;
}

/**
 * "Falar no WhatsApp": a real link (opens WhatsApp in a new tab/app), in WhatsApp green.
 * Clicks don't bubble, so it can sit inside a clickable tile.
 */
export function WhatsAppButton({ href, size = 'sm', fullWidth = false, round = false }: WhatsAppButtonProps) {
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!href) e.preventDefault();
  };
  if (round) {
    // Icon-only, the size of the save flag: sits in a tile's photo corner.
    return (
      <a
        href={href || '#'}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={LABEL}
        title={LABEL}
        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#128C4A] text-white shadow-raised ring-2 ring-white transition hover:bg-[#0E7A3F] hover:scale-105 active:scale-95 outline-none focus-visible:ring-4 focus-visible:ring-[#128C4A]/30"
        onClick={onClick}
      >
        <Icon name="message-circle" size={19} color="#fff" />
      </a>
    );
  }
  return (
    <a
      href={href || '#'}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={LABEL}
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold text-white bg-[#128C4A] shadow-card transition-colors hover:bg-[#0E7A3F] active:scale-[0.98] outline-none focus-visible:ring-4 focus-visible:ring-[#128C4A]/25',
        SIZES[size] || SIZES.sm,
        fullWidth ? 'w-full' : ''
      )}
      onClick={onClick}
    >
      <Icon name="message-circle" size={size === 'lg' ? 20 : 16} color="#fff" />
      {/* Small buttons sit in narrow phone tiles: the short label there, the full one from sm up. */}
      {size === 'sm' ? (
        <>
          <span className="sm:hidden">{SHORT_LABEL}</span>
          <span className="hidden sm:inline">{LABEL}</span>
        </>
      ) : (
        LABEL
      )}
    </a>
  );
}
