// X02: draws the app icons and the link preview image (public/icons) from the brand mark. U70: the mark is the
// Valorjob check (brand book "Valorjob — Brand Book"): a white check on the brand blue — short arm and long arm 1:2,
// the V of Valorjob — with an amber dot inside the V, a person raising a hand. The favicon draws the check 18% thicker
// so it still reads at 16 px. The wordmark comes from src/components/Logo.tsx (one source). Run again only when the
// mark changes: `node scripts/make-icons.mjs`.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = (name) => fileURLToPath(new URL('../public/icons/' + name, import.meta.url));
const BLUE = '#1D4BED';
const AMBER = '#FFB21E';

// The symbol on its 100-unit grid: the check (stroke 17, round caps) and the dot (r 11), 6.5 units from both arms.
const CHECK = '19,49 40,77 81,23';
const DOT = { cx: 40, cy: 33.5, r: 11 };
const BOX = { x: 10.5, y: 14.5, w: 79, h: 71 }; // the symbol's bounds, stroke included

/** The symbol centred in a 512 square: `fill` is its width share, `radius` the corners, `bold` thickens it. */
const mark = (fill, radius, bold = 1) => {
  const s = (512 * fill) / BOX.w;
  const tx = (512 - BOX.w * s) / 2 - BOX.x * s;
  const ty = (512 - BOX.h * s) / 2 - BOX.y * s;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="${radius}" fill="${BLUE}"/>` +
    `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">` +
    `<polyline points="${CHECK}" fill="none" stroke="#fff" stroke-width="${17 * bold}" stroke-linecap="round" ` +
    `stroke-linejoin="round"/><circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r * (bold > 1 ? 1.08 : 1)}" ` +
    `fill="${AMBER}"/></g></svg>`
  );
};

const icon = mark(0.64, 112); // any purpose: rounded square, as on the phone's home screen
const full = mark(0.5, 0); // maskable / Apple: full bleed, the symbol inside the 80% safe circle
const favicon = mark(0.8, 112, 1.18); // 16–32 px: bigger and thicker, so the check and the dot survive
writeFileSync(out('icon.svg'), favicon);

// The link preview: the white lockup (same drawing as the top bar) and the sentence.
const logo = readFileSync(fileURLToPath(new URL('../src/components/Logo.tsx', import.meta.url)), 'utf8');
const wordmark = /const WORDMARK =\s*'([^']+)'/.exec(logo)[1];
let fontFace = '';
try {
  const font = readFileSync(
    fileURLToPath(
      new URL(
        '../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2',
        import.meta.url
      )
    )
  ).toString('base64');
  fontFace = `@font-face { font-family: 'Plus Jakarta Sans'; font-weight: 600; src: url(data:font/woff2;base64,${font}) format('woff2'); }`;
} catch {
  // Without node_modules the sentence falls back to the system sans.
}
const og = `<html><head><style>${fontFace}
body { margin: 0; width: 1200px; height: 630px; background: ${BLUE}; color: #fff; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 44px; font-family: 'Plus Jakarta Sans', Inter, sans-serif; }
p { font-size: 44px; font-weight: 600; margin: 0; opacity: .92; }
</style></head><body>
<svg width="760" viewBox="0 0 526 105"><polyline points="11.5,46.7 39.9,84.5 95.4,11.5" fill="none" stroke="#fff"
stroke-width="23" stroke-linecap="round" stroke-linejoin="round"/><circle cx="39.9" cy="25.7" r="14.9" fill="${AMBER}"/>
<path fill="#fff" d="${wordmark}"/><circle cx="395.8" cy="19.3" r="10.2" fill="${AMBER}"/></svg>
<p>Trabalho de valor, gente de confiança.</p></body></html>`;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' } : {}
);
const page = await browser.newPage();
const shot = async (html, size, file, height = size) => {
  await page.setViewportSize({ width: size, height });
  await page.setContent(
    html.startsWith('<svg')
      ? `<html><body style="margin:0;background:transparent">${html.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`
      : html
  );
  await page.screenshot({ path: out(file), omitBackground: true });
};
await shot(icon, 192, 'icon-192.png');
await shot(icon, 512, 'icon-512.png');
await shot(full, 512, 'maskable-512.png');
await shot(mark(0.64, 0), 180, 'apple-touch-icon.png');
await shot(favicon, 32, 'favicon-32.png');
await shot(og, 1200, 'og.png', 630);
await browser.close();
