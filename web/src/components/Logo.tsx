import { cx } from '../utils/cx';

// U70: the Valorjob mark (brand book "Valorjob — Brand Book"): a check whose short and long arms (1:2) make the V of
// Valorjob, with an amber dot inside the V — a person raising a hand ("eu faço"). The wordmark is drawn (Inter Display
// ExtraBold in curves, its "j" dot the same amber), so it never depends on a font. Only the dots are fixed colours;
// the check follows the brand blue of the theme and the letters the strongest text colour.
const AMBER = '#FFB21E';
const WORDMARK =
  'M162.7 84.4H185.5L209.9 11.6H190.9L181.1 43.6C178.8 51.4 176.6 59.5 174.2 68.2C171.8 59.5 169.4 51.4 167.1 43.6L156.8 11.6H137.7Z M228.7 85.3C236 85.3 240.6 82.7 243.7 77.2H243.9V84.4H260.3V49.7C260.3 38.3 252.1 31.7 237.1 31.7C222.1 31.7 213.7 38.3 213 49.5H228.6C228.9 46 231.8 43.8 236.5 43.8C240.9 43.8 243.7 45.9 243.7 48.9V49.2C243.7 52.3 240.3 53 231.1 53.8C220.1 54.7 211.1 58.4 211.1 70C211.1 80.2 218.4 85.3 228.7 85.3ZM233.9 74.3C229.8 74.3 227 72.4 227 69.2C227 65.8 230.2 64 234.7 63.3C238.8 62.6 242 62 243.8 61.2V65.8C243.8 70.9 239.5 74.3 233.9 74.3Z M284.7 11.6H267.9V84.4H284.7Z M317.3 85.6C333.4 85.6 344.4 75 344.4 58.6C344.4 42.4 333.4 31.7 317.3 31.7C301.1 31.7 290.1 42.4 290.1 58.6C290.1 75 301.1 85.6 317.3 85.6ZM317.3 72.2C311.4 72.2 307.2 67.4 307.2 58.6C307.2 49.9 311.4 45 317.3 45C323.1 45 327.4 49.9 327.4 58.6C327.4 67.4 323.1 72.2 317.3 72.2Z M349.8 84.4H366.6V58C366.6 50.7 370.7 46.5 376.7 46.5C379.2 46.5 382.2 46.6 383.4 46.6V32.7C382 32.7 380.6 32.6 378.8 32.6C371.9 32.6 368.1 35.4 366.2 41.9H366.1V32.8H349.8Z M387.4 32.8V85.8C387.4 90.1 385.9 91.8 382.2 91.8H378.8V104.8H385.4C397.9 104.8 404.2 98.8 404.2 87.5V32.8Z M436.8 85.6C453 85.6 463.9 75 463.9 58.6C463.9 42.4 453 31.7 436.8 31.7C420.7 31.7 409.7 42.4 409.7 58.6C409.7 75 420.7 85.6 436.8 85.6ZM436.8 72.2C430.9 72.2 426.7 67.4 426.7 58.6C426.7 49.9 431 45 436.8 45C442.7 45 446.9 49.9 446.9 58.6C446.9 67.4 442.7 72.2 436.8 72.2Z M500.9 85.5C514.4 85.5 523.2 74.8 523.2 58.5C523.2 42.7 514.1 31.7 501 31.7C494.3 31.7 489.5 34.3 486.2 39.8H486.1V11.6H469.3V84.4H485.9V76.4H486C488.7 82.4 494.1 85.5 500.9 85.5ZM496.2 72.1C489.8 72.1 485.5 66.8 485.5 58.5C485.5 50.4 489.8 45.1 496.2 45.1C502.4 45.1 506.2 50.1 506.2 58.5C506.2 67 502.4 72.1 496.2 72.1Z';

/**
 * The Valorjob mark + wordmark, as in the desktop top bar. `compact` is the phone size; `inverse` is for the blue
 * (splash); `height` overrides both sizes.
 */
export function Logo({
  compact = false,
  inverse = false,
  height: forced
}: {
  compact?: boolean;
  inverse?: boolean;
  height?: number;
}) {
  const height = forced ?? (compact ? 28 : 32);
  return (
    <span className="inline-flex items-center">
      <svg
        className={cx('block', inverse ? 'text-white' : 'text-concrete-900')}
        height={height}
        width={Math.round((height * 526) / 105)}
        viewBox="0 0 526 105"
        aria-hidden="true"
        focusable="false"
      >
        <polyline
          points="11.5,46.7 39.9,84.5 95.4,11.5"
          fill="none"
          className={inverse ? 'stroke-white' : 'stroke-brand-logo'}
          strokeWidth="23"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="39.9" cy="25.7" r="14.9" fill={AMBER} />
        <path fill="currentColor" d={WORDMARK} />
        <circle cx="395.8" cy="19.3" r="10.2" fill={AMBER} />
      </svg>
      <span className="sr-only">Valorjob</span>
    </span>
  );
}
