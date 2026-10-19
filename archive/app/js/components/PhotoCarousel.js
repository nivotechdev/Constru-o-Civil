import { h, cx } from '../dom.js';
import { Icon } from '../utils/icons.js';
import { JobCover, jobPhotos } from './JobCover.js';

const shownPhoto = new Map();

/**
 * A job's photos, swiped (touch), dragged (mouse), paged with the arrows or the keyboard
 * arrows — the only sideways scrolling in the app. Without photos it shows the job's
 * illustrated cover. `className` sets the frame's size/rounding. `compact` is the version
 * inside a mural tile: small dots, arrows only on hover (desktop), no counter, and a drag
 * never counts as a click on the tile. The photo being shown is remembered per job, so
 * the tile and the job page open on the same photo.
 */
export function PhotoCarousel({ job, className = 'h-56 sm:h-72 lg:h-[26rem] rounded-card', compact = false }) {
  const photos = jobPhotos(job);
  const n = photos.length;
  const frame = cx('relative w-full overflow-hidden bg-concrete-200', className);

  if (!n) return h('div', { class: frame }, JobCover({ job, large: !compact }));

  const imgClass = cx('w-full h-full object-cover select-none pointer-events-none', compact ? 'transition-transform duration-300 group-hover:scale-[1.03]' : '');
  const track = h('div', {
    class: cx('flex h-full overflow-x-auto snap-x snap-mandatory overscroll-x-contain no-scrollbar outline-none', n > 1 ? 'cursor-grab' : ''),
    tabindex: n > 1 && !compact ? '0' : null, 'aria-label': 'Fotos do bico', 'aria-roledescription': 'carrossel'
  },
    ...photos.map((src, i) => h('div', { class: 'shrink-0 w-full h-full snap-center snap-always overflow-hidden' },
      h('img', { src, alt: `Foto ${i + 1} de ${n}`, draggable: 'false', loading: i === 0 ? 'eager' : 'lazy', class: imgClass })
    ))
  );
  if (n === 1) return h('div', { class: frame }, track);

  let width = 0;
  const current = () => Math.min(n - 1, shownPhoto.get(job.id) || 0);
  const goTo = (i) => {
    const target = Math.max(0, Math.min(n - 1, i));
    track.scrollTo({ left: target * (width || track.clientWidth), behavior: 'smooth' });
  };

  const arrow = (icon, label, dir, side) => h('button', {
    type: 'button', 'aria-label': label, title: label,
    class: cx('absolute top-1/2 -translate-y-1/2 z-10 items-center justify-center rounded-full bg-white/90 text-concrete-900 shadow-raised transition hover:bg-white hover:scale-105 disabled:!opacity-0 disabled:pointer-events-none',
      compact ? 'hidden lg:inline-flex w-8 h-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : 'inline-flex w-9 h-9', side),
    onClick: (e) => { e.stopPropagation(); goTo(current() + dir); }
  }, Icon(icon, { size: compact ? 16 : 18 }));
  const prev = arrow('chevron-left', 'Foto anterior', -1, compact ? 'left-2' : 'left-3');
  const next = arrow('chevron-right', 'Próxima foto', 1, compact ? 'right-2' : 'right-3');
  const dotSize = compact ? 'h-1.5' : 'h-1.5';
  const dots = photos.map(() => h('span', { class: dotSize }));
  const counter = compact ? null : h('span', { class: 'absolute top-3 right-3 inline-flex items-center h-6 px-2.5 rounded-full bg-black/60 text-white text-xs font-semibold pointer-events-none' });

  const show = (i) => {
    if (counter) counter.textContent = `${i + 1} / ${n}`;
    dots.forEach((d, k) => { d.className = cx(dotSize, 'rounded-full transition-all duration-200 shadow-[0_0_2px_rgba(0,0,0,0.4)]', k === i ? (compact ? 'w-1.5 bg-white' : 'w-4 bg-white') : 'w-1.5 bg-white/55'); });
    prev.disabled = i === 0;
    next.disabled = i === n - 1;
  };

  // The whole screen re-renders on every store change; remember which photo was showing.
  track.addEventListener('scroll', () => {
    // A resize also scrolls the track; keep the same photo instead of re-deriving it.
    if (track.clientWidth !== width) { width = track.clientWidth; track.scrollLeft = current() * width; return; }
    const i = Math.min(n - 1, Math.max(0, Math.round(track.scrollLeft / (width || 1))));
    shownPhoto.set(job.id, i);
    show(i);
  }, { passive: true });

  // Mouse drag to swipe (touch and trackpads already scroll natively).
  let drag = null;
  let dragged = false;
  track.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    drag = { x: e.clientX, left: track.scrollLeft, from: current() };
    dragged = false;
    track.style.scrollSnapType = 'none';
    track.classList.replace('cursor-grab', 'cursor-grabbing');
    track.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) dragged = true;
    track.scrollLeft = drag.left - dx;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const threshold = Math.min(60, (width || track.clientWidth) * 0.15);
    const target = drag.from + (dx < -threshold ? 1 : dx > threshold ? -1 : 0);
    drag = null;
    track.classList.replace('cursor-grabbing', 'cursor-grab');
    goTo(target);
    const restore = () => { track.style.scrollSnapType = ''; };
    if ('onscrollend' in window) track.addEventListener('scrollend', restore, { once: true });
    setTimeout(restore, 600);
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  // A drag that ends over the photo would otherwise also "click" it (and open the job).
  track.addEventListener('click', (e) => {
    if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
  }, true);
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current() + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current() - 1); }
  });

  const start = current();
  show(start);
  requestAnimationFrame(() => { width = track.clientWidth; if (start) track.scrollLeft = start * width; });

  return h('div', { class: frame },
    track, prev, next,
    h('div', { class: cx('absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none', compact ? 'bottom-2.5 gap-1' : 'bottom-3.5 gap-1.5') }, ...dots),
    counter
  );
}

/** Editable row of a job's photos (first one is the cover) plus an "add" tile, centred. */
export function PhotoManager({ photos, onChange, max = 6 }) {
  const add = h('label', {
    class: 'relative w-[6.75rem] sm:w-32 aspect-square flex flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed border-concrete-300 bg-concrete-25 text-concrete-500 cursor-pointer transition-colors hover:border-brand-400 hover:text-brand-600'
  },
    h('input', {
      type: 'file', accept: 'image/*', multiple: true, class: 'sr-only',
      onchange: (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) onChange(photos.concat(files.map((f) => URL.createObjectURL(f))).slice(0, max));
      }
    }),
    Icon('camera', { size: 22 }),
    h('span', { class: 'text-xs font-semibold text-center px-2' }, photos.length ? 'Adicionar foto' : 'Escolher fotos')
  );

  return h('div', { class: 'flex flex-wrap justify-center gap-2.5' },
    ...photos.map((src, i) => h('div', { class: 'relative w-[6.75rem] sm:w-32 aspect-square rounded-card overflow-hidden bg-concrete-200 shadow-card' },
      h('img', { src, alt: `Foto ${i + 1}`, class: 'w-full h-full object-cover' }),
      i === 0 ? h('span', { class: 'absolute bottom-1.5 left-1.5 px-2 h-5 inline-flex items-center rounded-full bg-black/60 text-white text-[0.625rem] font-bold uppercase tracking-wide' }, 'Capa') : null,
      h('button', {
        type: 'button', 'aria-label': `Remover foto ${i + 1}`, title: 'Remover foto',
        class: 'absolute top-1.5 right-1.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/90 text-concrete-900 shadow-raised hover:bg-white',
        onClick: () => onChange(photos.filter((_, k) => k !== i))
      }, Icon('x', { size: 14 }))
    )),
    photos.length < max ? add : null
  );
}
