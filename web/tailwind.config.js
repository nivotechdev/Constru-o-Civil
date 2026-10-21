/** @type {import('tailwindcss').Config} */
// Same theme as the legacy app (app/tailwind.config.js) — only `content` changed, to scan the React sources.
// Data, types and tests hold no class names: leaving them out keeps words in their code and comments
// ("table", "block"…) from turning into CSS rules nothing uses.
const scale = (name, steps) => Object.fromEntries(steps.map((k) => [k, `rgb(var(--c-${name}-${k}) / <alpha-value>)`]));

export default {
  // U21: the dark theme is <html data-theme="dark"> (chosen in Configurações); `dark:` only for the few things
  // that are not a colour token (the Google button follows Google's own dark style).
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}', '!./src/services/**', '!./src/types/**', '!./src/__tests__/**'],
  theme: {
    // `lg` is the desktop/tablet layout (top navbar, rails); below it is the phone layout. U41: `short` is a short
    // screen (a small phone with the browser bars): the sign-up screens tighten there so they never scroll.
    screens: { sm: '640px', lg: '770px', xl: '1280px', '2xl': '1536px', short: { raw: '(max-height: 719px)' } },
    extend: {
      // U21: every colour is a CSS variable (src/styles/tokens.css) so the dark theme only swaps the values; in the
      // light theme they are exactly the old hex values.
      colors: {
        brand: scale('brand', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 'hover', 'press', 'logo']),
        accent: scale('accent', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 'hover']),
        concrete: scale('concrete', [0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]),
        success: scale('success', [50, 100, 500, 600]),
        warning: scale('warning', [50, 100, 500, 600]),
        danger: scale('danger', [50, 100, 500, 600, 'solid']),
        // Dark chips that must stay dark in both themes (toasts, the offline bar).
        ink: 'rgb(var(--c-ink) / <alpha-value>)'
      },
      fontFamily: {
        display: ['Barlow', 'Helvetica Neue', 'Arial', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'Segoe UI', 'Arial', 'sans-serif'],
        mono: ['"Space Mono"', 'Roboto Mono', 'monospace']
      },
      borderRadius: { control: '0.5rem', card: '0.75rem', sheet: '1rem' },
      boxShadow: {
        card: '0 1px 2px rgba(16,20,24,.06)',
        raised: '0 2px 8px rgba(16,20,24,.08)',
        float: '0 8px 24px rgba(16,20,24,.12)',
        sheet: '0 -8px 24px rgba(16,20,24,.14)',
        bar: '0 -1px 0 rgb(var(--c-concrete-200)), 0 -6px 16px rgba(16,20,24,.06)'
      },
      maxWidth: { app: '30rem', panel: '67.5rem' }
    }
  },
  plugins: []
};
