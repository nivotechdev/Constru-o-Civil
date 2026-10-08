import { useMemo } from 'react';
import { CityPicker } from '../../../components/CityPicker';
import { useDb, useRole, useUI } from '../../../hooks/useStore';
import { activeJobs, isJobClosed } from '../../../services/selectors';
import { DesktopFeed } from './DesktopFeed';
import { FiltersSheet } from './FeedSheets';
import {
  activeFilters,
  FEED_DEFAULTS,
  FEED_KEY,
  orderJobs,
  setFeed,
  passesFilters,
  searchMatches,
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
  const [ui] = useUI<FeedUI>(FEED_KEY, FEED_DEFAULTS);
  const { location, tipo, dist, quando, sort } = ui;
  const q = ui.search.trim().toLowerCase();

  const open = useMemo(() => activeJobs(db).filter((j) => !isJobClosed(db, j)), [db]);
  const ordered = useMemo(
    () =>
      orderJobs(
        open.filter((j) => passesFilters(j, { location, tipo, dist, quando })),
        role,
        sort
      ),
    [open, role, location, tipo, dist, quando, sort]
  );
  const found = useMemo(() => (q ? searchMatches(db, open, q, role) : null), [db, open, q, role]);
  const chips = useMemo(() => activeFilters({ location, tipo, dist, quando }), [location, tipo, dist, quando]);

  const layout = { db, role, ui, ordered, found, chips };
  return (
    <div>
      <MobileFeed {...layout} />
      <DesktopFeed {...layout} />
      <FiltersSheet ui={ui} count={ordered.length} />
      <CityPicker
        open={ui.pickerOpen}
        title="Onde você quer trabalhar"
        value={location}
        stateKey="feed-city"
        onChoose={(label) => setFeed({ location: label, pickerOpen: false })}
        onClose={() => setFeed({ pickerOpen: false })}
      />
    </div>
  );
}
