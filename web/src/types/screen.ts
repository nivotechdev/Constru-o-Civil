import type { Params } from '../services/router';

/** Props every routed screen receives: the route's `:params`. */
export interface ScreenProps {
  params: Params;
}
