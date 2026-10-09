import type { ReactNode } from 'react';
import type { Query } from '../hooks/useQuery';
import { BackBar } from './BackBar';
import { ErrorState } from './ErrorState';

/**
 * Shows `skeleton` on the first load, ErrorState (with "Tentar de novo") if it failed, and `children`
 * once the data is there. `children` is a function so nothing reads the data before it loaded.
 */
export function QueryView({
  query,
  skeleton,
  showHome = false,
  children
}: {
  query: Query;
  skeleton: ReactNode;
  showHome?: boolean;
  children: () => ReactNode;
}) {
  if (query.status === 'loading') return <>{skeleton}</>;
  if (query.status === 'error')
    return <ErrorState message={query.error} offline={query.offline} onRetry={query.retry} showHome={showHome} />;
  return <>{children()}</>;
}

/** A whole screen while its data loads or after it failed: the top bar (to go back) and the state. */
export function ScreenLoading({
  title,
  onBack,
  query,
  skeleton
}: {
  title: string;
  onBack: () => void;
  query: Query;
  skeleton: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <BackBar title={title} onBack={onBack} />
      <QueryView query={query} skeleton={skeleton} showHome>
        {() => null}
      </QueryView>
    </div>
  );
}
