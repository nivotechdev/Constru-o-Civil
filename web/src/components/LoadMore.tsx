import type { Paging } from '../services/paging';
import { Button } from './Button';
import { FieldError } from './FieldError';

/** "Carregar mais" under a paged list (X01): only while the server says there is more. */
export function LoadMore({ paging }: { paging: Paging & { more: () => void } }) {
  if (!paging.hasMore && !paging.error) return null;
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      {paging.error ? <FieldError message={paging.error} /> : null}
      <Button
        label={paging.error ? 'Tentar de novo' : 'Carregar mais'}
        variant="secondary"
        loading={paging.loadingMore}
        onClick={paging.more}
      />
    </div>
  );
}
