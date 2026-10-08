import { useMemo } from 'react';
import { CityPicker } from '../../../components/CityPicker';
import { useQuery } from '../../../hooks/useQuery';
import { useDb, useRole, useUI } from '../../../hooks/useStore';
import { loadFeed } from '../../../services/jobs';
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
  searchMatches,
  setFeed,
  type FeedUI
} from './feedUI';
import { MobileFeed } from './MobileFeed';

/**
 * The mural. Both layouts are in the page (CSS shows one), so the lists they show are worked out
 * here, once per change of the data or of the filters/search they depend on.
 */
export default function Feed() {
  const db = useDb();
  const role = useRole();
  const [ui] = useUI<FeedUI>(FEED_KEY, () => feedDefaults(db, role));
  const query = useQuery('feed', loadFeed);
  const { location, origin, oficio, dist, quando, sort } = ui;
  const q = ui.search.trim();
  const home = homeCity(db, role);
  const from = useMemo(() => feedOrigin({ location, origin }, db, role), [location, origin, db, role]);

  // Open jobs: not closed, not full, and whose last day hasn't passed (expired jobs leave the mural).
  const open = useMemo(() => activeJobs(db).filter((j) => !isJobClosed(db, j) && !isExpired(j)), [db]);
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
  const found = useMemo(() => (q ? searchMatches(db, open, q, role, from) : null), [db, open, q, role, from]);
  const chips = useMemo(
    () => activeFilters({ location, oficio, dist, quando }, home),
    [location, oficio, dist, quando, home]
  );

  const layout = { db, role, ui, ordered, found, chips, query, home };
  return (
    <div>
      <MobileFeed {...layout} />
      <DesktopFeed {...layout} />
      <FiltersSheet ui={ui} count={ordered.length} home={home} />
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
