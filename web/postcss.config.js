import tailwindcss from 'tailwindcss';
import peers from 'tailwindcss/peers/index.js';

// Vendor prefixes come from the autoprefixer bundled with Tailwind — the one the legacy app's
// `tailwindcss` CLI build used — so the generated CSS is byte-for-byte the legacy rules.
export default {
  plugins: [tailwindcss(), peers.lazyAutoprefixer()]
};
