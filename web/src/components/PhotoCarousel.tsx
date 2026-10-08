import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Job } from '../types/models';
import { cx } from '../utils/cx';
import { jobPhotos } from '../utils/jobPhotos';
import { Icon, type IconName } from './icons/Icon';
import { JobCover } from './JobCover';

/** Photo being shown, per job — so the mural tile and the job page open on the same photo. */
const shownPhoto = new Map<string, number>();

type CarouselJob = Pick<Job, 'id' | 'role' | 'photos'>;

interface PhotoCarouselProps {
  job: CarouselJob;
  /** The frame's size/rounding. */
  className?: string;
  /** The version inside a mural tile: small dots, arrows only on hover (desktop), no counter. */
  compact?: boolean;
}

/**
 * A job's photos, swiped (touch), dragged (mouse), paged with the arrows or the keyboard arrows —
 * the only sideways scrolling in the app. Without photos it shows the job's illustrated cover. In
 * the compact version a drag never counts as a click on the tile.
 */
export function PhotoCarousel({
  job,
  className = 'h-56 sm:h-72 lg:h-[26rem] rounded-card',
  compact = false
}: PhotoCarouselProps) {
  const photos = jobPhotos(job);
  const frame = cx('relative w-full overflow-hidden bg-concrete-200', className);

  if (!photos.length) {
    return (
      <div className={frame}>
        <JobCover job={job} large={!compact} />
      </div>
    );
  }
  // A new set of photos starts a fresh carousel (the legacy app rebuilt it on every render).
  return <Slides key={photos.join('\n')} job={job} photos={photos} frame={frame} compact={compact} />;
}

interface SlidesProps {
  job: CarouselJob;
  photos: string[];
  frame: string;
  compact: boolean;
}

function Slides({ job, photos, frame, compact }: SlidesProps) {
  const n = photos.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const current = () => Math.min(n - 1, shownPhoto.get(job.id) || 0);
  const [index, setIndex] = useState(current);

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.max(0, Math.min(n - 1, i));
    track.scrollTo({ left: target * (widthRef.current || track.clientWidth), behavior: 'smooth' });
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track || n === 1) return;
    const jobId = job.id;
    const cur = () => Math.min(n - 1, shownPhoto.get(jobId) || 0);
    const scrollTo = (i: number) =>
      track.scrollTo({
        left: Math.max(0, Math.min(n - 1, i)) * (widthRef.current || track.clientWidth),
        behavior: 'smooth'
      });

    const onScroll = () => {
      // A resize also scrolls the track; keep the same photo instead of re-deriving it.
      if (track.clientWidth !== widthRef.current) {
        widthRef.current = track.clientWidth;
        track.scrollLeft = cur() * widthRef.current;
        return;
      }
      const i = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / (widthRef.current || 1))));
      shownPhoto.set(jobId, i);
      // Synchronously, like the legacy app: the dots/counter/arrows never lag behind the photo shown.
      flushSync(() => setIndex(i));
    };

    // Mouse drag to swipe (touch and trackpads already scroll natively).
    let drag: { x: number; left: number; from: number } | null = null;
    let dragged = false;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, left: track.scrollLeft, from: cur() };
      dragged = false;
      track.style.scrollSnapType = 'none';
      track.classList.replace('cursor-grab', 'cursor-grabbing');
      track.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 4) dragged = true;
      track.scrollLeft = drag.left - dx;
    };
    const endDrag = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const threshold = Math.min(60, (widthRef.current || track.clientWidth) * 0.15);
      const target = drag.from + (dx < -threshold ? 1 : dx > threshold ? -1 : 0);
      drag = null;
      track.classList.replace('cursor-grabbing', 'cursor-grab');
      scrollTo(target);
      const restore = () => {
        track.style.scrollSnapType = '';
      };
      if ('onscrollend' in window) track.addEventListener('scrollend', restore, { once: true });
      setTimeout(restore, 600);
    };
    // A drag that ends over the photo would otherwise also "click" it (and open the job).
    const onClickCapture = (e: MouseEvent) => {
      if (dragged) {
        e.stopPropagation();
        e.preventDefault();
        dragged = false;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollTo(cur() + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollTo(cur() - 1);
      }
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', onClickCapture, true);
    track.addEventListener('keydown', onKeyDown);

    const start = cur();
    const raf = requestAnimationFrame(() => {
      widthRef.current = track.clientWidth;
      if (start) track.scrollLeft = start * widthRef.current;
    });

    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', endDrag);
      track.removeEventListener('pointercancel', endDrag);
      track.removeEventListener('click', onClickCapture, true);
      track.removeEventListener('keydown', onKeyDown);
    };
  }, [job.id, n]);

  const imgClass = cx(
    'w-full h-full object-cover select-none pointer-events-none',
    compact ? 'transition-transform duration-300 group-hover:scale-[1.03]' : ''
  );
  const track = (
    <div
      ref={trackRef}
      className={cx(
        'flex h-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar outline-none',
        n > 1 ? 'cursor-grab' : ''
      )}
      tabIndex={n > 1 && !compact ? 0 : undefined}
      aria-label="Fotos do bico"
      aria-roledescription="carrossel"
    >
      {photos.map((src, i) => (
        <div key={i} className="shrink-0 w-full h-full snap-center snap-always overflow-hidden">
          <img
            src={src}
            alt={`Foto ${i + 1} de ${n}`}
            draggable={false}
            loading={i === 0 ? 'eager' : 'lazy'}
            className={imgClass}
          />
        </div>
      ))}
    </div>
  );
  if (n === 1) return <div className={frame}>{track}</div>;

  const arrow = (icon: IconName, label: string, dir: number, side: string) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={dir < 0 ? index === 0 : index === n - 1}
      className={cx(
        'absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-white/90 text-concrete-900 shadow-raised transition hover:bg-white hover:scale-105 disabled:!opacity-0 disabled:pointer-events-none',
        compact
          ? 'hidden lg:inline-flex w-8 h-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          : 'inline-flex w-9 h-9',
        side
      )}
      onClick={(e) => {
        e.stopPropagation();
        goTo(current() + dir);
      }}
    >
      <Icon name={icon} size={compact ? 16 : 18} />
    </button>
  );
  const dotSize = 'h-1.5';

  return (
    <div className={frame}>
      {track}
      {arrow('chevron-left', 'Foto anterior', -1, compact ? 'left-2' : 'left-3')}
      {arrow('chevron-right', 'Próxima foto', 1, compact ? 'right-2' : 'right-3')}
      <div
        className={cx(
          'absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none',
          compact ? 'bottom-2.5 gap-1' : 'bottom-3.5 gap-1.5'
        )}
      >
        {photos.map((_, k) => (
          <span
            key={k}
            className={cx(
              dotSize,
              'rounded-full transition-all duration-200 shadow-[0_0_2px_rgba(0,0,0,0.4)]',
              k === index ? (compact ? 'w-1.5 bg-white' : 'w-4 bg-white') : 'w-1.5 bg-white/55'
            )}
          />
        ))}
      </div>
      {compact ? null : (
        <span className="absolute top-3 right-3 inline-flex items-center h-6 px-2.5 rounded-full bg-black/60 text-white text-xs font-semibold pointer-events-none">
          {`${index + 1} / ${n}`}
        </span>
      )}
    </div>
  );
}
