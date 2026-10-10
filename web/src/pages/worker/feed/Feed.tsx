import { useEffect, useMemo, useState } from 'react';
import { CityPicker } from '../../../components/CityPicker';
import { useQuery } from '../../../hooks/useQuery';
import { useDb, useRole, useUI } from '../../../hooks/useStore';
import { feedKey, loadFeed, loadMoreFeed, type FeedQuery } from '../../../services/jobs';
import { usePaging } from '../../../hooks/usePaging';
import { activeJobs, isJobClosed } from '../../../services/selectors';
import { isExpired } from '../../../utils/jobInfo';
import { DesktopFeed } from './DesktopFeed';
import { FiltersSheet } from './FeedSheets';
import {
  activeFilters,
  FEED_KEY,
  feedDefaults,
  feedOrigin,
  homeCity,
  orderJobs,
  passesFilters,
  radiusOf,
  searchMatches,
  setFeed,
  type FeedUI
} from './feedUI';
import { MobileFeed } from './MobileFeed';
import { isBlocked, loadMyBlocks, notBlocked } from '../../../services/safety';

/**
 * The mural. Both layouts are in the page (CSS shows one), so the lists they show are worked out
 * here, once per change of the data or of the filters/search they depend on.
 */
/** The value, once it stopped changing for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return settled;
}

export default function Feed() {
  const db = useDb();
  const role = useRole();
  const [ui] = useUI<FeedUI>(FEED_KEY, () => feedDefaults(db, role));
  const { location, origin, oficio, dist, quando, sort, allCities } = ui;
  const q = ui.search.trim();
  const home = homeCity(db, role);
  // X19: the profile moved to another city: a mural still on the old home city follows it.
  useEffect(() => {
    if (ui.home === home) return;
    setFeed(ui.location === (ui.home ?? ui.location) ? { location: home, origin: null, home } : { home });
  }, [home, ui.home, ui.location]);
  const from = useMemo(() => feedOrigin({ location, origin }, db, role), [location, origin, db, role]);
  // X01: the server lists the mural for these filters; a typed search waits a moment before asking.
  const search = useDebounced(q, 400);
  const feedQuery: FeedQuery = useMemo(
    () => ({ location, from, radiusKm: radiusOf(dist), oficio, quando, sort, search, allCities }),
    [location, from, dist, oficio, quando, sort, search, allCities]
  );
  const key = feedKey(feedQuery);
  const query = useQuery(key, () => loadFeed(feedQuery));
  const paging = usePaging(key, () => loadMoreFeed(feedQuery));

  // Open jobs: not closed, not full, and whose last day hasn't passed (expired jobs leave the mural).
  // F04: blocked companies stay out of the mural and the search.
  useQuery('blocks', loadMyBlocks);
  const open = useMemo(
    () => activeJobs(db).filter((j) => !isJobClosed(db, j) && !isExpired(j) && notBlocked(db)(j)),
    [db]
  );
  const ordered = useMemo(
    () =>
      orderJobs(
        open.filter((j) => passesFilters(j, { location, oficio, dist, quando, from })),
        role,
        sort,
        from
      ),
    [open, role, location, oficio, dist, quando, sort, from]
  );
  const found = useMemo(() => {
    if (!q) return null;
    const m = searchMatches(db, open, q, role, from, { location, allCities });
    return {
      ...m,
      companies: m.companies.filter((c) => !isBlocked(db, c.id)),
      workers: m.workers.filter((w) => !isBlocked(db, w.id))
    };
  }, [db, open, q, role, from, location, allCities]);
  const chips = useMemo(
    () => activeFilters({ location, oficio, dist, quando }, home),
    [location, oficio, dist, quando, home]
  );

  const layout = { db, role, ui, ordered, found, chips, query, home, paging };
  return (
    <div>
      <MobileFeed {...layout} />
      <DesktopFeed {...layout} />
      <FiltersSheet ui={ui} count={ordered.length} home={home} role={role} from={from} />
      <CityPicker
        open={ui.pickerOpen}
        title="Onde você quer trabalhar"
        value={location}
        stateKey="feed-city"
        onChoose={(label, point) => setFeed({ location: label, origin: point ?? null, pickerOpen: false })}
        onClose={() => setFeed({ pickerOpen: false })}
      />
    </div>
  );
}
