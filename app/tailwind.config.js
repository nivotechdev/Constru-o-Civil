/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    // `lg` is the desktop/tablet layout (top navbar, rails); below it is the phone layout.
    screens: { sm: '640px', lg: '770px', xl: '1280px', '2xl': '1536px' },
    extend: {
      colors: {
        brand: { 50: '#EFF3FE', 100: '#DBE4FD', 200: '#B7C8FB', 300: '#8BA5F7', 400: '#587AF3', 500: '#1D4BED', 600: '#163CC2', 700: '#122F97', 800: '#0E2472', 900: '#0A1A54' },
        accent: { 50: '#E7F6F4', 100: '#C8EAE6', 200: '#96D6CF', 300: '#5EBDB3', 400: '#2AA096', 500: '#0F8F82', 600: '#0B7368', 700: '#095B53', 800: '#07443E', 900: '#05302C' },
        concrete: { 0: '#FFFFFF', 25: '#FBFCFD', 50: '#F4F6F8', 100: '#EAEEF2', 200: '#DCE0E5', 300: '#C3C9D1', 400: '#8A939F', 500: '#5C6672', 600: '#434C57', 700: '#2F3742', 800: '#1D2530', 900: '#101418' },
        success: { 50: '#E7F6EE', 100: '#C6E9D6', 500: '#0B7A4B', 600: '#08633C' },
        warning: { 50: '#FFF4E0', 100: '#FFE4B5', 500: '#A55A00', 600: '#8A4A00' },
        danger: { 50: '#FDECEC', 100: '#F9D2D2', 500: '#C02626', 600: '#9C1C1C' }
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
        bar: '0 -1px 0 #DCE0E5, 0 -6px 16px rgba(16,20,24,.06)'
      },
      maxWidth: { app: '30rem', panel: '67.5rem' }
    }
  },
  plugins: []
};
