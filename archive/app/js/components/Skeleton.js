import { h, cx, rem } from '../dom.js';

export function Skeleton({ width = '100%', height = '1rem', radius = '0.375rem', className = '' }) {
  return h('span', {
    class: cx('skeleton block', className),
    style: { width: typeof width === 'number' ? rem(width) : width, height: typeof height === 'number' ? rem(height) : height, borderRadius: radius }
  });
}

/** Skeleton shaped like a JobCard, used while the feed/candidate list is loading. */
export function CardSkeleton() {
  return h('div', { class: 'rounded-card border border-concrete-200 bg-white overflow-hidden' },
    Skeleton({ width: '100%', height: '9.25rem', radius: '0' }),
    h('div', { class: 'p-4 flex flex-col gap-3' },
      h('div', { class: 'flex justify-between gap-3' },
        Skeleton({ width: '60%', height: '1.25rem' }),
        Skeleton({ width: '4.5rem', height: '2.5rem', radius: '0.5rem' })
      ),
      Skeleton({ width: '80%', height: '0.875rem' })
    )
  );
}

export function RowSkeleton() {
  return h('div', { class: 'flex items-center gap-3 p-4 border-b border-concrete-200 last:border-0' },
    Skeleton({ width: '3rem', height: '3rem', radius: '9999px' }),
    h('div', { class: 'flex-1 min-w-0 flex flex-col gap-2' },
      Skeleton({ width: '55%', height: '1rem' }),
      Skeleton({ width: '80%', height: '0.875rem' })
    )
  );
}
