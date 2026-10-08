import type { CSSProperties } from 'react';
import { cx } from '../utils/cx';

/** A grey placeholder block with a soft shine, while a screen's data loads. */
export function Skeleton({
  width = '100%',
  height = '1rem',
  radius = '0.375rem',
  className = ''
}: {
  width?: string;
  height?: string;
  radius?: string;
  className?: string;
}) {
  const style: CSSProperties = { width, height, borderRadius: radius };
  return <span aria-hidden="true" className={cx('skeleton', className)} style={style} />;
}

/** Shaped like a JobTile: photo, then the four text rows. */
export function TileSkeleton() {
  return (
    <div className="min-w-0 flex flex-col gap-2">
      <span aria-hidden="true" className="skeleton aspect-[20/19] rounded-xl sm:rounded-2xl" />
      <Skeleton width="70%" height="1rem" />
      <Skeleton width="55%" height="0.875rem" />
      <Skeleton width="45%" height="0.875rem" />
    </div>
  );
}

/** A grid of tile placeholders (mural, saved jobs, applications). */
export function TileGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="tile-grid" role="status" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <TileSkeleton key={i} />
      ))}
    </div>
  );
}

/** A list row: avatar + two lines (candidates, notifications, history). */
export function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-concrete-200 last:border-0">
      <Skeleton width="3rem" height="3rem" radius="9999px" className="shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton width="55%" height="1rem" />
        <Skeleton width="80%" height="0.875rem" />
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="bg-white border border-concrete-200 rounded-card" role="status" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

/** A detail page: cover, title, a few lines and a card (job detail, profiles). */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5 pb-8" role="status" aria-label="Carregando">
      <span aria-hidden="true" className="skeleton h-60 w-full lg:rounded-card" />
      <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-0">
        <Skeleton width="60%" height="1.75rem" />
        <Skeleton width="40%" height="1rem" />
        <Skeleton width="90%" height="0.875rem" />
        <Skeleton width="85%" height="0.875rem" />
        <Skeleton width="100%" height="6rem" radius="1rem" className="mt-2" />
      </div>
    </div>
  );
}
