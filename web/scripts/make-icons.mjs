// X02: draws the app icons and the link preview image (public/icons) from the Bicos mark — the white
// briefcase on the brand blue (U48: it was a hammer; the Bicos is for every kind of service now). Run again only when
// the mark changes: `node scripts/make-icons.mjs`.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = (name) => fileURLToPath(new URL('../public/icons/' + name, import.meta.url));
const BLUE = '#1D4BED';
// Lucide "briefcase" (ISC), the same as the app's icon.
const MARK = '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>';

/** The mark in a 512 square; `inset` is how far the briefcase stays from the edge, `radius` the corners. */
const mark = (inset, radius) => {
  const scale = (512 - inset * 2) / 24;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="${radius}" fill="${BLUE}"/>` +
    `<g transform="translate(${inset} ${inset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${MARK}</g></svg>`
  );
};

const icon = mark(112, 112); // any purpose: rounded square, as on the top bar
const full = mark(136, 0); // maskable / Apple: full bleed, the briefcase inside the 80% safe circle
writeFileSync(out('icon.svg'), icon);

const font = readFileSync(
  fileURLToPath(new URL('../node_modules/@fontsource/barlow/files/barlow-latin-700-normal.woff2', import.meta.url))
).toString('base64');
const og = `<html><head><style>
@font-face { font-family: Barlow; font-weight: 700; src: url(data:font/woff2;base64,${font}) format('woff2'); }
body { margin: 0; width: 1200px; height: 630px; background: ${BLUE}; color: #fff; display: flex; align-items: center;
  justify-content: center; gap: 56px; font-family: Barlow, sans-serif; }
.m { width: 220px; height: 220px; border-radius: 52px; background: #fff; display: flex; align-items: center; justify-content: center; }
h1 { font-size: 150px; margin: 0; letter-spacing: -0.02em; line-height: 1; }
p { font-size: 46px; margin: 18px 0 0; opacity: .92; }
</style></head><body>
<div class="m"><svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="${BLUE}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${MARK}</svg></div>
<div><h1>Bicos</h1><p>Bicos e diárias perto de você</p></div></body></html>`;

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
await shot(full, 180, 'apple-touch-icon.png');
await shot(icon, 32, 'favicon-32.png');
await shot(og, 1200, 'og.png', 630);
await browser.close();
